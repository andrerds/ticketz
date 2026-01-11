#!/bin/bash

set -e

echo "🔄 Iniciando atualização do upstream..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar se está em um branch limpo
if [[ -n $(git status -s) ]]; then
    echo -e "${RED}❌ Existem mudanças não commitadas. Commit ou stash antes de continuar.${NC}"
    exit 1
fi

# Verificar se upstream está configurado
if ! git remote | grep -q "^upstream$"; then
    echo -e "${YELLOW}⚠️  Remote 'upstream' não encontrado.${NC}"
    read -p "Digite a URL do repositório original: " UPSTREAM_URL
    git remote add upstream "$UPSTREAM_URL"
    echo -e "${GREEN}✅ Remote 'upstream' adicionado${NC}"
fi

# Verificar se branch upstream-tracking existe
if ! git show-ref --verify --quiet refs/heads/upstream-tracking; then
    echo -e "${YELLOW}⚠️  Branch 'upstream-tracking' não existe. Criando...${NC}"
    git checkout -b upstream-tracking
    git pull upstream main
    git push origin upstream-tracking
    git checkout main
    echo -e "${GREEN}✅ Branch 'upstream-tracking' criado${NC}"
fi

# Atualizar upstream-tracking
echo -e "${BLUE}📥 Atualizando upstream-tracking...${NC}"
git checkout upstream-tracking
git fetch upstream
git pull upstream main
git push origin upstream-tracking

# Ver novos commits
echo -e "\n${BLUE}📋 Novos commits disponíveis:${NC}"
NEW_COMMITS=$(git log --oneline upstream-tracking ^main | wc -l | tr -d ' ')

if [ "$NEW_COMMITS" -eq 0 ]; then
    echo -e "${GREEN}✅ Nenhum commit novo. Você está atualizado!${NC}"
    git checkout main
    exit 0
fi

echo -e "${YELLOW}Total de commits novos: $NEW_COMMITS${NC}\n"
git log --oneline --graph --decorate upstream-tracking ^main | head -20

# Perguntar se deseja continuar
echo ""
read -p "Deseja criar branch de integração? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Operação cancelada${NC}"
    git checkout main
    exit 0
fi

# Criar branch de integração
BRANCH_NAME="integration/update-$(date +%Y-%m-%d-%H%M)"
git checkout main
git checkout -b "$BRANCH_NAME"

echo -e "\n${GREEN}✅ Branch $BRANCH_NAME criado${NC}\n"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📝 Próximos passos:${NC}\n"
echo -e "1. Cherry-pick commits individuais:"
echo -e "   ${GREEN}git cherry-pick <commit-hash>${NC}\n"
echo -e "2. Cherry-pick múltiplos commits:"
echo -e "   ${GREEN}git cherry-pick <hash1> <hash2> <hash3>${NC}\n"
echo -e "3. Rebase interativo (recomendado):"
echo -e "   ${GREEN}git rebase -i upstream-tracking${NC}\n"
echo -e "4. Ver diferenças:"
echo -e "   ${GREEN}git diff main upstream-tracking${NC}\n"
echo -e "5. Após aplicar e testar:"
echo -e "   ${GREEN}git checkout main${NC}"
echo -e "   ${GREEN}git merge $BRANCH_NAME${NC}"
echo -e "   ${GREEN}git push origin main${NC}\n"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
