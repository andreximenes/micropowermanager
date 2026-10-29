# Legacy screens

Reference for rebuilding, in the React app (`src/web`), the screens of modules that Spark does not use today.
The Laravel backend (`src/backend`) is unchanged, so every endpoint listed here still exists.

## Where the legacy code lives

The legacy Vue 2 app (`src/frontend`) is deleted from the working tree but kept in git at the tag `legacy-vue-final`.

| Goal | Command |
| --- | --- |
| Read one file | `git show legacy-vue-final:src/frontend/src/<path>` |
| List a module's files | `git ls-tree -r --name-only legacy-vue-final -- src/frontend/src/modules/<x>` |
| Browse the whole app | `git worktree add /tmp/legacy-vue legacy-vue-final` |
| Clean up the worktree | `git worktree remove /tmp/legacy-vue` |

All Vue paths below are relative to `src/frontend/src/`.
All backend paths are relative to `src/backend/`.

## How modules are switched on

Each module below is a per-company switch in Settings > Modules.
The switches are stored in `main_settings.enabled_modules`, using the values of the enum `App\Enums\AppModule` (`app/Enums/AppModule.php`).
When a module is on, the menu shows a placeholder at `/modules/$moduleKey`, defined in `src/web/src/features/modules/routes.tsx`.
Rebuilding a module means replacing its nav entry in `src/web/src/legacy.ts` (the entries created with `moduleItem(...)`, which carry a `module` key) with the real route.

## Conventions used in the legacy code

These apply to every module and explain most of the code you will read.

- Requests go through `repositories/<X>Repository.js` (axios client in `repositories/Client/AxiosClient.js`), wrapped by `services/<X>Service.js`.
- `Helpers/ErrorHandler.js` throws in its constructor, so `return new ErrorHandler(...)` in a service actually throws.
- Paginated lists use `Helpers/Paginator.js` with the shared `shared/Widget.vue`; the paginator sends `page` and `per_page`.
- Widgets talk through a global `shared/eventbus.js` (`pageLoaded`, `widgetContentLoaded`, `searching`, `end_searching`, `loadPage`).
- Responses are wrapped as `{ data: ... }` (`ApiResource`); paginated responses carry Laravel's `current_page`, `last_page`, etc.
- Route permissions in the legacy UI come from `Helpers/PermissionGuard.js` (`/settings*`, `/tariffs*` and `/targets*` need `settings`).
- The tenant middleware (`app/Http/Middleware/UserDefaultDatabaseConnectionMiddleware.php`) resolves the company from the JWT on every web route.
  A route without `auth:api` therefore still needs a valid token, but any logged-in user of the company can call it regardless of permissions.

## Meters (`meters`)

Meters list and detail, and meter types.

### Legacy routes

| Path | Component |
| --- | --- |
| `/meters` | `modules/Meter/Meters.vue` |
| `/meters/:id` (`:id` is the serial number) | `modules/Meter/MeterDetail.vue` → `modules/Meter/Meter.vue` |
| `/meters-types` | `modules/MeterType/MeterTypes.vue` |

### Vue files

- `modules/Meter/Meter.vue` composes `Basic.vue` (owner, reassign owner), `Details.vue` (tariff, connection group/type, inline edit), `Readings.vue` (consumption chart, only when `meterType.online === 1`) and `Transactions.vue` (paginated tokens, only with `transactions` permission).
- `modules/Device/ManufacturerControl.vue` is embedded in the detail page.
- Services: `MeterService.js` (`Meters`, `Meter` list classes), `MeterDetailService.js`, `MeterConsumptionService.js`, `TransactionService.js` (`Transactions` class), `MeterTypeService.js`, `ManufacturerService.js`, `DeviceService.js`, `PersonService.js`, `TariffService.js`, `ConnectionGroupService.js`, `ConnectionTypeService.js`.
- Mixin `mixins/mappingStatus.js` renders `device.manufacturer_mapping_status`.

### API calls

All meter routes are in `routes/resources/Meters.php`.

