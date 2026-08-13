#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DB_DIR=".data"
DB_FILE="$DB_DIR/edutrack.sqlite"
DELETE_DB_FILE="$DB_FILE"

mkdir -p "$DB_DIR"

if [[ -z "${EDUTRACK_SQLITE_PATH:-}" ]]; then
  export EDUTRACK_SQLITE_PATH
  EDUTRACK_SQLITE_PATH="$(windows_path "$ROOT_DIR/$DB_FILE")"
elif command -v cygpath >/dev/null 2>&1; then
  DELETE_DB_FILE="$(cygpath -u "$EDUTRACK_SQLITE_PATH")"
else
  DELETE_DB_FILE="$EDUTRACK_SQLITE_PATH"
fi

print_header "EduTrack Africa fresh dev database"
print_info "This deletes only the local development SQLite files."
print_info "Target: $EDUTRACK_SQLITE_PATH"
printf 'Type RESET to continue: '
read -r confirmation

if [[ "$confirmation" != "RESET" ]]; then
  print_info "Cancelled."
  exit 0
fi

rm -f "$DELETE_DB_FILE" "$DELETE_DB_FILE-shm" "$DELETE_DB_FILE-wal"

run_pnpm_step "Run SQLite migrations" run db:migrate
run_pnpm_step "Seed foundation data" run db:seed

print_header "Fresh database ready"
print_success "Open this file in DBeaver:"
printf '%s\n' "$EDUTRACK_SQLITE_PATH"
