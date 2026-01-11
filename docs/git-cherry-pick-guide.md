# Guia de Atualização Segura com Git Cherry-Pick

## Cenário

Você mantém uma versão customizada de um projeto opensource que recebe atualizações frequentes. Precisa incorporar essas atualizações sem perder suas customizações e sem quebrar o código.

## Estratégia Recomendada

### 1. Estrutura de Branches

```
main (ou master) → Sua versão customizada em produção
develop → Branch de desenvolvimento com suas customizações
upstream-tracking → Espelho do repositório original
feature/* → Branches temporárias para cherry-pick
```

## Configuração Inicial (Fazer uma vez)

### Passo 1: Adicionar o Repositório Original como Remote

```bash
# Adicionar o repositório original como "upstream"
git remote add upstream https://github.com/ticketz-oss/ticketz.git

# Verificar remotes configurados
git remote -v
```

Você deve ver algo como:

```
origin    git@github.com:andrerds/ticketz.git (fetch)
origin    git@github.com:andrerds/ticketz.git (push)
upstream  https://github.com/ticketz-oss/ticketz.git (fetch)
upstream  https://github.com/ticketz-oss/ticketz.git (push)
```

### Passo 2: Criar Branch de Tracking

```bash
# Criar branch para rastrear o upstream
git checkout -b upstream-tracking
git pull upstream main
git push origin upstream-tracking
```

## Processo de Atualização (Fazer regularmente)

### Passo 1: Atualizar o Tracking Branch

```bash
# Ir para o branch de tracking
git checkout upstream-tracking

# Buscar todas as atualizações do upstream
git fetch upstream

# Atualizar o branch local
git pull upstream main

# Enviar para seu repositório
git push origin upstream-tracking
```

### Passo 2: Analisar os Commits Novos

```bash
# Ver commits novos desde a última atualização
git log --oneline --graph upstream-tracking ^main

# Ver detalhes de um commit específico
git show <commit-hash>

# Ver arquivos modificados em um commit
git show --name-only <commit-hash>
```

### Passo 3: Criar Branch de Integração

```bash
# Voltar para main
git checkout main

# Criar branch para integração
git checkout -b integration/update-YYYY-MM-DD
```

### Passo 4: Cherry-Pick Seletivo

#### Opção A: Cherry-Pick de Commits Individuais

```bash
# Aplicar um commit específico
git cherry-pick <commit-hash>

# Se houver conflito, resolver e continuar
git status
# Editar arquivos em conflito
git add .
git cherry-pick --continue

# Se quiser abortar
git cherry-pick --abort
```

#### Opção B: Cherry-Pick de Múltiplos Commits

```bash
# Aplicar uma sequência de commits
git cherry-pick <commit-hash-1> <commit-hash-2> <commit-hash-3>

# Ou um intervalo de commits
git cherry-pick <commit-inicial>..<commit-final>
```

#### Opção C: Cherry-Pick Interativo (Recomendado)

```bash
# Iniciar rebase interativo para escolher commits
git rebase -i upstream-tracking

# No editor, marque os commits que deseja com 'pick'
# e os que não deseja com 'drop' ou simplesmente delete a linha
```

### Passo 5: Testar Extensivamente

```bash
# Instalar dependências (se houver mudanças)
cd backend && npm install
cd ../frontend && npm install

# Executar testes
npm test

# Iniciar aplicação em modo desenvolvimento
docker-compose -f docker-compose-dev.yaml up
```

### Passo 6: Merge para Main

```bash
# Se tudo estiver OK, fazer merge
git checkout main
git merge integration/update-YYYY-MM-DD

# Enviar para repositório
git push origin main

# Limpar branch de integração
git branch -d integration/update-YYYY-MM-DD
```

## Estratégias para Evitar Conflitos

### 1. Manter Customizações Isoladas

```bash
# Estrutura recomendada para customizações
backend/src/custom/
frontend/src/custom/
```

### 2. Usar Arquivos de Configuração Separados

```
.env.custom
config/custom.json
```

### 3. Documentar Todas as Customizações

Manter um arquivo `CUSTOMIZATIONS.md`:

```markdown
# Customizações do Projeto

## Backend

- `src/services/MessageService.ts` - Linha 45: Adicionada lógica de validação customizada
- `src/controllers/TicketController.ts` - Linha 120: Modificado comportamento de fechamento

## Frontend

- `src/components/MessagesList/index.js` - Adicionado preview de mídia customizado
- `src/components/Ticket/index.js` - Modificada interface de tickets
```

## Resolução de Conflitos

### Quando Ocorrer Conflito