| Method + path | Params / payload | Controller | Middleware |
| --- | --- | --- | --- |
| `GET /api/meters` | `page`, `per_page` (controller reads `limit`, `in_use`) | `MeterController@index` | none |
| `GET /api/meters/search` | `term`, `paginate` | `MeterController@search` | none |
| `GET /api/manufacturers` | `per_page`, `type` | `ManufacturerController@index` | `auth:api` |
| `GET /api/meters/{serial}` | — | `MeterController@show` (tariff, meter type, connection type/group, manufacturer, device.person, tokens.transaction) | none |
| `PUT /api/meters/{id}` | `id` (required), any of `tariff_id`, `connection_group_id`, `connection_type_id`, `meter_type_id`, `manufacturer_id`, `in_use`, `serial_number` (`UpdateMeterRequest`) | `MeterController@update` (logs a `NewLogEvent`) | none |
| `GET /api/meters/{serial}/transactions` | `page`, `per_page` | `MeterPaymentHistoryController@show` | none |
| `GET /api/meters/{serial}/consumptions/{start}/{end}` | dates `YYYY-MM-DD` | `MeterConsumptionController@show` | none |
| `PUT /api/devices/{deviceId}` | `id`, `person_id`, `device_id`, `device_type: "meter"`, `device_serial` (owner change from `Basic.vue`) | `DeviceController@update` | `auth:api` |
| `GET /api/people/search` | `term`, `paginate=0` (owner search) | `PersonController@search` | `permission:customers` |
| `GET /api/tariffs`, `GET /api/connection-groups`, `GET /api/connection-types` | dropdowns in `Details.vue` | see Tariffs / Connections | `permission:settings` |
| `GET /api/meter-types` | `limit` | `MeterTypeController@index` | none |
| `POST /api/meter-types` | `max_current`, `phase`, `online` (all required) | `MeterTypeController@store` | none |
| `PUT /api/meter-types/{id}` | `max_current`, `phase`, `online` | `MeterTypeController@update` | none (no UI calls it) |

Also present but unused by the legacy screens: `POST /api/meters`, `DELETE /api/meters/{id}`, `GET /api/meters/{serial}/revenue`, `PUT /api/meters` (bulk geo update), `GET /api/meters/{miniGrid}/geoList`, `GET /api/meter-types/{id}/list`.

### Bugs noticed

- `routes/resources/Meters.php`: no `auth:api` and no permission on any meter or meter-type route.
- `MeterController@destroy` only loads the meter and returns 204; it never deletes anything.
- `Meters.vue` `deleteMeter()` uses `resources.meters.delete` without importing `resources`; the method is unreachable (no button in the template).
- `Details.vue` loads tariffs when the user has `transactions`, but `GET /api/tariffs` requires `settings`, so users with only `transactions` get a 403.
- `Meter/Transactions.vue` computed `transactionType` is an arrow function using `this` (always undefined).
- `MeterTypeRepository.update()` puts to `/api/meter-types/${meterType}` with the whole object in the URL and no body.
- `MeterTypeService.prepareMeterType()` drops `phase` from the mapped object (it only appears in `name`).
- `MeterService.getMeterGeos/getMeterDetails/updateMeter` and `MeterParameterRepository` (`PUT /api/meters/{id}/parameters/`, no backend route) are dead code.
- The paginator sends `per_page` but `MeterController@index` reads `limit`, so the page size selector is ignored.

## Tariffs (`tariffs`)

Tariff list, create (modal), detail/edit with access rate, social tariff, additional cost components and time-of-usage (TOU) slots.

### Legacy routes

| Path | Component |
| --- | --- |
| `/tariffs` | `modules/Tariff/Tariffs.vue` (+ `modules/Tariff/Add.vue` panel) |
| `/tariffs/:id` | `modules/Tariff/Tariff.vue` |

### Vue files

- `modules/Tariff/Tariffs.vue`, `Add.vue`, `Tariff.vue`.
- `services/TariffService.js` (form state, TOU overlap detection `findConflicts`, `generateTimes`), `services/TimeOfUsageService.js`.
- Currency comes from the Vuex getter `settings/getMainSettings`.
- `TariffService` is also used outside this module by `modules/Client/Appliances/SellApplianceCard.vue` (`createNewShsTariff`, `changeTariffForSpecificMeter`), so the tariff endpoints stay in use even with the module off.

### API calls

All in `routes/api.php`, group `tariffs` with `auth:api` + `permission:settings`, controller `TariffController`.

| Method + path | Params / payload | Method |
| --- | --- | --- |
| `GET /api/tariffs` | `page`, `per_page` (controller reads `limit`) | `index` |
| `GET /api/tariffs/{id}` | — | `show` |
| `POST /api/tariffs` | `name`, `price`, `currency`, `factor`, `minimum_purchase_amount`, optional `components[] {name, price}`, `time_of_usage[] {id?, start, end, value}`, `social_tariff {id?, daily_allowance, price, initial_energy_budget, maximum_stacked_energy}`, `access_rate {id?, access_rate_amount, access_rate_period}` | `store` (201), sub-records via `app/Utils/TariffPriceCalculator.php` |
| `PUT /api/tariffs/{id}` | same as create plus `id` | `update` |
| `DELETE /api/tariffs/{id}` | — | `destroy` |
| `GET /api/tariffs/{id}/usage-count` | — | `showUsageCount` → `{ count }` |
| `PUT /api/tariffs/{id}/change-meters-tariff/{newId}` | — (moves all meters before delete) | `updateTariff` |
| `PUT /api/tariffs/{serial}/change-meter-tariff/{tariffId}` | — (used by appliance sales) | `updateForMeter` |
| `DELETE /api/time-of-usages/{id}` | — | `TimeOfUsageController@destroy`, `auth:api` only |

