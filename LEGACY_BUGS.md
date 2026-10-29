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
