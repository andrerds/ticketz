# FileSize Architecture Fix - S3 Media Storage

## Problema Identificado

### Análise Crítica dos Logs

```
INFO [10:17:41.149] (12473): [S3-DRIVER] S3 read operation completed successfully
fullKey: "ticketz-test-local/media/1/1/1/IsanctySow/affix-administradora.jpg"
contentLength: 17884

GET /api/media response:
"fileSize": 0  // ❌ PROBLEMA: Tamanho correto no S3 (17884) mas 0 na API
```

### Causa Raiz: Violações Arquiteturais (DDD/Clean Code)

#### 1. **Violação de Camadas (Clean Architecture)**

```typescript
// ❌ PROBLEMA: Application Service fazendo I/O direto
const getFileSize = async (
  mediaUrl: string,
  storageLocation: "local" | "s3",
  companyId: number
) => {
  const config = await GetStorageConfigService({ companyId }); // Infrastructure access
  const driver = await StorageDriverFactory.createDriver(config); // Infrastructure access
  const fileSize = await driver.getFileSize(mediaKey); // I/O em tempo real
  return fileSize;
};
```

**Problemas:**

- Application Layer acessando Infrastructure Layer diretamente
- N+1 queries para S3/filesystem a cada chamada da API
- Transient failures causam `fileSize: 0`
- Violação do Single Responsibility Principle

#### 2. **Violação de Performance**

- **Cálculo Dinâmico**: Tamanho calculado toda vez que `/api/media` é chamada
- **I/O Blocking**: Múltiplas chamadas S3/filesystem por request
- **Cache Miss**: Sem cache de file sizes
- **Network Latency**: Cada file size = 1 round-trip para S3

#### 3. **Violação de Consistência de Dados**

- **Eventual Inconsistency**: File size pode falhar temporariamente
- **No Persistence**: Tamanho não é persistido no domain model
- **Data Loss**: Falhas de rede resultam em `fileSize: 0`

## Solução Arquiteturalmente Correta

### Princípios DDD Aplicados

#### 1. **Domain Model Enhancement**

```typescript
// ✅ SOLUÇÃO: Adicionar fileSize como propriedade do agregado Message
@Table
class Message extends Model {
  @Column(DataType.BIGINT)
  fileSize: number; // Persistir no domain model

  @Column(DataType.STRING)
  mediaUrl: string;

  // Domain logic para media information
  public getMediaInfo(): MediaInfo {
    return new MediaInfo(this.mediaUrl, this.fileSize, this.mediaType);
  }
}
```

#### 2. **Domain Events (Future Enhancement)**

```typescript
// Domain Event quando media é salva
class MediaFileSavedEvent {
  constructor(
    public readonly messageId: string,
    public readonly fileSize: number,
    public readonly mediaUrl: string
  ) {}
}
```

#### 3. **Value Object para Media Information**

```typescript
class MediaInfo {
  constructor(
    public readonly url: string,
    public readonly size: number,
    public readonly mimeType: string
  ) {
    if (size < 0) throw new Error("File size cannot be negative");
  }
}
```

## Plano de Implementação

### Fase 1: Fix Imediato (Performance & Consistency)

#### Task 1: Adicionar campo fileSize ao modelo Message

- Criar migração para adicionar coluna `fileSize BIGINT`
- Atualizar modelo Message com nova propriedade
- Validar que fileSize >= 0

#### Task 2: Atualizar processo de salvamento

- Modificar `saveMediaToFile` para retornar fileSize
- Atualizar `CreateMessageService` para salvar fileSize
- Garantir que fileSize é calculado uma única vez

#### Task 3: Remover cálculo dinâmico

- Atualizar `ListMediaFilesService` para usar fileSize do banco
- Remover função `getFileSize` que faz I/O dinâmico
- Melhorar performance da API `/api/media`

#### Task 4: Migração de dados existentes

- Script para calcular fileSize de mensagens existentes
- Background job para processar em lotes
- Validação de integridade dos dados

### Fase 2: Refatoração Arquitetural (DDD)

#### Task 5: Domain Services

- Criar `MediaStorageService` no domain layer
- Mover lógica de cálculo de fileSize para domain
- Implementar Domain Events para media operations

#### Task 6: CQRS Pattern (Opcional)

- Criar Read Model otimizado para media queries
- Separar Command/Query responsibilities
- Implementar projections para media statistics

## Referências da Spec

### Requirements Validados

- **Requirement 11.2**: "show file name, size, upload date" - Tamanho deve ser eficiente
- **Requirement 2.3**: "clear error indicating failure reason" - Evitar fileSize: 0 silencioso

### Design Properties Validados

- **Property 29**: "Media information completeness" - Inclui fileSize correto
- **Property 37**: "Storage usage statistics" - Requer fileSize preciso

### Tasks Relacionadas

- **Task 9.1**: "Fix S3 file size calculation" - Problema já identificado
- **Task 10.1**: "ListMediaFilesService with filtering" - Performance impactada

## Benefícios da Solução

### Performance

- **Eliminação de I/O dinâmico**: fileSize lido do banco, não calculado
- **Redução de latência**: Sem round-trips para S3 por request
- **Escalabilidade**: API `/api/media` escala independente do storage

### Consistência

- **Data Persistence**: fileSize sempre disponível no banco
- **Reliability**: Não depende de conectividade S3 para mostrar tamanho
- **Accuracy**: Tamanho calculado uma vez, no momento do upload

### Arquitetura

- **Clean Architecture**: Camadas respeitadas
- **DDD Compliance**: Domain model completo
- **Single Responsibility**: Cada service tem uma responsabilidade

## Implementação Imediata

### 1. Migration

```sql
ALTER TABLE Messages ADD COLUMN fileSize BIGINT DEFAULT NULL;
```

### 2. Model Update

```typescript
@Column(DataType.BIGINT)
fileSize: number;
```

### 3. Service Update

```typescript
// saveMediaToFile retorna fileSize
return { mediaPath, fileSize: dataBuffer.length };

// CreateMessageService salva fileSize
const messageData = {
  // ... existing fields
  fileSize: mediaResult.fileSize,
};
```

### 4. Query Optimization

```typescript
// ListMediaFilesService usa fileSize do banco
return {
  fileSize: msg.fileSize || 0, // Direto do banco
  // ... other fields
};
```

## Conclusão

Esta solução resolve o problema de performance e consistência enquanto mantém conformidade com DDD e Clean Architecture. O fileSize será calculado uma vez (no upload) e persistido no domain model, eliminando I/O dinâmico e garantindo dados consistentes.

A implementação segue o princípio de "fail fast" e melhora significativamente a performance da API de listagem de mídia.