### Bugs noticed

- `TariffCreateRequest` validates `tous`, `access_rate_period` and `access_rate_amount` at top level, but the UI sends `time_of_usage` and a nested `access_rate`, so those parts are never validated.
- `Tariffs.vue` `showConfirmation()` fires `changeUsingMeterTariff()` and `deleteTariff()` without awaiting the first, so the delete can run before the meters are moved.
- `Tariff.vue`/`Add.vue`: removing a saved TOU row calls `DELETE /api/time-of-usages/{id}` immediately, even if the edit is then cancelled.
- `Add.vue` emits `tariffAdded` with `this.tariff`, which does not exist; `Tariffs.vue` and `Add.vue` register EventBus listeners (`tariffAdded`, `showNewTariff`) that are never removed.

## Connections (`connections`)

Connection groups and connection types, with sub connection types (each sub type is bound to a tariff).

### Legacy routes

| Path | Name | Component |
| --- | --- | --- |
| `/settings/connection-groups` | `connection-groups` | `modules/ConnectionGroups/ConnectionGroupsList.vue` (+ `NewConnectionGroup.vue`) |
| `/settings/connection-types` | `connection-types` | `modules/ConnectionTypes/ConnectionTypesList.vue` (+ `NewConnectionType.vue`) |
| `/settings/connection-types/:id` | `connection-type-detail` | `modules/ConnectionTypes/ConnectionTypeDetail.vue` |
| `/settings/connection-types/new` | `new-connection-types` | `modules/ConnectionTypes/NewConnectionType.vue` |

### Vue files

- The four components above.
- Services: `ConnectionGroupService.js`, `ConnectionTypeService.js` (also exports `ConnectionTypes`, `ConnectionsType`, `NumberOfCustomers` used by Targets), `SubConnectionTypeService.js`, `TariffService.js`.

### API calls

| Method + path | Params / payload | Controller | Middleware |
| --- | --- | --- | --- |
| `GET /api/connection-groups` | `per_page` | `ConnectionGroupController@index` | `auth:api`, `permission:settings` |
| `POST /api/connection-groups` | `name` (`CreateConnectionGroupRequest`) | `ConnectionGroupController@store` | same |
| `PUT /api/connection-groups/{id}` | whole object, `name` required | `ConnectionGroupController@update` | same |
| `GET /api/connection-types` | `limit` | `ConnectionTypeController@index` | `auth:api`, `permission:settings` |
| `POST /api/connection-types` | `name` (no FormRequest) | `ConnectionTypeController@store` | same |
| `GET /api/connection-types/{id}?meter_count=1` | — | `ConnectionTypeController@show` | same |
| `PUT /api/connection-types/{id}` | whole object (no FormRequest) | `ConnectionTypeController@update` | same |
| `GET /api/sub-connection-types/{connectionTypeId}` | `limit` | `SubConnectionTypeController@index` | `auth:api` only |
| `POST /api/sub-connection-types` | `name`, `connection_type_id`, `tariff_id` (all required) | `SubConnectionTypeController@store` | `auth:api` only |
| `PUT /api/sub-connection-types/{id}` | `name`, `tariff_id` | `SubConnectionTypeController@update` | `auth:api` only |
| `GET /api/tariffs` | tariff dropdown for sub types | `TariffController@index` | `permission:settings` |

### Bugs noticed

- `ConnectionGroupService.js` / `ConnectionTypeService.js`: checks like `if (!status === 200 && !status === 201)` are always false, so non-2xx statuses are never reported (axios rejects them anyway).
- `ConnectionGroupsList.vue` `updateConnectionGroup()` and `ConnectionTypeDetail.vue` `editConnectionTypeName()` call the service without `await`, so the success toast shows even when the request fails.
- Both list pages bind `:paginator="connectionGroups.paginator"` / `connectionTypes.paginator` on a plain array (undefined paginator), and subscribe to `searching`/`end_searching` with handlers that are not defined.
- `ConnectionTypeDetail.vue` `toggleEditSubConnectionType()` reads `this.editConnectionType` instead of `this.editSubConnectionType`.
- `NewConnectionGroup.vue` / `NewConnectionType.vue` emit `this.connectionGroup` / `this.connectionType`, which do not exist.
- `ConnectionTypeController@store/update` and `ConnectionGroupController@update` pass `$request->all()` to the service without validation.

