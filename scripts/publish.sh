#!/usr/bin/env bash
# ============================================================
# publish.sh — единая точка публикации изменений в git
# ============================================================
#
# Использование:
#   ./scripts/publish.sh                     # показать статус, ничего не делать
#   ./scripts/publish.sh "feat: описание"    # коммит + push + ссылка на PR
#
# Что делает:
#   1. Проверяет, что вы не на защищённой ветке (stable-version/main)
#   2. Показывает статус
#   3. Делает fetch origin
#   4. Если ветка отстаёт — автоматически rebase
#   5. Добавляет изменения (git add -u — только отслеживаемые файлы)
#   6. Показывает untracked-файлы, но НЕ добавляет их сам
#   7. Коммитит с переданным сообщением
#   8. Пушит в origin/<текущая-ветка>
#   9. Выводит ссылку на создание PR
#
# Что НЕ делает (специально):
#   - не использует git add -A (защита от node_modules, .env, coverage)
#   - не мержит PR
#   - не удаляет ветки (делать в GitHub UI после мержа)
# ============================================================

set -euo pipefail

# ---------- Цвета ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}✓${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
error() { echo -e "${RED}✗${NC}  $*" >&2; }
step()  { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

# ---------- Проверка, что мы в git-репозитории ----------
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  error "Вы не в git-репозитории."
  exit 1
fi

# ---------- Определить корень репозитория ----------
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# ---------- Определить remote и ветку ----------
REMOTE="origin"

BRANCH=$(git branch --show-current)
if [ -z "$BRANCH" ]; then
  error "Detached HEAD. Переключитесь на ветку: git checkout <branch>"
  exit 1
fi

# ---------- Защита основных веток ----------
PROTECTED_BRANCHES=("stable-version" "main" "master" "production" "prod")
for pb in "${PROTECTED_BRANCHES[@]}"; do
  if [ "$BRANCH" = "$pb" ]; then
    error "Ветка '$BRANCH' защищена — коммитить напрямую нельзя."
    info "Создайте feature-ветку:"
    echo -e "    ${CYAN}git checkout -b feature/ваше-название${NC}"
    info "Затем повторите:"
    echo -e "    ${CYAN}./scripts/publish.sh \"ваше сообщение\"${NC}"
    exit 1
  fi
done

step "Ветка: ${BOLD}$BRANCH${NC}"
info "Репозиторий: ${REPO_ROOT}"

# ---------- Показать статус ----------
step "Текущий статус"
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  ok "Рабочее дерево чистое — изменений нет."
else
  git status --short
fi
echo ""

# ---------- Если сообщение не передано — только показать статус ----------
if [ $# -eq 0 ]; then
  warn "Сообщение коммита не передано. Показал статус, ничего не делаю."
  echo ""
  info "Использование:"
  echo -e "    ${CYAN}./scripts/publish.sh \"feat: описание\"${NC}"
  echo ""
  info "Примеры:"
  echo -e "    ${CYAN}./scripts/publish.sh \"feat(puzzle): add hints\"${NC}"
  echo -e "    ${CYAN}./scripts/publish.sh \"fix(replay): responsive layout\"${NC}"
  echo -e "    ${CYAN}./scripts/publish.sh \"chore: update dependencies\"${NC}"
  exit 0
fi

MSG="$1"

# ---------- Проверить, есть ли что коммитить ----------
HAS_STAGED=$(git diff --cached --name-only | head -1)
HAS_UNSTAGED=$(git diff --name-only | head -1)
HAS_UNTRACKED=$(git ls-files --others --exclude-standard | head -1)

if [ -z "$HAS_STAGED" ] && [ -z "$HAS_UNSTAGED" ] && [ -z "$HAS_UNTRACKED" ]; then
  ok "Нечего коммитить — рабочее дерево чистое."
  info "Если вы уже закоммитили и хотите запушить — выполните:"
  echo -e "    ${CYAN}git push $REMOTE $BRANCH${NC}"
  exit 0
fi

# ---------- Проверить upstream ----------
step "Синхронизация с remote"
info "Fetch $REMOTE..."
git fetch "$REMOTE" --prune

if git rev-parse --verify "$REMOTE/$BRANCH" >/dev/null 2>&1; then
  BEHIND=$(git rev-list --count "HEAD..$REMOTE/$BRANCH")
  AHEAD=$(git rev-list --count "$REMOTE/$BRANCH..HEAD")
  info "Ветка $REMOTE/$BRANCH существует — впереди на $AHEAD, отстаёт на $BEHIND"

  if [ "$BEHIND" -gt 0 ]; then
    warn "Ветка отстаёт от remote на $BEHIND коммитов — делаю rebase..."
    if ! git pull --rebase "$REMOTE" "$BRANCH"; then
      error "Rebase не удался — есть конфликты."
      echo ""
      info "Разрешите конфликты:"
      echo -e "    1. Откройте файлы с маркерами ${RED}<<<<<<<${NC}, ${YELLOW}=======${NC}, ${RED}>>>>>>>${NC}"
      echo -e "    2. Сохраните правильную версию"
      echo -e "    3. ${CYAN}git add <file>${NC}"
      echo -e "    4. ${CYAN}git rebase --continue${NC}"
      echo ""
      info "Чтобы отменить rebase полностью:"
      echo -e "    ${CYAN}git rebase --abort${NC}"
      exit 1
    fi
    ok "Rebase выполнен"
  fi
else
  info "Ветки $REMOTE/$BRANCH нет — она будет создана при push."
fi

# ---------- Добавить отслеживаемые файлы ----------
step "Подготовка к коммиту"
info "git add -u (только отслеживаемые изменения)"
git add -u

# ---------- Проверить untracked ----------
UNTRACKED=$(git ls-files --others --exclude-standard)
if [ -n "$UNTRACKED" ]; then
  echo ""
  warn "Найдены НОВЫЕ (untracked) файлы — они НЕ будут добавлены автоматически:"
  echo ""
  echo "$UNTRACKED" | sed 's/^/     /'
  echo ""
  info "Если они должны попасть в коммит — добавьте их вручную:"
  echo -e "    ${CYAN}git add <file>${NC}"
  echo ""
  info "Затем повторите:"
  echo -e "    ${CYAN}./scripts/publish.sh \"$MSG\"${NC}"
  echo ""
  info "Если они НЕ должны попасть (мусор, .env, node_modules):"
  info "  — проверьте .gitignore, возможно правило отсутствует"
  echo ""
  exit 1
fi

# ---------- Проверить, что в индексе есть что коммитить ----------
if git diff --cached --quiet; then
  ok "В индекс ничего не добавлено — нечего коммитить."
  exit 0
fi

# ---------- Показать, что будет в коммите ----------
step "Файлы к коммиту"
git diff --cached --stat
echo ""

# ---------- Предупреждение о размере ----------
CHANGED_FILES=$(git diff --cached --name-only | wc -l | tr -d ' ')
if [ "$CHANGED_FILES" -gt 50 ]; then
  warn "В коммите $CHANGED_FILES файлов — это подозрительно много."
  info "Проверьте, не попал ли мусор (node_modules, coverage, dist):"
  git diff --cached --name-only | grep -E "(node_modules|coverage|dist|\.env)" || true
  echo ""
  read -rp "Продолжить? [y/N] " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    warn "Отменено пользователем."
    exit 0
  fi
fi

# ---------- Коммит ----------
step "Коммит"
info "Сообщение: $MSG"
git commit -m "$MSG"
ok "Закоммичено"

# ---------- Push ----------
step "Push в $REMOTE/$BRANCH"
if git push "$REMOTE" "$BRANCH"; then
  ok "Запушено успешно"
else
  error "Push не удался."
  echo ""
  info "Возможные причины:"
  echo -e "    — Branch Protection запрещает прямой push (это нормально для stable-version)"
  echo -e "    — Кто-то запушил в эту ветку — попробуйте: ${CYAN}git pull --rebase $REMOTE $BRANCH${NC}"
  exit 1
fi

# ---------- Итог ----------
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ Публикация успешна${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""
info "Создать PR:"
echo -e "    ${CYAN}https://github.com/MAD-11/okiya-online/compare/stable-version...$BRANCH${NC}"
echo ""
info "Следующие шаги:"
echo -e "    1. Открыть ссылку выше → Create pull request"
echo -e "    2. Дождаться 4 зелёных CI-галочек"
echo -e "    3. Merge pull request → Delete branch"
echo -e "    4. Локально: ${CYAN}git checkout stable-version && git pull${NC}"
echo ""