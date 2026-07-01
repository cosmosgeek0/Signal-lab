# Deploy CG Signal Lab on EC2 with Cloudflare Tunnel

This deployment uses public Binance market data only. It does not use Binance API keys, secrets, trading, or order execution.

Target hostname: `radar.cosmosgeek.org`

Dashboard service URL for Cloudflare Tunnel: `http://localhost:8501`

The dashboard is a plain Uvicorn/Starlette app. It uses Apache ECharts from `https://cdn.jsdelivr.net` for browser charts; no Node/npm build step is required. Every endpoint reads the collector DB strictly read-only and runs its blocking work in a worker thread, so the dashboard cannot mutate the DB and stays responsive while the collector writes.

> Both systemd units set `WorkingDirectory=/opt/binance-signal-lab-public`, so the relative DB path `data/binance_signal_lab.sqlite` resolves identically for the collector and the dashboard. This is the usual root cause of a "Symbols 0 / API RETRY" dashboard: if you launch uvicorn from a different directory, the relative path misses the DB. `/api/health` and `/api/debug` always report the resolved `db_abs_path` so you can confirm the dashboard is reading the exact file the collector writes.

## 1. Prepare an Ubuntu EC2 Instance

Open SSH to yourself only. You do not need to expose port `8501` to the internet because Cloudflare Tunnel connects outbound.

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip git curl
```

Copy or clone this project into `/opt/binance-signal-lab-public`.

```bash
sudo mkdir -p /opt/binance-signal-lab-public
sudo chown -R ubuntu:ubuntu /opt/binance-signal-lab-public
cd /opt/binance-signal-lab-public
```

If using Git, run this from your home directory and replace the URL with your private repo:

```bash
git clone <private-repo-url> /opt/binance-signal-lab-public
cd /opt/binance-signal-lab-public
```

## 2. Install Python Dependencies

```bash
cd /opt/binance-signal-lab-public
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 3. Test Locally on the EC2 Host

Create the read indexes once (manual; writes to the DB, so do it while things
are quiet — the collector keeps running in WAL mode):

```bash
cd /opt/binance-signal-lab-public
.venv/bin/python scripts/ensure_indexes.py --db data/binance_signal_lab.sqlite
```

Terminal 1:

```bash
cd /opt/binance-signal-lab-public
.venv/bin/python -m bslab.run --db data/binance_signal_lab.sqlite --top 25
```

Terminal 2:

```bash
cd /opt/binance-signal-lab-public
.venv/bin/uvicorn web_app:app --host 127.0.0.1 --port 8501
```

Terminal 3:

```bash
curl -I http://127.0.0.1:8501
.venv/bin/python scripts/web_debug.py --db data/binance_signal_lab.sqlite
.venv/bin/python scripts/perf_check.py --base http://127.0.0.1:8501
curl -s http://127.0.0.1:8501/api/state-lite | head -c 300
curl -s http://127.0.0.1:8501/api/perf
```

`perf_check.py` must print `RESULT: PASS` (`/api/health` < 100 ms, `/api/state-lite`
< 200 ms, `/api/radar?limit=300` < 300 ms). The frontend polls only
`/api/state-lite` (~10 KB gzipped) plus the active tab's endpoint; if CPU is ever
pinned, check `/api/perf` for `failed_refresh_count`, `last_error`, and payload sizes.

Stop the manual collector and dashboard with `Ctrl+C` after this smoke test.

## 4. Install systemd Services

```bash
cd /opt/binance-signal-lab-public
sudo cp deploy/bslab-collector.service /etc/systemd/system/bslab-collector.service
sudo cp deploy/bslab-dashboard.service /etc/systemd/system/bslab-dashboard.service
sudo systemctl daemon-reload
sudo systemctl enable --now bslab-collector
sudo systemctl enable --now bslab-dashboard
```

Check status:

```bash
systemctl status bslab-collector --no-pager
systemctl status bslab-dashboard --no-pager
journalctl -u bslab-collector -f
journalctl -u bslab-dashboard -f
```

Health check:

```bash
cd /opt/binance-signal-lab-public
.venv/bin/python scripts/web_debug.py --db data/binance_signal_lab.sqlite
curl http://127.0.0.1:8501/api/debug
curl http://127.0.0.1:8501/api/selftest
curl http://127.0.0.1:8501/api/watchlist
```

## 5. Install Cloudflare Tunnel

Install `cloudflared`:

```bash
cd /tmp
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

Authenticate to the Cloudflare account that owns `cosmosgeek.org`:

```bash
cloudflared tunnel login
```

Create the tunnel and DNS route:

```bash
cloudflared tunnel create cg-signal-lab
cloudflared tunnel route dns cg-signal-lab radar.cosmosgeek.org
cloudflared tunnel list
```

Find the tunnel ID from `cloudflared tunnel list`, then create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: radar.cosmosgeek.org
    service: http://localhost:8501
  - service: http_status:404
```

Copy credentials into place:

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<TUNNEL_ID>.json /etc/cloudflared/<TUNNEL_ID>.json
sudo chown -R root:root /etc/cloudflared
sudo chmod 600 /etc/cloudflared/<TUNNEL_ID>.json
```

Validate and run the tunnel as a service:

```bash
cloudflared tunnel ingress validate
sudo cloudflared service install
sudo systemctl enable --now cloudflared
systemctl status cloudflared --no-pager
```

Open:

```text
https://radar.cosmosgeek.org
```

## 6. Optional Cloudflare Access Protection

In the Cloudflare dashboard:

1. Go to Zero Trust.
2. Open Access -> Applications.
3. Add an application.
4. Choose Self-hosted.
5. Set the application domain to `radar.cosmosgeek.org`.
6. Add an allow policy for your email address or trusted identity provider group.
7. Save and test in a private browser window.

## 7. Updates

```bash
cd /opt/binance-signal-lab-public
git pull
. .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart bslab-collector bslab-dashboard
sudo systemctl restart cloudflared
.venv/bin/python scripts/web_debug.py --db data/binance_signal_lab.sqlite
curl http://127.0.0.1:8501/api/selftest
```

## 8. Useful Commands

```bash
cd /opt/binance-signal-lab-public
.venv/bin/python scripts/web_debug.py --db data/binance_signal_lab.sqlite
curl http://127.0.0.1:8501/api/selftest
systemctl status bslab-collector --no-pager
systemctl status bslab-dashboard --no-pager
systemctl status cloudflared --no-pager
journalctl -u bslab-collector -n 100 --no-pager
journalctl -u bslab-dashboard -n 100 --no-pager
journalctl -u cloudflared -n 100 --no-pager
```