## SMS (`sms`)

Conversation list per phone number, reply, bulk send, and the SMS tab of the settings page.

### Legacy routes

| Path | Name | Component |
| --- | --- | --- |
| `/sms/list` | `sms-list` | `modules/Sms/List.vue` |
| `/sms/newsms` | `new-sms` | `modules/Sms/NewSms.vue` |
| `/settings/configuration`, tab "Sms" | — | `modules/Settings/Configuration/SmsSettings.vue` |

SMS settings live in `modules/Settings/Configuration/`:

- `SmsSettings.vue`: three tabs.
  "Transaction Confirmation" holds the `transactionSmsEnabled` switch and the confirmation templates.
  "Reminder" embeds `SmsApplianceRemindRate.vue` and the reminder templates.
  "Resend Last Transaction" holds the resend keyword and its template.
- `SmsBody.vue`: one template editor with clickable `[variable]` tags and a live preview using default values.
- `SmsApplianceRemindRate.vue`: per appliance type, upcoming/overdue reminder rates (days), enable flags and `create_ticket`.
- The SMS gateway selector is in `MainSettings.vue` (Main tab), field `smsGatewayId`.

### Vue files

- `modules/Sms/List.vue`, `modules/Sms/NewSms.vue`, `shared/SmsDeliveryStatus.vue`, and the settings files above.
- Services: `SmsService.js`, `SmsBodiesService.js`, `SmsResendInformationKeyService.js`, `SmsVariableDefaultValueService.js`, `SmsApplianceRemindRateService.js`, `SmsGatewayService.js`, `MainSettingsService.js`, `MiniGridService.js`.
- `SmsService` is also used by the customer detail page and by Maintenance (`sendMaintenanceSms`).

### API calls

| Method + path | Params / payload | Controller | Middleware |
| --- | --- | --- | --- |
| `GET /api/sms` | `page`, `per_page`, `term` (number or customer name); grouped by receiver, 20 per page | `SmsController@index` | `auth:api` |
| `GET /api/sms/phone/{phone}` | — | `SmsController@byPhone` | `auth:api` |
| `GET /api/sms/search/{term}` | — (people search for receivers) | `SmsController@search` | `auth:api` |
| `POST /api/sms/storeandsend` | `message` (required), `phone` or `person_id`, `senderId`, `type` | `SmsController@storeAndSend` | `auth:api` |
| `POST /api/sms/bulk` | `type` (`person`/`group`/`type`/`all`), `receivers` (phones for `person`, selected items for `group`/`type`), `miniGrid` (0 = all), `message`, `senderId`; returns `{queued, failed, failed_receivers}` | `SmsController@storeBulk` | `auth:api` |
| `GET /api/sms/{personId}` | — (customer page) | `SmsController@show` | `auth:api` |
| `GET /api/mini-grids` | mini-grid filter for bulk | `MiniGridController@index` | `auth:api` |
| `GET /api/connection-groups`, `GET /api/connection-types` | receiver pickers for bulk | see Connections | `permission:settings` |
| `GET /api/sms-body` | — | `SmsBodyController@index` | none |
| `PUT /api/sms-body` | `[[{id, body, ...}]]` (array wrapped in an array; service reads index 0) | `SmsBodyController@update` | none |
| `GET /api/sms-resend-information-key` | — | `SmsResendInformationKeyController@index` | none |
| `PUT /api/sms-resend-information-key/{id}` | `id`, `key` | `SmsResendInformationKeyController@update` | none |
| `GET /api/sms-appliance-remind-rate` | — (appliance types with their rate; unconfigured types get a negative id) | `SmsApplianceRemindRateController@index` | none |
| `POST /api/sms-appliance-remind-rate` | `appliance_type_id`, `remind_rate`, `overdue_remind_rate`, `upcoming_reminder_enabled`, `overdue_reminder_enabled`, `create_ticket` | `SmsApplianceRemindRateController@store` | none |
| `PUT /api/sms-appliance-remind-rate/{id}` | same | `SmsApplianceRemindRateController@update` | none |
| `DELETE /api/sms-appliance-remind-rate/{id}` | — | `SmsApplianceRemindRateController@destroy` | none |
| `GET /api/sms-variable-default-value` | — | `SmsVariableDefaultValueController@index` | none |
| `GET /api/settings/sms-gateways` | — | `MainSettingsController@getAvailableSmsGateways` | `permission:settings` (no `auth:api`) |
| `PUT /api/settings/main/{id}` | `sms_gateway_id`, `transaction_sms_enabled` (plus the rest of main settings) | `MainSettingsController@update` | `auth:api`, `permission:settings` |

