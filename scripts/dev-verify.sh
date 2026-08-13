#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

print_header "EduTrack Africa developer verification"
print_info "This is a Git Bash convenience wrapper around existing pnpm scripts."
print_info "Source of truth: package.json scripts."
sleep_between_steps

run_pnpm_step "Check formatting" run format:check
run_pnpm_step "Run lint" run lint
run_pnpm_step "Run typecheck" run typecheck
run_pnpm_step "Run unit tests" run test
run_pnpm_step "Run production build" run build

print_header "Developer verification complete"
print_success "All checks passed."
