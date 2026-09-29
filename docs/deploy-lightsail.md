# Deploying the RoadMate API on AWS Lightsail (Mumbai)

The frontend stays on Netlify. Only the backend (`server/`) moves off Render.

**Why Lightsail Mumbai:** the database is MongoDB Atlas on AWS Mumbai
(`ap-south-1`). Putting the API in the same AWS region makes each database
call take ~1–2 ms instead of tens of ms, and dashboards make many calls per page.

---

## Cost (checked September 2026 — confirm on the pricing pages before buying)

Rupee figures use ₹95 = $1 (29 Sep 2026) and include **18% GST**, which AWS
adds for accounts registered in India.

| Item | Plan | USD | ₹ / month incl. GST |
|---|---|---|---|
| Lightsail server | **2 GB RAM, 1 vCPU, 60 GB SSD** (recommended) | **$12** | **≈ ₹1,350** |
| | 1 GB RAM, 1 vCPU, 40 GB SSD (works, tight) | $7 | ≈ ₹785 |
| Static IP | while attached to a running server | free | ₹0 |
| MongoDB Atlas | stay on Free (M0) for now | $0 | ₹0 |
| Nightly backups | Cloudflare R2 (a few MB per backup) | ~free | ₹0 |
| **Total** | | **≈ $12** | **≈ ₹1,350 (≈ ₹16,000 / year)** |

Notes:
- Mumbai plans include **half** the data-transfer allowance of other regions.
  Even halved, it's far more than a CRM uses.
- Lightsail sometimes gives new accounts the first months free on some plans.
  Check the offer on the pricing page when you sign up.
- Atlas upgrade path, for later:
  - **Flex** ($8–30/month, ≈ ₹900–3,350 incl. GST) adds one automatic
    snapshot per day.
  - **M10** (~$57/month, ≈ ₹6,400 incl. GST) adds point-in-time restore and
    dedicated resources.
- The free tier (M0) is capped at 512 MB and ~100 operations/second.
  You're at 3 MB today.

Pricing pages: https://aws.amazon.com/lightsail/pricing ·
https://www.mongodb.com/pricing

---

## 1. Create the server

1. Sign in to the AWS console → search **Lightsail** → **Create instance**.
2. **Region:** Mumbai (`ap-south-1`), any zone.
3. **Platform:** Linux/Unix → **OS Only** → **Ubuntu 24.04 LTS**.
4. **Plan:** the **$12** plan (Dual-stack, i.e. with a public IPv4 address —
   *not* the IPv6-only plans; MongoDB Atlas and many users need IPv4).
5. Name it `roadmate-api` → **Create instance**.

## 2. Give it a fixed address

1. Lightsail → **Networking** → **Create static IP**.
2. Attach it to `roadmate-api`, then write the IP down.

The IP stays the same across restarts. It's free while attached; an
unattached static IP is billed, so delete it if you ever remove the server.

## 3. Open the firewall

1. Instance → **Networking** tab → IPv4 firewall.
2. Make sure these are allowed: **SSH (22)**, **HTTP (80)**, and **HTTPS (443)**.
   Add HTTPS if it's missing.
3. Do **not** open port 5000. Nginx forwards traffic to the app internally.

## 4. Let the server reach Atlas

1. Atlas → **Security → Network Access** → **Add IP Address**.
2. Enter the static IP from step 2 and save.

Render probably needed `0.0.0.0/0` (allow everyone). Leave that entry in place
until the move is done (step 13), then remove it.

## 5. Point a domain at it

HTTPS needs a domain name, and the Netlify site is HTTPS, so browsers will block
calls to a plain-HTTP API.

- **If you own a domain:** add an **A record** `api` → the static IP (for
  example `api.roadmate.team`) at your domain's DNS provider.
- **If you don't:** use `<ip-with-dashes>.sslip.io`, e.g.
  `13-233-10-20.sslip.io`. It resolves to that IP automatically and works with
  free HTTPS certificates. Fine to start with; move to a real domain later.

The rest of this guide calls it `API_DOMAIN`.

## 6. Install the software

Open **Connect using SSH** from the instance page (a browser terminal), then run:

```bash
# Updates + basic tools
sudo apt update && sudo apt -y upgrade
sudo apt install -y git nginx certbot python3-certbot-nginx

# Node.js 24 LTS (the version the project is developed on)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# MongoDB Database Tools (mongodump / mongorestore) for backups
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt update && sudo apt install -y mongodb-database-tools

# 1 GB swap: safety net so npm install can't run out of memory
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Timezone MUST stay UTC — the cron jobs are written against UTC server time (same as Render)
timedatectl | grep "Time zone"     # expect: Etc/UTC
```

Check the installs: `node -v`, `pm2 -v`, `mongodump --version`.

