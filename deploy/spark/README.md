# Spark CRM deployment

Spark CRM is this fork of MicroPowerManager, running on the `spark-paygops` VPS at <https://crm.sparkenergy.io>.

It is built from source on the VPS and sits behind the host's edge proxy (`deploy/edge`), a Traefik shared by every app on the VPS.
`backend` and `frontend` join the external `edge` network so Traefik can route to them.
Traefik sends `/api` to the backend and everything else to the frontend, and issues the TLS certificate (`letsencrypt` resolver).
MySQL and Redis stay on a private network.
No service publishes a host port, because the VPS has no host firewall.

| Path on the VPS | What |
| --- | --- |
| `/opt/spark-crm` | Clone of `https://github.com/andreximenes/micropowermanager` |
| `/opt/spark-crm/deploy/spark/env/*.env` | Secrets (gitignored, never copied elsewhere) |
| `/opt/spark-crm/deploy/spark/.env` | Optional build settings, e.g. `VUE_APP_HEADING_FONT_URL` |
| `/opt/spark-crm-backups` | Daily database dumps, kept 7 days |

## First install

```sh
sudo mkdir -p /opt/spark-crm && sudo chown "$USER": /opt/spark-crm
git clone https://github.com/andreximenes/micropowermanager /opt/spark-crm
cd /opt/spark-crm/deploy/spark
for file in backend frontend mysql; do cp "env/$file.env.example" "env/$file.env"; done
chmod 600 env/*.env
```

Fill every `GENERATE` value with the `openssl` command next to it.
`DB_PASSWORD` in `backend.env` must equal `MYSQL_ROOT_PASSWORD` in `mysql.env`.
Start the edge proxy first if it is not running (see `deploy/edge/README.md`), then deploy:

```sh
/opt/spark-crm/deploy/spark/deploy.sh
```

The backend runs the database migrations on every start.

## Update

```sh
/opt/spark-crm/deploy/spark/deploy.sh
```

This pulls `main` (fast-forward only), rebuilds the images and recreates the containers.
Data lives in the `spark-crm_mysql_data`, `spark-crm_redis_data` and `spark-crm_storage_data` volumes, which survive redeploys.
Never run `docker compose down -v`: it deletes them.

## Company registration

Self-registration is closed.
The `crm-register-lock` labels on the backend answer `POST /api/companies` with 403.
To register another company, remove those labels, deploy, register, then put them back.

## Backups

`backup.sh` dumps every database: the central one plus one per company.
It runs from cron:

```cron
30 2 * * * /opt/spark-crm/deploy/spark/backup.sh >> /opt/spark-crm-backups/backup.log 2>&1
```

To restore a dump:

```sh
gunzip -c /opt/spark-crm-backups/<file>.sql.gz \
  | sudo docker compose -f /opt/spark-crm/deploy/spark/docker-compose.yml exec -T mysql \
      sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'
```

## Things to keep out of this host

`.env.override.micropowermanager-backend` is a local-development file that disables the Spark SHS plugin's SSRF guard.
`deploy.sh` refuses to run if it exists in the clone.
