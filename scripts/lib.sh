#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STEP_PAUSE_SECONDS="${STEP_PAUSE_SECONDS:-0.2}"
PNPM_COMMAND=()

print_header() {
  local title="$1"
  printf '\n'
  printf '============================================================\n'
  printf '%s\n' "$title"
  printf '============================================================\n'
}

print_info() {
  printf '[info] %s\n' "$1"
}

print_success() {
  printf '[ok] %s\n' "$1"
}

print_failure() {
  printf '[fail] %s\n' "$1" >&2
}

sleep_between_steps() {
  sleep "$STEP_PAUSE_SECONDS"
}

run_step() {
  local title="$1"
  shift
  local log_file

  print_header "$title"
  print_info "Running: $*"
  sleep_between_steps

  local started_at
  started_at="$(date +%s)"
  log_file="$(mktemp -t edutrack-step.XXXXXX)"

  set +e
  "$@" 2>&1 | tee "$log_file"
  local status="${PIPESTATUS[0]}"
  set -e

  if [[ "$status" -ne 0 ]]; then
    print_failure "$title failed with exit code $status"
    rm -f "$log_file"
    return "$status"
  fi

  rm -f "$log_file"

  if [[ "$status" -eq 0 ]]; then
    local finished_at
    finished_at="$(date +%s)"
    print_success "$title completed in $((finished_at - started_at))s"
  fi
}

run_pnpm_step() {
  local title="$1"
  shift

  if [[ "${#PNPM_COMMAND[@]}" -eq 0 ]]; then
    print_failure "Neither pnpm nor corepack is available on PATH."
    print_info "Install Node.js 24 and enable pnpm through corepack, then retry."
    return 127
  fi

  run_step "$title" "${PNPM_COMMAND[@]}" "$@"
}

windows_path() {
  local path="$1"

  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w -a "$path"
    return
  fi

  printf '%s\n' "$path"
}

cd "$ROOT_DIR"

if command -v pnpm >/dev/null 2>&1; then
  PNPM_COMMAND=(pnpm)
elif command -v corepack >/dev/null 2>&1; then
  PNPM_COMMAND=(corepack pnpm@10.33.2)
fi
