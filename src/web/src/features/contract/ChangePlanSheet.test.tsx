import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { ChangePlanSheet } from './ChangePlanSheet';
import { scheduleOf } from './schedule';

import { contractDetailSchema } from '@/api/contracts';
import { contractDetailFixture } from '@/test/contractFixtures';
import { createGate } from '@/test/gate';
import { renderWithQueryClient } from '@/test/render';
import { server } from '@/test/server';

function planHandler(
  response: () => Response | Promise<Response> = () => HttpResponse.json({ data: {} }),
) {
  const bodies: unknown[] = [];
  server.use(
    http.put('/api/appliances/person/21/total-cost', async ({ request }) => {
      bodies.push(await request.json());
      return response();
    }),
  );
  return bodies;
}

function renderSheet() {
  const contract = contractDetailSchema.parse(contractDetailFixture());
  const onClose = vi.fn();
  const onChanged = vi.fn(() => Promise.resolve());
  const view = renderWithQueryClient(
    <ChangePlanSheet
      contract={contract}
      schedule={scheduleOf(contract)}
      currency="TZS"
      onClose={onClose}
      onChanged={onChanged}
    />,
  );
  return { onClose, onChanged, ...view };
}

const field = (name: string) => screen.getByRole('textbox', { name });
const planValue = (term: string) => screen.getByText(term).nextElementSibling;
const save = () => screen.getByRole('button', { name: 'Save new plan' });

async function replace(user: ReturnType<typeof renderSheet>['user'], name: string, value: string) {
  await user.clear(field(name));
  if (value) {
    await user.type(field(name), value);
  }
}

describe('ChangePlanSheet', () => {
  it('starts from the current plan', () => {
    planHandler();
    renderSheet();

    expect(field('Total price')).toHaveValue('1200');
    expect(field('Installments left')).toHaveValue('3');
    expect(screen.getByRole('combobox', { name: 'Frequency' })).toHaveValue('monthly');
    expect(planValue('Already paid')).toHaveTextContent('TZS 450');
    expect(planValue('Left to pay')).toHaveTextContent('TZS 750');
    expect(planValue('Each installment')).toHaveTextContent('TZS 250');
    expect(planValue('Paid off')).toHaveTextContent('01 Feb 2099');
  });

  it('sends only the new total when the schedule stays the same', async () => {
    const bodies = planHandler();
    const { user, onChanged, onClose } = renderSheet();

    await replace(user, 'Total price', '1000');
    expect(planValue('Each installment')).toHaveTextContent('TZS 183, last TZS 184');

    await user.click(save());

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([{ new_total_cost: 1000 }]);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('sends the count and cadence together when either changes', async () => {
    const bodies = planHandler();
    const { user, onClose } = renderSheet();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Frequency' }), 'Weekly');
    expect(planValue('Paid off')).toHaveTextContent('22 Mar 2020');

    await user.click(save());

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([{ new_total_cost: 1200, rate_count: 3, rate_type: 'weekly' }]);
  });

  it('previews a new number of installments', async () => {
    planHandler();
    const { user } = renderSheet();

    await replace(user, 'Installments left', '6');

    expect(planValue('Each installment')).toHaveTextContent('TZS 125');
    expect(planValue('Paid off')).toHaveTextContent('01 Sept 2020');
  });

  it.each([
    ['Total price', '400', 'The new total cannot be below what has already been paid.'],
    ['Total price', '', 'Enter the new total as a whole amount.'],
    ['Installments left', '0', 'Enter at least one installment.'],
  ])('blocks %s of "%s"', async (name, value, message) => {
    planHandler();
    const { user } = renderSheet();

    await replace(user, name, value);

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('Already paid')).not.toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('shows the reason the backend refused the change', async () => {
    const gate = createGate();
    planHandler(async () => {
      await gate.promise;
      return HttpResponse.json(
        { message: 'New total cannot be lower than the amount already paid' },
        { status: 422 },
      );
    });
    const { user, onClose } = renderSheet();

    await user.click(save());
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    gate.open();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The plan was not changed: New total cannot be lower than the amount already paid',
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