## 7. Get the code

The repo is private, so give the server a read-only deploy key:

```bash
ssh-keygen -t ed25519 -C "roadmate-api" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

1. Copy the output.
2. On GitHub, go to the repo → **Settings → Deploy keys** → **Add deploy key**.
   Paste it and leave "Allow write access" **off**.
3. Then clone and install:

```bash
cd ~
git clone git@github.com:Chandan-pullanikatt/roadmate-crm.git
cd roadmate-crm/server
npm ci --omit=dev
mkdir -p logs
```

## 8. Environment variables

Create `~/roadmate-crm/server/.env` with `nano .env`. Copy every value from
Render → your service → **Environment**, and make sure these are set:

```ini
NODE_ENV=production
PORT=5000
MONGO_URI=...            # same as Render
JWT_SECRET=...           # same as Render — a new one logs everybody out
CLIENT_URL=https://roadmate-team.netlify.app
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
# R2_BACKUP_BUCKET=roadmate-backups   # optional separate bucket for DB backups
VAPID_PUBLIC_KEY=...     # same as Render — new keys break existing push subscriptions
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=...
```

Then lock the file down with `chmod 600 .env`.

## 9. Start the app with PM2

```bash
cd ~/roadmate-crm/server
pm2 start ecosystem.config.js --env production
pm2 logs roadmate-server --lines 30      # expect "Server running on port 5000" and a MongoDB connected line
curl http://localhost:5000/api/health

# Restart automatically after a reboot
pm2 save
pm2 startup        # it prints one sudo command — copy and run it

# Keep log files from filling the disk
pm2 install pm2-logrotate
```

`ecosystem.config.js` runs **one** process on purpose. Don't change
`instances`: more processes would run every cron job several times, and
Socket.io needs extra setup to work across processes.

## 10. Nginx (reverse proxy + WebSockets)

```bash
sudo nano /etc/nginx/sites-available/roadmate
```

```nginx
server {
    listen 80;
    server_name API_DOMAIN;          # replace

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # Socket.io (live updates) needs the connection upgraded to WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/roadmate /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 11. HTTPS

```bash
sudo certbot --nginx -d API_DOMAIN --redirect -m you@example.com --agree-tos -n
curl https://API_DOMAIN/api/health
```

The certificate renews on its own. To check that renewal will work, run
`sudo certbot renew --dry-run`.

## 12. Switch the frontend over

1. Netlify → site → **Site configuration → Environment variables**.
2. Set `VITE_API_URL` = `https://API_DOMAIN`. The app adds `/api` itself.
3. Go to **Deploys** → **Trigger deploy** → **Clear cache and deploy site**.
   Vite bakes the address in at build time, so a redeploy is required.
4. Test in the browser:
   - log in
   - open each dashboard
   - update a lead and check that another logged-in user sees it change live (Socket.io)
   - upload a document (R2)

If something breaks, set `VITE_API_URL` back to the Render address and redeploy.
Render is untouched until step 13.

## 13. Clean up, about a week later

- Suspend or delete the Render service.
- Atlas → Network Access → **remove `0.0.0.0/0`**, leaving only the Lightsail
  static IP (plus your own IP if you connect from your laptop).
- In `server/src/index.js`, remove `https://roadmate-crm.netlify.app` from
  `ALLOWED_ORIGINS` once the old address is retired.

---

## Nightly backups

`server/src/scripts/backupToR2.js` exports the whole database with
`mongodump`, uploads it to R2 under `db-backups/`, and deletes backups
older than 14 days. Run it once by hand first:

```bash
cd ~/roadmate-crm/server && node src/scripts/backupToR2.js
```

Then schedule it for 03:00 IST (21:30 UTC) every night with `crontab -e`,
adding this line:

```cron
30 21 * * * cd /home/ubuntu/roadmate-crm/server && /usr/bin/node src/scripts/backupToR2.js >> /home/ubuntu/backup.log 2>&1
```

Check `~/backup.log` now and then; failures print `[backup] FAILED`.

**Restoring** (this overwrites the live data — do it deliberately):

1. Download the `.archive.gz` you want from the R2 dashboard.
2. Run:

   ```bash
   mongorestore --uri="$MONGO_URI" --gzip --archive=roadmate-<date>.archive.gz --drop
   ```

---

## Deploying an update

```bash
cd ~/roadmate-crm && git pull
cd server && npm ci --omit=dev
pm2 reload roadmate-server
pm2 logs roadmate-server --lines 20
```

## Finding slow pages

The server logs any request that takes more than 1 second:

```bash
pm2 logs roadmate-server --lines 500 | grep "\[slow\]"
```

Those lines name the exact API route, which tells you where an index is needed.
