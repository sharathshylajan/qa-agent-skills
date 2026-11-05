#!/usr/bin/env bash
set -uo pipefail

MAX_ATTEMPTS="${PLAYWRIGHT_SETUP_MAX_ATTEMPTS:-5}"
if ! [[ "$MAX_ATTEMPTS" =~ ^[1-5]$ ]]; then MAX_ATTEMPTS=5; fi
ATTEMPT=0
STAGE="environment"
LAST_ERROR=""
LAST_EXIT=0
ROOT_DIR="${PLAYWRIGHT_WORKSPACE_DIR:-$PWD}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$ROOT_DIR/.cache/ms-playwright}"
mkdir -p "$ROOT_DIR/.playwright-runtime" "$PLAYWRIGHT_BROWSERS_PATH"
LOG_FILE="$ROOT_DIR/.playwright-runtime/bootstrap.log"
: > "$LOG_FILE"

sanitize() {
  sed -E \
    -e 's#(https?://)[^/@[:space:]]+:[^/@[:space:]]+@#\1***:***@#g' \
    -e 's/(BASIC_AUTH_PASSWORD|BASIC_AUTH_USERNAME)=([^[:space:]]+)/\1=***/g' \
    -e 's/(password|username)["'"']?[[:space:]]*[:=][[:space:]]*["'"']?[^,"'"'[:space:]]+/\1=***/Ig'
}

fail_json() {
  local category="$1" fix="$2"
  local safe
  safe="$(printf '%s' "$LAST_ERROR" | sanitize | tail -n 20 | tr '\n' ' ' | cut -c1-900)"
  node -e 'console.log(JSON.stringify({status:"FAILED",attemptsUsed:Number(process.argv[1]),failedStage:process.argv[2],errorCategory:process.argv[3],rootCause:process.argv[4]||"No additional diagnostic output",lastExitCode:Number(process.argv[5]||0),recommendedFix:process.argv[6]}))' \
    "$ATTEMPT" "$STAGE" "$category" "$safe" "$LAST_EXIT" "$fix"
  exit 1
}

run_step() {
  local label="$1"; shift
  STAGE="$label"
  set +e
  "$@" >>"$LOG_FILE" 2>&1
  LAST_EXIT=$?
  set -e
  if [ "$LAST_EXIT" -ne 0 ]; then
    LAST_ERROR="$(tail -n 20 "$LOG_FILE")"
    return "$LAST_EXIT"
  fi
  return 0
}

for required in TARGET_URL BASIC_AUTH_USERNAME BASIC_AUTH_PASSWORD; do
  if [ -z "${!required:-}" ]; then
    LAST_ERROR="$required is missing"
    fail_json "missing-configuration" "Configure all required values as protected Slingshot environment variables."
  fi
done

if printf '%s' "$TARGET_URL" | grep -Eq '^https?://[^/]+:[^/]+@'; then
  LAST_ERROR="TARGET_URL contains embedded credentials"
  fail_json "credential-bearing-url" "Remove credentials from TARGET_URL and use BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD."
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  LAST_ERROR="Node.js and npm are required but unavailable in this workspace"
  fail_json "node-runtime-missing" "Use a Slingshot Linux image with Node.js 20+ and npm available."
fi

cd "$ROOT_DIR"
export PLAYWRIGHT_RUNTIME_MODULE="$(dirname "$SCRIPT_DIR")"

while [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  printf 'Attempt: %s/%s\n' "$ATTEMPT" "$MAX_ATTEMPTS" >&2

  if [ ! -f package.json ]; then
    if ! run_step "package-install" npm init -y; then
      [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ] && fail_json "npm-init-failed" "Check workspace write permissions and npm configuration."
      sleep $((ATTEMPT * 2)); continue
    fi
  fi

  if ! node -e "require.resolve('playwright')" >/dev/null 2>&1; then
    VERSION="${PLAYWRIGHT_PACKAGE_VERSION:-latest}"
    if ! run_step "package-install" npm install --no-audit --no-fund --save-dev "playwright@$VERSION"; then
      if grep -Eqi 'EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET|network' "$LOG_FILE"; then
        [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ] && fail_json "npm-network-failure" "Allow npm registry access or configure the approved registry/proxy."
      elif grep -Eqi 'EACCES|permission denied' "$LOG_FILE"; then
        fail_json "workspace-permission-denied" "Grant write access to the workspace and npm cache."
      fi
      sleep $((ATTEMPT * 2)); continue
    fi
  fi

  if ! run_step "browser-install" npx playwright install chromium; then
    if grep -Eqi 'EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET|download.*fail' "$LOG_FILE"; then
      [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ] && fail_json "browser-download-failure" "Allow Playwright CDN access or configure an approved PLAYWRIGHT_DOWNLOAD_HOST."
      sleep $((ATTEMPT * 2)); continue
    fi
  fi

  set +e
  export PLAYWRIGHT_CURRENT_ATTEMPT="$ATTEMPT"
  VERIFY_OUTPUT="$(node "$SCRIPT_DIR/verify_browser.cjs" 2>>"$LOG_FILE")"
  LAST_EXIT=$?
  set -e
  if [ "$LAST_EXIT" -eq 0 ]; then
    printf '%s\n' "$VERIFY_OUTPUT"
    exit 0
  fi

  LAST_ERROR="$(tail -n 20 "$LOG_FILE")"
  if printf '%s' "$VERIFY_OUTPUT $LAST_ERROR" | grep -Eq '"httpStatus":(401|403)|HTTP_(401|403)'; then
    STAGE="authentication"
    fail_json "authentication-or-authorization-failed" "Validate the Basic Auth secret and application authorization; do not retry unchanged credentials."
  fi
  if printf '%s' "$LAST_ERROR" | grep -Eqi 'lib[^ ]+\.so|shared librar|Host system is missing dependencies'; then
    STAGE="linux-dependencies"
    if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
      run_step "linux-dependencies" sudo -n npx playwright install-deps chromium || true
    elif [ "$(id -u)" -eq 0 ]; then
      run_step "linux-dependencies" npx playwright install-deps chromium || true
    else
      fail_json "missing-linux-dependency" "Use a Slingshot image containing Playwright Linux dependencies or grant noninteractive package-install privileges."
    fi
  elif printf '%s' "$LAST_ERROR" | grep -Eqi 'sandbox|No usable sandbox'; then
    export PLAYWRIGHT_USE_NO_SANDBOX=true
  elif printf '%s' "$LAST_ERROR" | grep -Eqi 'ERR_NAME_NOT_RESOLVED|ENOTFOUND|getaddrinfo'; then
    STAGE="navigation"
    fail_json "dns-failure" "Correct TARGET_URL or allow DNS and network access from the Slingshot workspace."
  elif printf '%s' "$LAST_ERROR" | grep -Eqi 'certificate|ERR_CERT'; then
    STAGE="navigation"
    fail_json "tls-certificate-failure" "Install the approved CA certificate; use PLAYWRIGHT_ALLOW_INSECURE_TLS=true only for an explicitly approved test environment."
  fi

  [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ] && break
  case "$ATTEMPT" in 1) sleep 2;; 2) sleep 4;; 3) sleep 8;; *) sleep 10;; esac
done

STAGE="browser-launch-or-navigation"
fail_json "setup-exhausted" "Review the sanitized bootstrap log and update the Slingshot base image, network policy, or runtime permissions."
