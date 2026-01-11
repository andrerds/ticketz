# Customizações do Projeto Ticketz

Este arquivo documenta todas as customizações feitas neste fork do projeto original.

## 📋 Propósito

Manter registro de todas as modificações para facilitar:

- Atualizações do projeto upstream
- Cherry-pick seletivo de commits
- Resolução de conflitos
- Onboarding de novos desenvolvedores

## 🎯 Customizações Principais

### Backend

#### Arquivos Modificados

- **`backend/src/services/MessageService.ts`**

  - Linha: [número]
  - Modificação: [descrição]
  - Motivo: [razão da customização]
  - Data: [YYYY-MM-DD]

- **`backend/src/controllers/TicketController.ts`**
  - Linha: [número]
  - Modificação: [descrição]
  - Motivo: [razão da customização]
  - Data: [YYYY-MM-DD]

#### Arquivos Adicionados

- **`backend/src/custom/`**
  - Descrição: Diretório para lógica customizada
  - Conteúdo: [listar arquivos]

### Frontend

#### Arquivos Modificados

- **`frontend/src/components/MessagesList/index.js`**

  - Modificação: Preview de mídia customizado
  - Motivo: Melhorar experiência do usuário
  - Data: [YYYY-MM-DD]

- **`frontend/src/components/Ticket/index.js`**

  - Modificação: Interface de tickets modificada
  - Motivo: Requisitos específicos do cliente
  - Data: [YYYY-MM-DD]

- **`frontend/src/components/MessageInputCustom/index.js`**

  - Modificação: Input de mensagem customizado
  - Motivo: [razão]
  - Data: [YYYY-MM-DD]

- **`frontend/src/components/MediaPreview/index.js`**

  - Modificação: Preview de mídia
  - Motivo: [razão]
  - Data: [YYYY-MM-DD]

- **`frontend/src/components/ModalImageCors/index.js`**
  - Modificação: Modal de imagem com CORS
  - Motivo: [razão]
  - Data: [YYYY-MM-DD]

#### Arquivos Adicionados

- **`frontend/src/custom/`**
  - Descrição: Componentes customizados
  - Conteúdo: [listar componentes]

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

### [YYYY-MM-DD] - Versão X.X.X

**Commits do upstream aplicados:**

- `abc1234` - Descrição do commit
- `def5678` - Descrição do commit

**Commits ignorados:**

- `ghi9012` - Motivo: Conflita com customização X
- `jkl3456` - Motivo: Funcionalidade não necessária

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

1. `frontend/src/components/MessagesList/index.js`
2. `frontend/src/components/Ticket/index.js`
3. `frontend/src/components/MessageInputCustom/index.js`
4. `frontend/src/components/MediaPreview/`
5. `frontend/src/components/ModalImageCors/`
6. `backend/src/custom/` (se existir)

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