### Bugs noticed

- `routes/api.php`: the `sms-body`, `sms-resend-information-key`, `sms-appliance-remind-rate` and `sms-variable-default-value` groups have no `auth:api` and no permission, so any logged-in user can rewrite templates and reminder rates.
- `SmsController@resolveBulkPhoneNumbers` filters addresses by `city_id = miniGrid`, but the UI sends a mini-grid id.
- `SmsController@resolveBulkPhoneNumbers` does `where('id', $receivers)` with the receivers array (objects from the UI) instead of `whereIn` on their ids.
- `SmsController@show` passes address rows (`[{phone, owner_id}]`) to `whereIn('receiver', ...)` instead of a list of phones, and fails on an unknown person id.
- `SmsController@search` chains `orWhere(name/surname)` after `whereHas(addresses)` without grouping, so name matches without a primary phone are returned with no phone.
- `SmsBody.vue` `validateBody()` validates scope `this.tabName`, which is not defined.

## E-bikes (`e-bikes`)

E-bike list, add, and a detail modal with telemetry and a remote on/off switch.

### Legacy routes

| Path | Component |
| --- | --- |
| `/e-bikes` (optional `?serialNumber=` opens the detail modal) | `modules/EBikes/EBikes.vue` |

### Vue files

- `modules/EBikes/EBikes.vue`, `AddEBikeModal.vue`, `EBikeDetailModal.vue`, `shared/Box.vue`.
- Services: `EBikeService.js`, `ManufacturerService.js` (filtered to `type === "e-bike"`), `ApplianceService.js` (filtered to appliance type id `2`, hardcoded).

### API calls

All in group `e-bikes` with `auth:api` only, controller `EBikeController`.

| Method + path | Params / payload | Method |
| --- | --- | --- |
| `GET /api/e-bikes` | `page`, `per_page` | `index` |
| `GET /api/e-bikes/search` | `term`, `paginate` | `search` |
| `GET /api/e-bikes/{serial}` | — (status contains `ACCON` when on) | `show` |
| `POST /api/e-bikes` | `serial_number` (8–15 chars, unique in `devices.device_serial`), `manufacturer_id`, `appliance_id` (`StoreEBikeRequest`) | `store` (creates the device too) |
| `POST /api/e-bikes/switch` | `serial_number`, `manufacturer_name`, `status` (boolean) | `switch` (calls the manufacturer API, logs a `NewLogEvent`) |
| `GET /api/manufacturers`, `GET /api/appliances` | dropdowns | `ManufacturerController@index`, `ApplianceController@index` (`permission:appliances`) |

### Bugs noticed

- `EBikeRepository.update()` (`PUT /api/e-bikes/{id}`) and `delete()` (`DELETE /api/e-bikes/{id}`) have no backend route; they are unused by the UI.
- `EBikeController@switch` resolves `$manufacturer->api_name` and calls `switchDevice()`, which only `app/Plugins/DalyBms/Modules/Api/DalyBmsApi.php` implements; any other manufacturer fails with a fatal error.
- `EBikeController@store` creates the e-bike and the device in separate steps without a transaction.
- `AddEBikeModal.vue` hardcodes `APPLIANCE_TYPE_ID = 2`.

## Targets (`targets`)

Revenue and connection targets per mini-grid or cluster, split by connection group.

### Legacy routes

| Path | Name | Component |
| --- | --- | --- |
| `/targets` | `target-list` | `modules/Target/TargetList.vue` |
| `/targets/new` | `new-target` | `modules/Target/NewTarget.vue` |

### Vue files

- `modules/Target/TargetList.vue`, `modules/Target/NewTarget.vue`.
- Services: `TargetService.js` (`Targets`, `Target`, `SubTarget`), `ConnectionTypeService.js` (`ConnectionTypes`, `NumberOfCustomers`), `CityService.js`.
- `modules/MiniGrid/TargetList.vue` (revenue vs target per period) is not imported anywhere.

### API calls

| Method + path | Params / payload | Controller | Middleware |
| --- | --- | --- | --- |
| `GET /api/targets` | `page`, `per_page` (controller reads `limit`) | `TargetController@index` | `auth:api`, `permission:settings` |
| `POST /api/targets` | `period` (date), `targetForType` (`mini-grid`/`cluster`), `targetForId`, `data[] {id, target: {totalRevenue, newConnection, connectedPower, energyPerMonth, averageRevenuePerMonth}}` | `TargetController@store` → `SubTargetService::create` | same |
| `GET /api/connection-groups?paginate=1` | rows of the target form | `ConnectionGroupController@index` | `permission:settings` |
| `GET /api/meters/connection-types` | current customers per connection type | `MeterController@showConnectionTypes` | none |
| `GET /api/mini-grids` / `GET /api/clusterlist` | target owner picker | `MiniGridController@index` / `ClusterController@index` | `auth:api` / none |

