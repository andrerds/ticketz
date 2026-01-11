# Customizações do Projeto Ticketz

Este arquivo documenta todas as customizações feitas neste fork do projeto original.

## 📋 Propósito

Manter registro de todas as modificações para facilitar:

- Atualizações do projeto upstream
- Cherry-pick seletivo de commits
- Resolução de conflitos
- Onboarding de novos desenvolvedores

## 🎯 Customizações Principais

Este projeto possui duas grandes features customizadas documentadas em specs:

### 1. S3 Media Storage System (`.kiro/specs/s3-media-storage/`)

Sistema flexível de armazenamento de mídia com suporte a Local e S3-compatible storage (AWS S3, MinIO, Cloudflare R2).

**Principais mudanças:**

- Storage abstraction layer com drivers Local/S3
- Campo `fileSize` adicionado ao modelo Message
- Hybrid mode: serve arquivos locais e S3 transparentemente
- Image optimization para reduzir custos
- Migration utilities para mover arquivos locais para S3
- Criptografia de credenciais S3

### 2. File Preview System (`.kiro/specs/file-preview/`)

Sistema centralizado para geração e exibição de previews de arquivos com integração S3/Local.

**Principais mudanças:**

- MediaPreview component unificado com detecção automática de storage
- Thumbnail handling robusto
- Preview URL generation baseado em storage location
- Loading states e error handling
- Integração com MediaTable

## 📋 Arquivos Modificados/Criados

### Backend

#### Storage & Media Services

- `backend/src/services/StorageServices/*` - **CRIADO** - Abstração de storage (Local/S3)
- `backend/src/services/MediaServices/ListMediaFilesService.ts` - **MODIFICADO** - Storage detection
- `backend/src/services/MediaServices/SaveMediaToFileService.ts` - **MODIFICADO** - Retorna {mediaPath, fileSize}
- `backend/src/services/MessageServices/CreateMessageService.ts` - **MODIFICADO** - Persiste fileSize
- `backend/src/services/MigrationServices/MigrateFileSizesService.ts` - **CRIADO** - Migration utility

#### Controllers

- `backend/src/controllers/MediaController.ts` - **MODIFICADO** - Hybrid mode file serving
- `backend/src/controllers/MigrationController.ts` - **CRIADO** - Migration endpoints

#### Models & Database

- `backend/src/models/Message.ts` - **MODIFICADO** - Campo fileSize adicionado
- `backend/src/database/migrations/*-add-filesize-to-messages.ts` - **CRIADO** - Migration

#### Helpers

- `backend/src/helpers/wbotMessageListener.ts` - **MODIFICADO** - Captura fileSize no upload

### Frontend

#### Preview Components

- `frontend/src/components/MediaPreview/index.js` - **CRIADO** - Unified preview component
- `frontend/src/components/MediaPreview/PdfPreview.js` - **CRIADO** - PDF preview
- `frontend/src/components/MediaPreview/ThumbnailPreview.js` - **CRIADO** - Thumbnail preview

#### Modified Components

- `frontend/src/components/MessagesList/index.js` - **MODIFICADO** - Preview integration
- `frontend/src/components/Ticket/index.js` - **MODIFICADO** - Preview support
- `frontend/src/components/MessageInputCustom/index.js` - **MODIFICADO** - Custom input
- `frontend/src/components/MessageForwardModal/index.js` - **MODIFICADO** - Forward with preview
- `frontend/src/components/MessageOptionsMenu/index.js` - **MODIFICADO** - Options integration
- `frontend/src/components/ModalImageCors/index.js` - **MODIFICADO** - CORS-aware modal
- `frontend/src/pages/MediaManagement/components/MediaTable.js` - **MODIFICADO** - Preview column
- `frontend/src/context/ReplyingMessage/ReplyingMessageContext.js` - **MODIFICADO** - Reply context
- `frontend/src/App.js` - **MODIFICADO** - Custom theme

### Configurações

#### Arquivos de Ambiente

- `.env-backend-acme`
- `.env-backend-cloudflare`
- `.env-backend-local`
- `.env-frontend-acme`
- `.env-frontend-cloudflare`
- `.env-frontend-local`

#### Docker

- `docker-compose-acme.yaml`
- `docker-compose-cloudflare.yaml`
- `docker-compose-local.yaml`

