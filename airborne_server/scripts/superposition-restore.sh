#!/usr/bin/env bash
# Compatibility entry point. This verifies a backup in a disposable database.
set -Eeuo pipefail
exec "$(dirname "$0")/superposition-verify-restore.sh" "$@"