Also present but unused: `GET /api/targets/{id}`, `POST /api/targets/slots` (`date`).

### Bugs noticed

- Sub targets are stored against connection **groups** (`SubTarget::connectionType()` belongs to `ConnectionGroup`, see the FIXME in `app/Models/SubTarget.php`), but `NewTarget.vue` shows "current customers" from `GET /api/meters/connection-types`, which counts meters per connection **type** and is matched by id, so the numbers are wrong.
- `ConnectionTypes.getConnectionTypes()` in `ConnectionTypeService.js` actually fetches connection groups (`resources.connections.list`), which is what makes the form work, despite the name.
- `GET /api/clusterlist` has no `auth:api`.

## Maintenance (`maintenance`)

Create an outsourced maintenance ticket for a maintenance person (non-customer), and register new maintenance people.

### Legacy routes

| Path | Name | Component |
| --- | --- | --- |
| `/maintenance` | `maintenance` | `modules/Maintenance/Maintenance.vue` (+ `NewUser.vue` dialog) |

### Vue files

- `modules/Maintenance/Maintenance.vue`, `NewUser.vue`, `shared/CityAutocomplete.vue`, `shared/RedirectionModal.vue` (sends to `/locations/add-mini-grid` when there is no mini-grid).
- Services: `MaintenanceService.js`, `TicketService.js`, `SmsService.js`, `MiniGridService.js`.

### API calls

| Method + path | Params / payload | Controller | Middleware |
| --- | --- | --- | --- |
| `GET /api/maintenance` | — (maintenance people) | `MaintenanceUserController@index` | `auth:api` |
| `POST /api/maintenance/user` | `name`, `surname` (min 3), `phone` (required, starts with `+`, min 11), `city_id`, `mini_grid_id`, `gender`, `customer_type: "maintenance"` (`MaintenanceRequest`) | `MaintenanceUserController@store` | `auth:api` |
| `GET /api/tickets/labels` | — (UI keeps categories with `out_source === 1`) | `TicketCategoryController@index` | `auth:api`, `permission:tickets` |
| `POST /api/tickets/ticket` | `creator`, `dueDate`, `label` (category id), `outsourcing` (amount), `description`, `title`, `owner_id` (maintenance person), `owner_type: "person"`, `creator_type: "admin"` | `TicketCustomerController@store` (`routes/resources/TicketWeb.php`) | `auth:api`, `permission:tickets` |
| `POST /api/sms/storeandsend` | `person_id`, `message` (description + amount + due date), `senderId` | `SmsController@storeAndSend` | `auth:api` |
| `GET /api/mini-grids` | — | `MiniGridController@index` | `auth:api` |

### Bugs noticed

- `/api/maintenance` routes have no permission check.
- `Maintenance.vue` `submitMaintainForm()` resets `maintenanceData` to an object without `creator`, so a second ticket in the same visit is sent without a creator.
- Ticket creation and the SMS are two independent calls; if the SMS fails the user sees an error although the ticket was created.
- EventBus listeners `newUserClosed` and `getLists` are never removed.

## Mini-grids (`mini-grids`)

Clusters overview dashboard, cluster detail dashboard and site (mini-grid) dashboard, all fed by a server-side cache.

### Legacy routes

| Path | Name | Component |
| --- | --- | --- |
| `/` (redirects to `/clusters`) | `cluster-list-dashboard` | — |
| `/clusters` | `cluster-list` | `modules/Dashboard/ClustersOverview.vue` |
| `/clusters/:id` | `cluster-detail` | `modules/Cluster/ClusterDetail.vue` |
| `/dashboards/mini-grid` | — | `modules/MiniGrid/MiniGridOverviewPage.vue` (redirects to the first mini-grid) |
| `/dashboards/mini-grid/:id` | — | `modules/MiniGrid/Dashboard.vue` |

### Vue files

