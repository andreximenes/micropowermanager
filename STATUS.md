# Spark CRM status

Spark CRM is this fork of MicroPowerManager, branded for Spark and deployed at <https://crm.sparkenergy.io> (see `deploy/spark/README.md`).
This file tracks what the fork adds and what is still pending.
Upstream's own plans live in `docs/roadmap.md`.
The reasoning behind the fork's choices, and the decisions still open, live in [`DECISIONS.md`](DECISIONS.md).

## Done

- Spark SHS plugin: opt-in kit sync from the Spark portal (`products/kits-detailed`), kit-type rules mapped to appliances, and an audience selector.
- Spark visual identity: tokens, shell, cards, loader, and "Spark CRM — Powered by MicroPowerManager".
- Spark kit components: the sync stores each kit's screen and batteries, and the solar home system screen lists them for Spark kits only (ADR-015).
- Demo deployment on the spark-paygops VPS behind a shared edge proxy (`deploy/edge`), with daily database backups.

## Frontend redesign

`src/web` is the React app that replaced the upstream Vue app, responsive from phone to desktop.
The Vue app was removed; it is preserved at git tag `legacy-vue-final` and indexed in `LEGACY_SCREENS.md`.
Merged into `main` on 2026-10-30; the VPS still runs `spark/redesign` (same commit) until it is switched to `main`.

- [x] Wave 0: foundation, customer profile, Sell product panel, tests (85% floor), `web-dev` service.
- [x] Wave 1, customers: list and search, create and edit (address on a map), contract detail with payments.
- [x] Wave 2, money: transactions list and detail.
- [x] Wave 3, products: appliances, Solar Home Systems, the Spark SHS plugin screen.
- [x] Wave 4, operations: tickets, agents and commissions, dashboard, reports.
- [x] Wave 5, administration: settings, users and roles, profile, locations, import, password reset.
- [x] Module switches in Settings for what Spark does not use (meters, tariffs, connections, SMS, e-bikes, targets, maintenance, mini-grids); switched-on modules show a placeholder until their screen is rebuilt.
- [x] Legacy Vue app removed.

Bugs found while redesigning are recorded, not fixed, in `LEGACY_BUGS.md`.

### Merging upstream after the Vue removal

Upstream still ships `src/frontend`.
When merging `upstream/main`, every upstream change to it shows as a modify/delete conflict: keep it deleted (`git rm -r src/frontend` before committing the merge).
The backend's plugin generator still writes a Vue module under `src/frontend/src/plugins/`; delete that output and build the plugin's screen in `src/web`.

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
- A failed token generation rolls back the payment histories but not the installments' `remaining` (`ApplianceInstallmentPayer::paidRates` is never filled on that path, so `TokenProcessor`'s rollback has nothing to restore).
- A payment against a contract whose device is a meter goes through `EnergyTransactionProcessor`, which only pays overdue loans without a device serial, so the contract's own installments are not paid down.
- Changing the plan of an unpaid contract drops the down payment: explained, with the proposed fix, in [LEGACY_BUGS.md](LEGACY_BUGS.md) (pending a decision).
- Recording a payment has no idempotency key: if the POST commits but the response is lost, a retry records a second payment (and token). Send an `Idempotency-Key` per attempt and dedupe in `AppliancePaymentController::store`.
- Horizon keeps about one worker per queue even when idle (~930 MB at rest). Grouping the queues under fewer supervisors would cut that.
