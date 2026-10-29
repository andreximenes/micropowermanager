# Legacy bugs

Bugs inherited from upstream MicroPowerManager that Spark CRM has found but not fixed yet.
Each entry says what goes wrong, why, and the proposed fix.
An entry stays here until someone decides to fix it, then moves to a commit (and, when it applies upstream, to a pull request to EnAccess).

## Changing the plan of an unpaid contract drops the down payment

**Status:** pending a product decision.

### What happens

A Solar Home System is sold for 100,000 with a 10,000 down payment and 12 monthly installments of 7,500.
The down payment is stored as the first rate of the schedule, due on the sale day.
Before the customer pays anything, someone opens **Change plan** and reschedules into 10 monthly installments.

The backend deletes every unpaid rate, the down payment included, and splits the whole 100,000 into 10 installments of 10,000.
The contract no longer has a down payment: the customer takes the product home without paying anything up front.

The same happens without rescheduling.
Changing only the total spreads the new outstanding amount across every unpaid rate, so the down payment rate changes value like any other installment.

### Why

`ApplianceRateService::recomputeRatesFromTotalCost` (`src/backend/app/Services/ApplianceRateService.php`) treats every rate with `rate_cost === remaining` as an ordinary unpaid installment:

- `regenerateUnpaidRates` deletes all of them and generates a new schedule for the full outstanding amount.
- `redistributeAcrossUnpaidRates` spreads the outstanding amount across all of them.

An unpaid down payment matches that condition, so it is deleted or resized.

The single-installment edit already protects it: `AppliancePaymentService::isOutstandingDownPaymentRate` makes `PUT /api/appliances/rates/{rate}` refuse to change the down payment ("The down payment agreed at the sale cannot be modified").
The plan change does not use that check.

### Proposed fix

Keep the outstanding down payment out of the recomputation, as the installment edit already does:

1. In `recomputeRatesFromTotalCost`, take the outstanding down-payment rate (`isOutstandingDownPaymentRate`) out of `$unpaidRates`, and subtract its `remaining` from `$newOutstanding`.
2. Leave that rate untouched in both paths, so it keeps its amount and due date.
3. Anchor regenerated installments after the down payment's due date, so the new schedule starts where the old one did.
4. Count it in `rate_count` together with the rates that are kept.
5. Reject a new total lower than the amount already paid plus the outstanding down payment, with a clear message.
6. Mirror the rule in the new app's **Change plan** preview (`src/web/src/features/contract/schedule.ts`), which today previews the backend's current behaviour.
7. Cover it with tests in `tests/Feature/AppliancePersonTotalCostUpdateTest.php`: reschedule and total-only change with an unpaid down payment, and the same after the down payment is paid (no change in behaviour).

If the down payment itself must be renegotiated, that should be its own explicit action, not a side effect of changing the plan.

### Alternative

Keep today's behaviour and say so in the **Change plan** panel ("The down payment is included in the new installments"), so whoever reschedules knows the down payment goes away.

## Found while redesigning tickets, agents, dashboard and reports

**Status:** recorded only; the new screens work around them.
Paths are under `src/backend/`.

### Tickets

- The ticket list reads `limit` (default 5) and ignores `per_page` (`TicketController.php:18`).
  Fix: read `per_page`, keep `limit` as a fallback.
- Assignees are compared by the wrong id.
  The `person` filter (`TicketController.php:15`) and `assignedPerson` on create (`UserTicketCreateRequest.php:19,50`) pass a user id, but `tickets.assigned_id` points to `ticket_users.id`, and `assignedPerson` has no exists check.
  Fix: accept the user id and map it to its ticket user, with an exists rule.
- `TicketUserService.php:33` filters on `users.out_source`, which does not exist; `TicketCategoryService.php:30` computes the outsource filter and discards it.
- Comments are loaded one query per ticket in `TicketService.php:130` (`getBatch`).
- Closing a ticket answers `{data:{data:…}}`; posting a comment (`TicketCommentController.php:14`) and adding an external person (`TicketUserController.php:25`) answer an empty 200, and the comment input is not validated.
- `ticket_users.user_name` is unique but not validated, so a duplicate name is a 500; an unknown `label` id on create is a 500.
- An outsourced ticket created without an amount stores 0, and the ticket and its outsource row are written without a transaction (`TicketCustomerController.php:41-45`).
- Customer tickets are fixed at 5 per page.
- `/tickets/users`, `/tickets/users/external` and `/tickets/user/{id}` have no `permission:tickets` (`routes/resources/TicketWeb.php:22-23,36`).
- External ticket people are created but never listed by `/tickets/users`, so they cannot be assigned.
- The outsourced-ticket SMS is sent by the legacy Maintenance screen, not by the backend, so tickets created elsewhere never send it.
- `TicketUserController::store` has no route.

### Agents

- Agent routes have no permission middleware, and there is no `agents` permission (`routes/resources/AgentWeb.php:15`).
- Creating an agent treats `city_id` as the mini-grid id and also saves it as the address city (`AgentWebController.php:50`, `AddressesService.php:70`).
- The central `DatabaseProxy` row is written before the agent, without a transaction, so a failure leaves an orphan; deleting an agent leaves the proxy row (`AgentWebController.php:65`).
- `CreateAgentRequest` has no unique e-mail or commission exists check; `UpdateAgentRequest.php:22` does not check `commissionTypeId`; `CreateAgentChargeRequest` has no `agent_id` check or minimum amount; `CreateAgentAssignedApplianceRequest` takes `user_id` from the client without checks.
- Deleting an agent always answers HTTP 200, with the real status in the body (`AgentWebController.php:92`).
- `AgentService.php:176`: the citizenship is never saved.
- `GET /api/agents` has no search, active filter or default pagination.

### Agent performance (dashboard)

- `AgentPerformanceMetricsService.php:28,39,60`: `SUM(agents.commission_revenue)` adds the agent's lifetime commission once per sale, so total commission is inflated.
- Line 30: `avg_customers_per_agent` does not count distinct customers.
- Line 57: weekly buckets use `%x-W%v`, which does not match `PeriodService`'s `o-W` keys.
- Lines 23–40: `top_agents` returns only the first name, no surname or agent id.
- Line 18: `end_date` is read as midnight, so its last day is left out.
- `AgentPerformanceMetricsController.php:15`: a request without `period` is a 500.
- `/api/dashboard/*` routes have no permission middleware.

### Reports

- `ReportController.php:16` and `TicketOutsourcePayoutReportController.php:26-27`: an unknown report id is a 500 instead of a 404.
- `ReportController.php:43-54`: reports are paginated without ordering, so they are not newest first.
- `TicketOutsourcePayoutReportController.php:21`: without `per_page` the list is not paginated.
