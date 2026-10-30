# Spark CRM decisions

Architectural decisions for Spark CRM, this fork of MicroPowerManager.
Each entry records why the fork works the way it does, or what is still to be decided.
Progress on the work itself is tracked in [`STATUS.md`](STATUS.md).

The production host is not chosen yet.
<https://crm.sparkenergy.io> on the `spark-paygops` VPS is a demo, so the proposed decisions below are written to hold wherever the CRM is finally deployed.

| ADR | Decision | Status |
| --- | --- | --- |
| [001](#adr-001-react-spa-replaces-the-vue-app) | React SPA replaces the Vue app | Accepted |
| [002](#adr-002-public-fork-with-backend-only-upstream-contributions) | Public fork with backend-only upstream contributions | Accepted |
| [003](#adr-003-merging-upstream-after-the-vue-removal) | Merging upstream after the Vue removal | Accepted |
| [004](#adr-004-the-redesign-does-not-change-behaviour) | The redesign does not change behaviour | Accepted |
| [005](#adr-005-file-storage-in-an-object-bucket) | File storage in an object bucket | Proposed |
| [006](#adr-006-off-host-database-backups) | Off-host database backups | Proposed |
| [007](#adr-007-managed-database) | Managed database | Proposed |
| [008](#adr-008-transactional-e-mail-through-resend) | Transactional e-mail through Resend | Proposed |
| [009](#adr-009-kit-sync-depends-on-the-portals-kits-detailed-route) | Kit sync depends on the portal's `kits-detailed` route | Accepted, rollout pending |
| [010](#adr-010-bulk-load-of-operating-locations) | Bulk load of operating locations | Proposed |
| [011](#adr-011-spark-shs-local-api-urls-only-in-development) | Spark SHS local API URLs only in development | Accepted, review pending |
| [012](#adr-012-continuous-deployment-from-main) | Continuous deployment from `main` | Proposed |
| [013](#adr-013-dark-mode-through-design-tokens) | Dark mode through design tokens | Proposed |
| [014](#adr-014-stacked-layouts-below-wide-monitors) | Stacked layouts below wide monitors | Proposed |

## ADR-001 React SPA replaces the Vue app

**Status:** Accepted (2026-10-28).

**Context.**
The upstream tenant UI is Vue 2, which is long deprecated.
Spark CRM needs a responsive UI, from phone to desktop, in Spark's visual identity.

**Decision.**
`src/web` is a React SPA built with Vite, TypeScript and Tailwind v4.
It uses TanStack Router and TanStack Query, react-hook-form with zod, and `@spark/ui` and `@spark/design-tokens` vendored from spark-apps-hub.
Laravel stays the API; there is no server-side rendering layer such as Next.js.
The Vue app (`src/frontend`) was removed and is preserved at git tag `legacy-vue-final`, indexed in [`LEGACY_SCREENS.md`](LEGACY_SCREENS.md).

**Consequences.**
Every tenant screen lives in `src/web`.
A screen that exists only in the Vue app is rebuilt from the legacy tag, not restored.

## ADR-002 Public fork with backend-only upstream contributions

**Status:** Accepted.

**Context.**
The fork contributes fixes back to EnAccess MicroPowerManager, so the repository stays public.

**Decision.**
Contributions to upstream are backend and plugin code.
The React app is Spark-specific and is not proposed upstream.
Licensed assets never enter the repository: the heading font loads from `VITE_HEADING_FONT_URL`, set outside git.

**Consequences.**
Anything committed is public, so secrets, licensed files and customer data stay out of the tree.
Upstream candidates are collected in [`STATUS.md`](STATUS.md) and [`LEGACY_BUGS.md`](LEGACY_BUGS.md).

## ADR-003 Merging upstream after the Vue removal

**Status:** Accepted.

**Context.**
Upstream still ships `src/frontend`, which the fork deleted (ADR-001).

**Decision.**
When merging `upstream/main`, every upstream change to `src/frontend` is resolved by keeping it deleted (`git rm -r src/frontend` before committing the merge).
The backend's plugin generator still writes a Vue module under `src/frontend/src/plugins/`; that output is deleted and the plugin's screen is built in `src/web`.

**Consequences.**
Upstream merges carry predictable modify/delete conflicts.
Upstream UI changes have to be ported to `src/web` by hand when they matter to Spark.

## ADR-004 The redesign does not change behaviour

**Status:** Accepted.

**Context.**
The redesign touches every screen, which makes it tempting to fix behaviour along the way.
Mixing both makes the redesign hard to review and hard to compare with upstream.

**Decision.**
The redesign changes the UI only.
Backend changes are additive at most.
Bugs found while redesigning are recorded in [`LEGACY_BUGS.md`](LEGACY_BUGS.md), not fixed in the same change.

**Consequences.**
Known bugs ship with the redesign until they are fixed in their own change, here or upstream.

## ADR-005 File storage in an object bucket

**Status:** Proposed.

**Context.**
Uploaded files, such as customer documents, are written to a local Docker volume (`storage_data`).
The database backup does not include it, and a host failure would lose them.

**Options.**

- Google Cloud Storage: supported today with `FILESYSTEM_DISK=gcs` and the `GOOGLE_CLOUD_*` variables.
- S3-compatible storage, such as Cloudflare R2: needs `league/flysystem-aws-s3-v3` and an `endpoint` option on the `s3` disk.

**Open questions.**
The choice depends on where the CRM is finally hosted and on which cloud Spark already pays for.

## ADR-006 Off-host database backups

**Status:** Proposed.

**Context.**
`deploy/spark/backup.sh` dumps every database (the central one plus one per company) daily and keeps 7 days, on the same host as the database.
A host loss would take the backups with it.

**Decision proposed.**
Copy every dump to an object bucket after it is written, ideally the same provider chosen in ADR-005, with its own retention.

**Open questions.**
Retention period, and whether a managed database (ADR-007) makes these dumps a second line of defence instead of the only one.

## ADR-007 Managed database

**Status:** Proposed.

**Context.**
MySQL runs in a container next to the application.

**Decision proposed.**
Production uses a dedicated managed MySQL instance.
It is not the Spark portal's Cloud SQL, so the two systems do not share load, credentials or failure.

**Open questions.**
Provider and region follow the hosting decision.

## ADR-008 Transactional e-mail through Resend

**Status:** Proposed.

**Context.**
No mail transport is configured (`MAIL_MAILER` defaults to `log`), so password resets and notifications are never sent.

**Decision proposed.**
Send through Resend over SMTP, which needs only Laravel's built-in SMTP mailer and environment variables.

**Open questions.**
The sending domain and its DNS records (SPF, DKIM).

## ADR-009 Kit sync depends on the portal's `kits-detailed` route

**Status:** Accepted, rollout pending.

**Context.**
The Spark SHS plugin syncs kits from the Spark portal and maps kit types to appliances.

**Decision.**
The sync reads the portal's `products/kits-detailed` route.
It is opt-in per company.

**Consequences.**
Kit sync only works in production once that route is deployed to the portal's production environment.

## ADR-010 Bulk load of operating locations

**Status:** Proposed.

**Context.**
A customer address needs a village, and villages sit in the Locations hierarchy (cluster → site → village).
With no locations loaded, addresses cannot be filled in.

**Decision proposed.**
Bulk-load Spark's operating cities before customers are created, instead of creating them one by one in the UI.

**Open questions.**
The source of the location list, and whether the existing import screen covers the hierarchy or a one-off seeder is needed.

## ADR-011 Spark SHS local API URLs only in development

**Status:** Accepted, review pending.

**Context.**
The Spark SHS plugin calls a portal URL that each company enters, which is a server-side request forgery risk.
By default `SparkShsApiClient::assertSafeUrl` only accepts HTTPS URLs and refuses hosts that resolve to private or reserved IP ranges.
Local development needs to reach the portal at `http://host.docker.internal`.

**Decision.**
`SPARK_SHS_ALLOW_LOCAL_API_URLS` (config `spark-shs.allow_local_api_urls`, default `false`) relaxes both checks.
It is set only in the local `.env.override.micropowermanager-backend`.
`deploy/spark/deploy.sh` refuses to deploy a clone that contains that file.

**Open questions.**
The flag is still enabled locally; remove it when the portal integration is done.
The security review of the guard and its flag has not been done yet and is required before the guard counts as finished.

## ADR-012 Continuous deployment from `main`

**Status:** Proposed.

**Context.**
Deploying today means running `deploy/spark/deploy.sh` on the host by hand.

**Decision proposed.**
A GitHub Action deploys on every push to `main`.
It connects over SSH with a key restricted, through a forced command, to running the deploy script, so a leaked key cannot open a shell.

**Open questions.**
The target follows the hosting decision; the restricted-key approach holds for any host reached over SSH.

## ADR-013 Dark mode through design tokens

**Status:** Proposed.

**Context.**
The UI ships a light theme only.
Some components still use hardcoded colours, which a dark theme would not reach.

**Decision proposed.**
First replace hardcoded colours in components with design tokens.
Then add the dark token blocks, so the theme switches by tokens alone.

## ADR-014 Stacked layouts below wide monitors

**Status:** Proposed.

**Context.**
Screens that place two cards side by side (`md-size-50`) are cramped on laptop screens.

**Decision proposed.**
Stack those cards below wide-monitor widths, as the Appliances screen already does.
