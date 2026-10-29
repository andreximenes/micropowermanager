import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { addAgentBalance, addAgentReceipt, changeAgentPassword, type Agent } from '@/api/agents';
import { Field } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { showFieldErrors } from '@/lib/fieldErrors';
import { formatMoney } from '@/lib/format';

import { commissionCredited } from './labels';

const amountSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount, e.g. 25000.')
    .refine((value) => Number(value) > 0, 'Enter more than 0.'),
});
type AmountValues = z.infer<typeof amountSchema>;

const moneyCopy = {
  balance: {
    title: 'Add balance',
    description: 'A balance charge: it adds to what the agent owes the company.',
    save: 'Add balance',
    failure: 'The balance was not added',
  },
  receipt: {
    title: 'Add receipt',
    description: 'Money the agent hands over to settle what they owe the company.',
    save: 'Receive money',
    failure: 'The receipt was not added',
  },
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/** Records money moving between the company and the agent. */
export function AgentMoneySheet({
  agent,
  kind,
  currency,
  onClose,
}: {
  agent: Agent;
  kind: 'balance' | 'receipt';
  currency: string;
  onClose: () => void;
}) {
  const formId = useId();
  const queryClient = useQueryClient();
  const copy = moneyCopy[kind];
  const due = agent.balance;
  const pending = agent.commission_revenue;
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<AmountValues>({
    resolver: zodResolver(amountSchema),
    defaultValues: { amount: kind === 'receipt' && due > 0 ? String(due) : '' },
  });
  const typed = Number(useWatch({ control, name: 'amount' })) || 0;
  const credited = commissionCredited(typed, due, pending);
  const money = (value: number) => formatMoney(value, currency);

  const save = useMutation({
    mutationFn: ({ amount }: AmountValues) =>
      kind === 'balance'
        ? addAgentBalance(agent.id, Number(amount))
        : addAgentReceipt(agent.id, Number(amount)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agent', agent.id] }),
        queryClient.invalidateQueries({ queryKey: ['agents'] }),
      ]);
      onClose();
    },
    onError: (error) => showFieldErrors(error, setError, { amount: 'amount', agent_id: 'amount' }),
  });

  function submit(values: AmountValues) {
    if (kind === 'receipt' && Number(values.amount) > due) {
      setError('amount', {
        type: 'manual',
        message: `The agent owes ${money(due)}; a receipt cannot be for more.`,
      });
      return;
    }
    save.mutate(values);
  }

  if (kind === 'receipt' && due <= 0) {
    return (
      <Sheet
        title={copy.title}
        description={copy.description}
        onClose={onClose}
        footer={
          <Button variant="outline" onClick={onClose} className="ml-auto">
            Done
          </Button>
        }
      >
        <Banner tone="info">
          This agent does not owe the company anything.
          {due < 0 ? ` The company owes the agent ${money(-due)}.` : ''}
          {pending > 0
            ? ` Pending commission of ${money(pending)} cannot be settled through a receipt.`
            : ''}
        </Banner>
      </Sheet>
    );
  }
  return (
    <Sheet
      title={copy.title}
      description={copy.description}
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            Owes {money(due)} now
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : copy.save}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void handleSubmit(submit)(event)}
        className="flex flex-col gap-4"
      >
        {save.isError ? (
          <Banner tone="error" role="alert">
            {copy.failure}: {save.error.message}
          </Banner>
        ) : null}
        {kind === 'receipt' ? (
          <div className="flex flex-col gap-1.5 rounded-lg bg-panel-2 px-4 py-3 text-sm">
            <SummaryRow label="Due to the company" value={money(due)} />
            <SummaryRow label="Pending commission" value={money(pending)} />
          </div>
        ) : null}
        <Field
          label={`${kind === 'receipt' ? 'Amount collected' : 'Amount'} (${currency}) *`}
          error={errors.amount?.message}
        >
          <Input
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={Boolean(errors.amount)}
            {...register('amount')}
          />
        </Field>
        {kind === 'receipt' ? (
          <div className="flex flex-col gap-1.5 rounded-lg bg-panel-2 px-4 py-3 text-sm">
            <SummaryRow label="Commission credited" value={`− ${money(credited)}`} />
            <SummaryRow label="Cash to receive" value={money(Math.max(0, typed - credited))} />
            <span className="text-xs text-muted-foreground">
              Commission is credited when the agent settles the full amount they owe.
            </span>
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}

const passwordSchema = z
  .object({
    password: z.string().min(6, 'Use at least 6 characters.'),
    confirmation: z.string(),
  })
  .refine((values) => values.password === values.confirmation, {
    path: ['confirmation'],
    message: 'The passwords do not match.',
  });
type PasswordValues = z.infer<typeof passwordSchema>;

export function AgentPasswordSheet({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmation: '' },
  });
  const save = useMutation({
    mutationFn: ({ password }: PasswordValues) => changeAgentPassword(agent.id, password),
    onSuccess: onClose,
    onError: (error) => showFieldErrors(error, setError, { password: 'password' }),
  });

  return (
    <Sheet
      title="Change password"
      description={`For the agent app sign-in of ${agent.email}`}
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Change password'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
        className="flex flex-col gap-4"
      >
        {save.isError ? (
          <Banner tone="error" role="alert">
            The password was not changed: {save.error.message}
          </Banner>
        ) : null}
        <Field label="New password *" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>
        <Field label="Repeat the password *" error={errors.confirmation?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmation)}
            {...register('confirmation')}
          />
        </Field>
      </form>
    </Sheet>
  );
}