- Clusters overview: `modules/Dashboard/ClustersOverview.vue`, `Dashboard/BoxGroup.vue`, `Dashboard/FinancialOverview.vue`, `modules/Map/DashboardMap.vue`.
- Cluster detail: `modules/Cluster/ClusterDetail.vue`, `Cluster/BoxGroup.vue`, `Cluster/RevenueTrends.vue`, `Dashboard/FinancialOverview.vue`, `modules/Map/ClusterMap.vue` (also edit/delete cluster).
- Site: `modules/MiniGrid/Dashboard.vue`, `MiniGrid/BoxGroup.vue`, `RevenuePerCustomerType.vue`, `RevenueTargetPerCustomerType.vue`, `RevenueTrends.vue`, `TicketsOverview.vue`, `modules/Map/MiniGridMap.vue` (also edit/delete mini-grid, relocate devices).
- Store modules: `store/modules/clusterDashboard.js`, `store/modules/miniGridDashboard.js`.
- Services: `ClustersDashboardCacheDataService.js`, `MiniGridDashboardCacheDataService.js`, `ClusterService.js`, `MiniGridService.js`, `MiniGridDeviceService.js`, `BatchRevenueService.js` (chart shaping only), `DeviceAddressService.js`, `MappingService.js`.
- Not imported anywhere: `Cluster/RevenueAnalysis.vue`, `Cluster/UserList.vue`, `MiniGrid/TargetList.vue`.

### API calls

| Method + path | Params / payload | Controller | Middleware |
| --- | --- | --- | --- |
| `GET /api/dashboard/clusters` | — (builds the cache when empty) | `ClustersDashboardCacheDataController@index` | `auth:api` |
| `PUT /api/dashboard/clusters` | optional `from`, `to` query | `ClustersDashboardCacheDataController@update` (recomputes the cache) | `auth:api` |
| `GET /api/dashboard/mini-grids` | — | `MiniGridDashboardCacheController@index` | `auth:api` |
| `PUT /api/dashboard/mini-grids` | optional `from`, `to` query | `MiniGridDashboardCacheController@update` | `auth:api` |
| `GET /api/clusters/revenue` | `period` (`monthly`), `startDate`, `endDate` | `ClusterRevenueController@index` | `auth:api` |
| `GET /api/clusters` | — | `ClusterController@index` | `auth:api` |
| `GET /api/clusters/{id}/geo` | — | `ClusterController@showGeo` | `auth:api` |
| `PUT /api/clusters/{id}` / `DELETE /api/clusters/{id}` | `UpdateClusterRequest`: `name`, `manager_id`, `geo_json` | `ClusterController@update` / `destroy` | `auth:api`, `permission:settings` |
| `GET /api/mini-grids` | — | `MiniGridController@index` | `auth:api` |
| `GET /api/mini-grids/{id}?relation=1` | — | `MiniGridController@show` | `auth:api` |
| `PUT /api/mini-grids/{id}` / `DELETE /api/mini-grids/{id}` | `UpdateMiniGridRequest`: `name`, `cluster_id`, `geo_json` | `MiniGridController@update` / `destroy` | `auth:api`, `permission:settings` |
| `GET /api/mini-grids/{id}/devices` | — | `MiniGridDeviceController@index` | `auth:api` |
| `POST /api/devices/geoinformation/` | edited device positions | `DeviceController@updateGeoInformation` | `auth:api` |

Also present but unused: `GET /api/dashboard/clusters/{id}`, `GET /api/dashboard/mini-grids/{id}`, `POST /api/mini-grids/{id}/transactions` and `/energy` (both `MiniGridRevenueController@show`, called only by dead methods in `MiniGrid/BoxGroup.vue`), `GET /api/clusters/{id}/revenue`, `/revenue/analysis`, `/cities-revenue`, `POST /api/revenue`, `/revenue/trends/{id}`, `GET /api/revenue/tickets/{id}`.
The cache is refreshed daily by `app/Console/Commands/ClustersDashboardCacheDataGenerator.php` and kept for one day.

### Bugs noticed

- `MiniGrid/Dashboard.vue` `getMiniGridData()` dispatches `miniGridDashboard/update` (full recompute for every mini-grid) on every page load, with no try/catch, so a failure leaves the loader on.
- The dashboard cache is one entry per company (`AbstractDashboardCacheDataService::cacheKeyGenerator`), so a period chosen on the site dashboard (`PUT ...?from=&to=`) overwrites the data every other user sees.
- `AbstractDashboardCacheDataService::cacheKeyGenerator()` derives the company id from the first user's email instead of the request's company.
- `GET /api/dashboard/{clusters,mini-grids}/{id}`: `getDataById()` treats cached DTOs as arrays (`$data['id']`), and the controllers then `array_map` the single result as if it were a list.
- `MiniGrid/Dashboard.vue` listens to `getEditedGeoDataItems` (nothing emits it), calls an undefined `updateEditedMeters()`, treats any swal result as confirmation, and never removes the listener.
- `MiniGrid/Dashboard.vue` reloads the whole browser page (`this.$router.go()`) on every route change.
- `MiniGrid/BoxGroup.vue` defines `getTransactionsOverview`/`getSoldEnergy` that are never called and use `alertNotify` without the `notify` mixin.