```bash
# Ver arquivos em conflito
git status

# Abrir arquivo e procurar por marcadores
# <<<<<<< HEAD
# Seu código
# =======
# Código do upstream
# >>>>>>> commit-hash
```

### Estratégias de Resolução

1. **Manter sua versão:**

```bash
git checkout --ours <arquivo>
git add <arquivo>
```

2. **Aceitar versão upstream:**

```bash
git checkout --theirs <arquivo>
git add <arquivo>
```

3. **Merge manual:**

- Editar arquivo manualmente
- Combinar as duas versões
- Remover marcadores de conflito

```bash
git add <arquivo>
git cherry-pick --continue
```

## Automação com Script

Criar arquivo `scripts/update-from-upstream.sh`:

```bash
#!/bin/bash

set -e

echo "🔄 Iniciando atualização do upstream..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar se está em um branch limpo
if [[ -n $(git status -s) ]]; then
    echo -e "${RED}❌ Existem mudanças não commitadas. Commit ou stash antes de continuar.${NC}"
    exit 1
fi

# Atualizar upstream-tracking
echo -e "${YELLOW}📥 Atualizando upstream-tracking...${NC}"
git checkout upstream-tracking
git fetch upstream
git pull upstream main
git push origin upstream-tracking

# Ver novos commits
echo -e "${YELLOW}📋 Novos commits disponíveis:${NC}"
git log --oneline --graph upstream-tracking ^main | head -20

# Perguntar se deseja continuar
read -p "Deseja criar branch de integração? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Operação cancelada${NC}"
    exit 0
fi

# Criar branch de integração
BRANCH_NAME="integration/update-$(date +%Y-%m-%d)"
git checkout main
git checkout -b "$BRANCH_NAME"

echo -e "${GREEN}✅ Branch $BRANCH_NAME criado${NC}"
echo -e "${YELLOW}📝 Agora você pode fazer cherry-pick dos commits desejados:${NC}"
echo "   git cherry-pick <commit-hash>"
echo ""
echo -e "${YELLOW}📝 Ou iniciar rebase interativo:${NC}"
echo "   git rebase -i upstream-tracking"
```

Tornar executável:

```bash
chmod +x scripts/update-from-upstream.sh
```

## Checklist de Atualização

- [ ] Backup do banco de dados
- [ ] Commit de todas as mudanças locais
- [ ] Atualizar upstream-tracking
- [ ] Revisar changelog do projeto original
- [ ] Criar branch de integração
- [ ] Aplicar cherry-pick dos commits desejados
- [ ] Resolver conflitos (se houver)
- [ ] Testar backend
- [ ] Testar frontend
- [ ] Testar integrações (WhatsApp, etc)
- [ ] Revisar logs de erro
- [ ] Fazer merge para main
- [ ] Deploy em ambiente de staging
- [ ] Testes finais
- [ ] Deploy em produção
- [ ] Monitorar por 24h

## Comandos Úteis

```bash
# Ver diferenças entre sua versão e upstream
git diff main upstream-tracking

# Ver apenas arquivos modificados
git diff --name-only main upstream-tracking

# Ver commits que você tem mas upstream não tem
git log upstream-tracking..main

# Ver commits que upstream tem mas você não tem
git log main..upstream-tracking

# Criar patch de um commit para aplicar depois
git format-patch -1 <commit-hash>

# Aplicar patch
git apply <arquivo.patch>

# Ver histórico de cherry-picks
git log --grep="cherry picked"
```

## Boas Práticas

1. **Frequência**: Atualize semanalmente ou quinzenalmente
2. **Documentação**: Mantenha registro de todos os cherry-picks
3. **Testes**: Sempre teste extensivamente antes do merge
4. **Backup**: Faça backup antes de grandes atualizações
5. **Comunicação**: Informe a equipe sobre atualizações planejadas
6. **Versionamento**: Use tags para marcar versões estáveis

## Troubleshooting

### Problema: Muitos conflitos

**Solução**: Atualize com mais frequência ou considere refatorar customizações

### Problema: Cherry-pick quebrou funcionalidade

**Solução**:

```bash
git revert <commit-hash>
# Ou
git reset --hard HEAD~1
```

### Problema: Não sei quais commits aplicar

**Solução**: Leia o changelog do projeto original e aplique apenas correções de bugs e features necessárias

## Recursos Adicionais

- [Git Cherry-Pick Documentation](https://git-scm.com/docs/git-cherry-pick)
- [Atlassian Git Cherry-Pick Tutorial](https://www.atlassian.com/git/tutorials/cherry-pick)
- [GitHub: Syncing a Fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork)
