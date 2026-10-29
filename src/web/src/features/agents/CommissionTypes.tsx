import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { Input } from '@spark/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { z } from 'zod';

import {
  createCommissionType,
  deleteCommissionType,
  fetchCommissionTypes,
  updateCommissionType,
  type CommissionType,
} from '@/api/agents';
import { fetchMainSettings } from '@/api/customers';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { showFieldErrors } from '@/lib/fieldErrors';
import { formatMoney } from '@/lib/format';

const percent = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter a percentage, e.g. 5.')
  .refine((value) => Number(value) <= 100, 'Enter at most 100.');

const formSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.'),
  energy: percent,
  appliance: percent,
  riskBalance: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount, e.g. 10000.'),
});
type FormValues = z.infer<typeof formSchema>;

const formFieldOf: Record<string, Path<FormValues>> = {
  name: 'name',
  energy_commission: 'energy',
  appliance_commission: 'appliance',
  risk_balance: 'riskBalance',
};

// Shares are stored as fractions (0.05) and typed as percentages (5).
const toPercent = (share: number) => String(Math.round(share * 10000) / 100);
const toShare = (percentage: string) => Math.round(Number(percentage) * 100) / 10000;

function CommissionSheet({
  commission,
  currency,
  onClose,
}: {
  commission?: CommissionType;
  currency: string;
  onClose: () => void;
}) {
  const formId = useId();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: commission?.name ?? '',
      energy: commission ? toPercent(commission.energy_commission) : '',
      appliance: commission ? toPercent(commission.appliance_commission) : '',
      riskBalance: commission ? String(commission.risk_balance) : '',
    },
  });
  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const input = {
        name: values.name,
        energy_commission: toShare(values.energy),
        appliance_commission: toShare(values.appliance),
        risk_balance: Number(values.riskBalance),
      };
      return commission ? updateCommissionType(commission.id, input) : createCommissionType(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['commission-types'] });
      // Agents show their commission type.
      await queryClient.invalidateQueries({ queryKey: ['agent'] });
      onClose();
    },
    onError: (error) => showFieldErrors(error, setError, formFieldOf),
  });

  return (
    <Sheet
      title={commission ? 'Edit commission type' : 'New commission type'}
      description={
        commission
          ? `${commission.name} · changes apply to every agent on this type`
          : 'What agents on this type earn, and how far their balance may run.'
      }
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save commission type'}
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
            The commission type was not saved: {save.error.message}
          </Banner>
        ) : null}
        <Field label="Name *" error={errors.name?.message}>
          <Input autoComplete="off" aria-invalid={Boolean(errors.name)} {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="On energy payments (%) *" error={errors.energy?.message}>
            <Input
              inputMode="decimal"
              aria-invalid={Boolean(errors.energy)}
              {...register('energy')}
            />
          </Field>
          <Field label="On product sales (%) *" error={errors.appliance?.message}>
            <Input
              inputMode="decimal"
              aria-invalid={Boolean(errors.appliance)}
              {...register('appliance')}
            />
          </Field>
        </div>
        <Field label={`Risk balance (${currency}) *`} error={errors.riskBalance?.message}>
          <Input
            inputMode="decimal"
            aria-invalid={Boolean(errors.riskBalance)}
            {...register('riskBalance')}
          />
        </Field>
        <p className="m-0 text-sm text-muted-foreground">
          The risk balance is how much an agent on this type may owe before they must hand money in.
        </p>
      </form>
    </Sheet>
  );
}

export function CommissionTypes() {
  const queryClient = useQueryClient();
  const commissions = useQuery({ queryKey: ['commission-types'], queryFn: fetchCommissionTypes });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const currency = settings.data?.currency ?? '';
  const [editing, setEditing] = useState<CommissionType | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CommissionType | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/agents" className="hover:underline">
          Agents
        </Link>{' '}
        / Commission types
      </nav>
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="m-0 text-2xl font-bold">Commission types</h1>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            What agents earn on the payments they collect and the products they sell
          </p>
        </div>
        <Button className="h-10" onClick={() => setEditing('new')}>
          + New commission type
        </Button>
      </div>

      <Card className="bg-panel">
        {commissions.isPending ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</p>
        ) : null}
        {commissions.isError ? (
          <div className="p-4">
            <Banner tone="error" role="alert">
              Could not load commission types: {commissions.error.message}
            </Banner>
          </div>
        ) : null}
        {commissions.data?.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No commission types yet. Agents need one, so add the first.
          </p>
        ) : null}
        {commissions.data && commissions.data.length > 0 ? (
          <div className="overflow-x-auto">
            <Table aria-label="Commission types">
              <TableHeader>
                <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
                  <TableHead className="pl-5 font-semibold">Name</TableHead>
                  <TableHead className="text-right font-semibold">Energy</TableHead>
                  <TableHead className="text-right font-semibold">Products</TableHead>
                  <TableHead className="text-right font-semibold">Risk balance</TableHead>
                  <TableHead className="pr-5 text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.data.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="pl-5 font-semibold">{commission.name}</TableCell>
                    <TableCell className="text-right">
                      {toPercent(commission.energy_commission)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {toPercent(commission.appliance_commission)}%
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatMoney(commission.risk_balance, currency)}
                    </TableCell>
                    <TableCell className="pr-5">
                      <span className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Edit ${commission.name}`}
                          onClick={() => setEditing(commission)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red"
                          aria-label={`Delete ${commission.name}`}
                          onClick={() => setDeleting(commission)}
                        >
                          <Trash2 />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </Card>

      {editing ? (
        <CommissionSheet
          commission={editing === 'new' ? undefined : editing}
          currency={currency}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          description="Make sure no agent is on this commission type before you delete it."
          confirmLabel="Delete commission type"
          pendingLabel="Deleting…"
          failureLabel="The commission type was not deleted"
          onConfirm={() => deleteCommissionType(deleting.id)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['commission-types'] })}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
