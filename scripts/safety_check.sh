
#!/usr/bin/env bash

set -euo pipefail



if git diff --cached --quiet; then

  echo "No staged files."

  exit 0

fi



BLOCKED_PATHS='(^|/)(\.env(\..*)?|\.venv|venv|data|__pycache__|\.pytest_cache|\.claude|\.codex)(/|$)|(^|/)(end.*\.py|.*✅.*\.py|.*\.sqlite|.*\.sqlite3|.*\.db|.*\.tgz|.*\.tar|.*\.zip|.*\.pem|.*\.key|id_rsa|id_ed25519)$'



BAD_PATHS="$(git diff --cached --name-only | grep -E "$BLOCKED_PATHS" || true)"

if [ -n "$BAD_PATHS" ]; then

  echo "BLOCKED FILES STAGED:"

  echo "$BAD_PATHS"

  exit 1

fi



SECRET_PATTERNS='AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|aws_access_key_id|aws_secret_access_key|aws_session_token|BINANCE.*(KEY|SECRET)|ALCHEMY_KEY\s*=|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|-----BEGIN (RSA|OPENSSH|EC|DSA|PRIVATE) KEY-----'



FOUND="$(git diff --cached --name-only -z | xargs -0 grep -InI -E "$SECRET_PATTERNS" || true)"

if [ -n "$FOUND" ]; then

  echo "POSSIBLE SECRET FOUND:"

  echo "$FOUND"

  exit 1

fi



echo "Safety check OK."

