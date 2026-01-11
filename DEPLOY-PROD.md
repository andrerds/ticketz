# Deploy Produção - Ticketz

## Arquivos de Configuração

- `docker-compose.prod.yaml` - Compose de produção com nginx-proxy e SSL
- `.env-backend-prod` - Variáveis do backend
- `.env-frontend-prod` - Variáveis do frontend
- `backend/Dockerfile.prod` - Build otimizado do backend
- `frontend/Dockerfile.prod` - Build otimizado do frontend

## Setup Rápido

### 1. Configurar Domínio

Edite `.env-backend-prod` e `.env-frontend-prod`:

```bash
FRONTEND_HOST=seu-dominio.com.br
EMAIL_ADDRESS=admin@seu-dominio.com.br
```

### 2. Configurar Secrets

Edite `.env-backend-prod` e altere:

```bash
JWT_SECRET=sua_chave_jwt_secreta_aleatoria_64_chars_minimo
JWT_REFRESH_SECRET=sua_chave_refresh_secreta_aleatoria_64_chars_minimo
STORAGE_CREDENTIALS_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### 3. Deploy

```bash
docker-compose -f docker-compose.prod.yaml up -d
```

## SSL Automático

O nginx-proxy com acme-companion gera certificados SSL automaticamente via Let's Encrypt.

## Acessar

- Frontend: `https://seu-dominio.com.br`
- Backend: `https://seu-dominio.com.br/backend`

## Logs

```bash
docker-compose -f docker-compose.prod.yaml logs -f
```

## Parar

```bash
docker-compose -f docker-compose.prod.yaml down
```
