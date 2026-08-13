#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DB_DIR=".data"
DB_FILE="$DB_DIR/edutrack.sqlite"

mkdir -p "$DB_DIR"

if [[ -z "${EDUTRACK_SQLITE_PATH:-}" ]]; then
  export EDUTRACK_SQLITE_PATH
  EDUTRACK_SQLITE_PATH="$(windows_path "$ROOT_DIR/$DB_FILE")"
fi

print_header "EduTrack Africa database setup"
print_info "This is a Git Bash convenience wrapper."
print_info "Source of truth: pnpm run db:migrate && pnpm run db:seed"
print_info "SQLite path: $EDUTRACK_SQLITE_PATH"
sleep_between_steps

run_pnpm_step "Run SQLite migrations" run db:migrate
run_pnpm_step "Seed foundation data" run db:seed

print_header "Database ready"
print_success "Open this file in DBeaver:"
printf '%s\n' "$EDUTRACK_SQLITE_PATH"
