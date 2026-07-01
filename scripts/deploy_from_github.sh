
#!/usr/bin/env bash

set -euo pipefail



cd /opt/binance-signal-lab-public



OLD_SHA="$(git rev-parse HEAD 2>/dev/null || true)"



if ! git diff --quiet || ! git diff --cached --quiet; then

  echo "EC2 has local uncommitted changes. Refusing deploy."

  git status --short

  exit 1

fi



git fetch origin main --tags

git reset --hard origin/main

find . -name '._*' -delete



if ! .venv/bin/python -m py_compile bslab/web_static.py; then

  echo "py_compile failed. Rolling back."

  [ -n "$OLD_SHA" ] && git reset --hard "$OLD_SHA"

  exit 1

fi



if ! .venv/bin/python -m pytest; then

  echo "tests failed. Rolling back."

  [ -n "$OLD_SHA" ] && git reset --hard "$OLD_SHA"

  exit 1

fi



sudo systemctl restart bslab-dashboard.service



sleep 8



systemctl is-active bslab-collector.service

systemctl is-active bslab-dashboard.service

systemctl is-active cloudflared.service



curl -I http://127.0.0.1:8501



.venv/bin/python scripts/perf_check.py --base http://127.0.0.1:8501



echo "DEPLOYED:"

git rev-parse --short HEAD

