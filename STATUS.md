# Spark CRM status

Spark CRM is this fork of MicroPowerManager, branded for Spark and deployed at <https://crm.sparkenergy.io> (see `deploy/spark/README.md`).
This file tracks what the fork adds and what is still pending.
Upstream's own plans live in `docs/roadmap.md`.

## Done

- Spark SHS plugin: opt-in kit sync from the Spark portal (`products/kits-detailed`), kit-type rules mapped to appliances, and an audience selector.
- Spark visual identity: tokens, shell, cards, loader, and "Spark CRM — Powered by MicroPowerManager".
- Demo deployment on the spark-paygops VPS behind a shared edge proxy (`deploy/edge`), with daily database backups.

## Before production

- [ ] **File storage.**
  Uploaded files (customer documents) are written to the local `storage_data` Docker volume, which `deploy/spark/backup.sh` does not back up.
  Move them to a bucket.
  Google Cloud Storage works out of the box (`FILESYSTEM_DISK=gcs` plus the `GOOGLE_CLOUD_*` variables).
  S3/Cloudflare R2 would need `league/flysystem-aws-s3-v3` and an `endpoint` option on the `s3` disk.
- [ ] **Off-host backups.**
  Database dumps stay on the VPS in `/opt/spark-crm-backups`.
  Copy them to a bucket.
- [ ] **Database.**
  MySQL runs in a container on the VPS.
  For production, move it to a dedicated managed instance (not the portal's Cloud SQL).
- [ ] **E-mail.**
  No mail transport is configured, so password resets and notifications are not sent.
  Use Resend over SMTP.
- [ ] **Host firewall.**
  The VPS has none.
  Only 80/443/2233 are exposed today because nothing else publishes a port.
  Enable `ufw` for 2233/80/443, following the anti-lockout procedure.
- [ ] **Portal dependency.**
  Kit sync needs the portal's `products/kits-detailed` route deployed to production.
- [ ] **Locations.**
  Customers need villages (Locations → cluster → site → village) before addresses can be filled in.
  Bulk-load Spark's operating cities.

## Next

- [ ] GitHub Action: deploy to the VPS on push to `main`, using an SSH key restricted to `deploy.sh`.
- [ ] Dark mode: sweep the hardcoded colors in components, then add the dark token blocks.
- [ ] Laptop layouts: review screens that place two cards side by side (`md-size-50`) and stack them below wide monitors, as done for Appliances.

## Upstream candidates (EnAccess)

- Login with an empty e-mail returns 500: `UserDefaultDatabaseConnectionMiddleware` passes `null` to `DatabaseProxyManagerService::findByEmail()`.
- Dashboard map throws `Invalid LatLng` on the first load after login, because map settings are fetched after navigation.
- Horizon keeps about one worker per queue even when idle (~930 MB at rest). Grouping the queues under fewer supervisors would cut that.
