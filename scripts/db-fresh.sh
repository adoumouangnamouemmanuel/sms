#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DB_DIR=".data"
DB_FILE="$DB_DIR/edutrack.sqlite"
REPO_DB_PATH="$ROOT_DIR/$DB_FILE"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# The desktop app stores its real database under %APPDATA%\EduTrack (see
# packages/db/src/deployment.ts), NOT in the repo. Detect it so the script can
# offer it - never silently wipe it.
resolve_app_db_path() {
  local app_data="${APPDATA:-${LOCALAPPDATA:-}}"
  if [[ -z "$app_data" ]]; then
    return 0
  fi
  printf '%s/EduTrack/edutrack.sqlite' "$app_data"
}

# rm needs a POSIX-style path on Git Bash; node's resolve() needs a Windows one.
to_unix_path() {
  local path="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -u "$path"
  else
    printf '%s\n' "$path"
  fi
}

to_windows_path() {
  local path="$1"
  if [[ "$path" =~ ^[A-Za-z]:[\\/] ]]; then
    printf '%s\n' "$path"
  else
    windows_path "$path"
  fi
}

APP_DB_PATH="$(resolve_app_db_path)"

mkdir -p "$DB_DIR"

# ---------------------------------------------------------------------------
# Choose the reset target(s)
# ---------------------------------------------------------------------------

print_header "EduTrack Africa fresh dev database"

TARGETS=()

if [[ -n "${EDUTRACK_SQLITE_PATH:-}" ]]; then
  # Explicit override: reset exactly that database.
  TARGETS+=("$EDUTRACK_SQLITE_PATH|configured database (EDUTRACK_SQLITE_PATH)")
elif [[ -n "$APP_DB_PATH" && -f "$APP_DB_PATH" ]]; then
  print_info "The desktop app database was detected:"
  printf '%s\n' "  $APP_DB_PATH"
  print_info "It contains real school data (students, grades, configuration...)."

  if [[ -f "$REPO_DB_PATH" ]]; then
    print_info ""
    print_info "A repo-local dev database also exists:"
    printf '%s\n' "  $REPO_DB_PATH"
    print_info ""
    print_info "  1) Repo-local dev DB (default)"
    print_info "  2) Desktop app DB"
    print_info "  both) Reset both"
    printf 'Reset which? [1/2/both] (default 1): '
    if ! read -r choice; then
      choice=1
    fi

    case "${choice:-1}" in
      2)
        TARGETS+=("$APP_DB_PATH|desktop app database")
        ;;
      both | BOTH | b)
        TARGETS+=("$REPO_DB_PATH|repo-local dev database" "$APP_DB_PATH|desktop app database")
        ;;
      *)
        TARGETS+=("$REPO_DB_PATH|repo-local dev database")
        ;;
    esac
  else
    printf 'Reset the desktop app database anyway? [y/N]: '
    if ! read -r choice; then
      choice=N
    fi

    if [[ "$choice" =~ ^[yY] ]]; then
      TARGETS+=("$APP_DB_PATH|desktop app database")
    else
      print_info "Cancelled."
      exit 0
    fi
  fi
else
  TARGETS+=("$REPO_DB_PATH|repo-local dev database")
fi

for entry in "${TARGETS[@]}"; do
  path="${entry%%|*}"
  label="${entry#*|}"
  print_info "Reset target [$label]: $path"
  if [[ "$label" == "desktop app database" ]]; then
    print_info "Close the desktop app before continuing, or the delete may fail."
  fi
done

# ---------------------------------------------------------------------------
# Safety: back up every existing target before deleting anything
# ---------------------------------------------------------------------------

for entry in "${TARGETS[@]}"; do
  path="${entry%%|*}"
  if [[ -f "$path" ]]; then
    backup_path="$path.backup-$(date +%Y%m%d-%H%M%S)"
    cp "$path" "$backup_path"
    print_info "Backup created: $backup_path"
  fi
done

printf 'Type RESET to continue: '
if ! read -r confirmation; then
  exit 0
fi

if [[ "$confirmation" != "RESET" ]]; then
  print_info "Cancelled."
  exit 0
fi

# ---------------------------------------------------------------------------
# Delete + recreate each target (migrations + foundation seed)
# ---------------------------------------------------------------------------

for entry in "${TARGETS[@]}"; do
  path="${entry%%|*}"
  label="${entry#*|}"
  delete_path="$(to_unix_path "$path")"

  print_header "Recreating $label"
  rm -f "$delete_path" "$delete_path-shm" "$delete_path-wal"

  export EDUTRACK_SQLITE_PATH
  EDUTRACK_SQLITE_PATH="$(to_windows_path "$path")"
  run_pnpm_step "Run SQLite migrations" run db:migrate
  run_pnpm_step "Seed foundation data" run db:seed
done

print_header "Fresh database ready"
print_success "Open these files in DBeaver:"
for entry in "${TARGETS[@]}"; do
  printf '%s\n' "  ${entry%%|*}"
done