## 🔄 Histórico de Atualizações

### [2025-01-11] - Atualização para v1.0.104

**Commits do upstream aplicados:**

- `c6edb60` - bump waversion (v1.0.103)
- `aa3c140` - Limit user and owner attributes to id and name in chat services (SECURITY)
- `28254fd` - Remove pagination from Tag ListService and simplify response structure
- `8be1510` - Improve tag services & controllers security / remove old kanban routes (SECURITY)
- `fd9f5fc` - Fix scroll trigger to use thisPageNumber instead of pageNumber

**Commits ignorados:**

- `4670809` - Improve chat UI colors and layout - Conflita com customizações de tema em App.js
- `421e1a8` - Add readOnly prop to MessagesList - Conflita com customizações em MessagesList/index.js e Ticket/index.js
- `f231b81` - Wrap emoji and menu items in a div - Mudança menor de UI
- `2eb5d6f` - Add sticky message area - Conflita com customizações em MessagesList/index.js

**Conflitos resolvidos:**

- Nenhum - commits conflitantes foram ignorados para preservar customizações

**Notas:**

- Aplicados principalmente commits de segurança e correções de bugs
- Commits de UI foram ignorados para preservar customizações existentes
- Recomenda-se revisar manualmente os commits ignorados para avaliar funcionalidades

---

### [YYYY-MM-DD] - Versão X.X.X

**Commits do upstream aplicados:**

- `abc1234` - Descrição do commit

**Commits ignorados:**

- `ghi9012` - Motivo

**Conflitos resolvidos:**

- Arquivo: `path/to/file.js`
- Resolução: Mantida versão customizada com merge manual

---

### Template para Novas Atualizações

```markdown
### [YYYY-MM-DD] - Versão X.X.X

**Commits do upstream aplicados:**

- `hash` - Descrição

**Commits ignorados:**

- `hash` - Motivo

**Conflitos resolvidos:**

- Arquivo: `path`
- Resolução: Descrição
```

## 🚫 Áreas Críticas (Não Sobrescrever)

Lista de arquivos/diretórios que contêm customizações críticas:

### Backend - S3 Media Storage

1. `backend/src/services/StorageServices/*` - Storage drivers
2. `backend/src/services/MediaServices/*` - Media handling
3. `backend/src/services/MigrationServices/*` - Migration tools
4. `backend/src/controllers/MediaController.ts` - Hybrid serving
5. `backend/src/models/Message.ts` - FileSize field
6. `backend/src/helpers/wbotMessageListener.ts` - Upload handling

### Frontend - File Preview System

1. `frontend/src/components/MediaPreview/*` - All preview components
2. `frontend/src/components/MessagesList/index.js` - Preview integration
3. `frontend/src/components/Ticket/index.js` - Preview support
4. `frontend/src/components/MessageInputCustom/index.js` - Custom input
5. `frontend/src/components/MessageForwardModal/index.js` - Forward modal
6. `frontend/src/components/MessageOptionsMenu/index.js` - Options menu
7. `frontend/src/components/ModalImageCors/index.js` - CORS modal
8. `frontend/src/pages/MediaManagement/components/MediaTable.js` - Media table
9. `frontend/src/context/ReplyingMessage/ReplyingMessageContext.js` - Reply context
10. `frontend/src/App.js` - Custom theme

## 📝 Notas para Cherry-Pick

### Commits Seguros para Aplicar

- Correções de bugs em áreas não customizadas
- Atualizações de dependências
- Melhorias de performance
- Correções de segurança

### Commits que Requerem Atenção

- Modificações em componentes customizados
- Mudanças em estrutura de banco de dados
- Alterações em APIs
- Refatorações grandes

### Commits a Evitar

- Mudanças em UI que conflitam com design customizado
- Remoção de features que você usa
- Mudanças incompatíveis com suas integrações

## 🔧 Processo de Atualização

1. Executar `./scripts/update-from-upstream.sh`
2. Revisar commits novos
3. Aplicar cherry-pick seletivo
4. Testar extensivamente
5. Atualizar este documento
6. Fazer merge para main

## 📞 Contatos

- Responsável pelas customizações: [Nome]
- Email: [email]
- Última atualização deste documento: [YYYY-MM-DD]
