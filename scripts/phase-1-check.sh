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

print_header "EduTrack Africa Phase 1 check"
print_info "This groups the current Phase 1 verification commands for convenience."
print_info "SQLite path: $EDUTRACK_SQLITE_PATH"
sleep_between_steps

run_pnpm_step "Run SQLite migrations" run db:migrate
run_pnpm_step "Seed foundation data" run db:seed
run_pnpm_step "Run typecheck" run typecheck
run_pnpm_step "Run lint" run lint
run_pnpm_step "Run unit tests" run test
run_pnpm_step "Run production build" run build
run_pnpm_step "Verify packaged sidecar" run verify:sidecar
run_pnpm_step "Check desktop package" run check:desktop

print_header "Phase 1 check complete"
print_success "All Phase 1 convenience checks passed."