## Plugins Spark does not use

Each folder below is a legacy Vue plugin under `src/frontend/src/plugins/`; its backend counterpart lives under `src/backend/app/Plugins/<Name>`.
`spark-shs` is not listed because it is rebuilt in the new app.

| Folder | What it is | Main legacy route(s) |
| --- | --- | --- |
| `plugins/africas-talking` | SMS gateway (Africa's Talking) | `/africas-talking/africas-talking-overview` |
| `plugins/angaza-shs` | SHS manufacturer (Angaza) | `/angaza-shs/angaza-overview` |
| `plugins/bulk-registration` | CSV bulk import of customers and devices | `/bulk-registration/bulk-registration` |
| `plugins/calin-meter` | Meter manufacturer (Calin) | `/calin-meters/calin-overview` |
| `plugins/calin-smart-meter` | Meter manufacturer (Calin smart) | `/calin-smart-meters/calin-smart-overview` |
| `plugins/chint-meter` | Meter manufacturer (Chint) | `/chint-meters/chint-overview` |
| `plugins/daly-bms` | E-bike battery management (Daly BMS), backs the e-bike switch | `/daly-bms/daly-bms-overview` |
| `plugins/ecreee-e-tender` | Data integration (ECREEE e-tender) | `/ecreee-e-tender/overview` |
| `plugins/flutterwave-payment-provider` | Payment provider (Flutterwave) with public payment page | `/flutterwave/overview`, `/flutterwave/public/payment/:companyHash` |
| `plugins/gome-long-meter` | Meter manufacturer (GomeLong) | `/gome-long-meters/gome-long-overview` |
| `plugins/kelin-meter` | Meter manufacturer (Kelin), with customers, meters, consumptions | `/kelin-meters/kelin-overview`, `/kelin-meters/kelin-meter` |
| `plugins/micro-star-meter` | Meter manufacturer (MicroStar) | `/micro-star-meters/micro-star-overview` |
| `plugins/odyssey-data-export` | Data export (Odyssey) | `/odyssey-data-export/overview` |
| `plugins/paystack-payment-provider` | Payment provider (Paystack) with public payment page | `/paystack/overview`, `/paystack/public/payment/:companyHash` |
| `plugins/pesapal-payment-provider` | Payment provider (PesaPal) with public payment page | `/pesapal/overview`, `/pesapal/public/payment/:companyHash` |
| `plugins/prospect` | Data export (Prospect platform) | `/prospect/prospect-overview` |
| `plugins/safaricom-ke-payment-provider` | Payment provider (Safaricom M-PESA, STK push) | `/safaricom-ke-overview/overview` |
| `plugins/sms-transaction-parser` | Parses mobile money SMS into transactions | `/sms-transaction-parser/overview` |
| `plugins/spark-meter` | Meter manufacturer (SparkMeter) with sites, meter models, tariffs, customers | `/spark-meters/sm-overview` |
| `plugins/steama-meter` | Meter manufacturer (SteamaCo) with sites, customers, agents | `/steama-meters/steama-overview` |
| `plugins/stron-meter` | Meter manufacturer (Stron) | `/stron-meters/stron-overview` |
| `plugins/sun-king-shs` | SHS manufacturer (SunKing) | `/sun-king-shs/sun-king-overview` |
| `plugins/swifta-payment-provider` | Payment provider (Swifta) | `/swifta-payment/swifta-payment-overview` |
| `plugins/textbee-sms-gateway` | SMS gateway (TextBee, Android phone) | `/textbee-sms-gateway/textbee-sms-gateway-overview` |
| `plugins/viber-messaging` | Messaging gateway (Viber) | `/viber-messaging/viber-overview` |
| `plugins/vodacom-mz-payment-provider` | Payment provider (Vodacom M-Pesa Mozambique) | `/vodacom-mz/overview` |
| `plugins/wave-money-payment-provider` | Payment provider (WaveMoney) with payment page | `/wave-money/wave-money-overview` |
| `plugins/wavecom-payment-provider` | Payment provider (Wavecom, Senegal), transaction file upload | `/wavecom/transactions` |

`MesombPaymentProvider`, `DemoMeterManufacturer` and `DemoShsManufacturer` exist only in the backend and had no legacy screen.

## Out of scope

The agent-performance dashboard (`/dashboards/agent-performance`, `modules/Dashboard/AgentPerformanceDashboard.vue`) is covered by the new Dashboard and is not described here.
