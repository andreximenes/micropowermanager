import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { CategoryDot } from './CategoryDot';
import { categoryColorNames, categoryDotClass } from './labels';

import { fetchMainSettings } from '@/api/customers';
import {
  addExternalTicketUser,
  categoryColors,
  createTicketCategory,
  fetchCrmUsers,
  fetchTicketCategories,
} from '@/api/tickets';
import { Field } from '@/components/form';
import { PhoneInput } from '@/components/PhoneInput';
import { Sheet } from '@/components/Sheet';
import { showFieldErrors } from '@/lib/fieldErrors';
import { initials } from '@/lib/format';
import { defaultCountryCode, joinPhone } from '@/lib/phone';

const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters.'),
  color: z.enum(categoryColors),
  outsourced: z.boolean(),
});
type CategoryFormValues = z.infer<typeof categoryFormSchema>;

function CategorySheet({ onClose }: { onClose: () => void }) {
  const formId = useId();
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: '', color: 'blue', outsourced: false },
  });

  const save = useMutation({
    mutationFn: createTicketCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ticket-categories'] });
      onClose();
    },
    onError: (error) =>
      showFieldErrors(error, setError, {
        labelName: 'name',
        labelColor: 'color',
        outSourcing: 'outsourced',
      }),
  });

  return (
    <Sheet
      title="New category"
      description="Categories can't be renamed or removed once added, so pick the name with care."
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save category'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
        className="flex flex-col gap-5"
      >
        {save.isError ? (
          <Banner tone="error" role="alert">
            The category was not saved: {save.error.message}
          </Banner>
        ) : null}
        <Field label="Name *" error={errors.name?.message}>
          <Input
            autoComplete="off"
            placeholder="Panel cleaning"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-medium text-label">Color</legend>
              <div className="flex flex-wrap gap-2.5">
                {categoryColors.map((color) => (
                  <label
                    key={color}
                    className={`grid size-9 cursor-pointer place-items-center rounded-full border-2 ${field.value === color ? 'border-foreground' : 'border-transparent'}`}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={color}
                      checked={field.value === color}
                      onChange={() => field.onChange(color)}
                      aria-label={categoryColorNames[color]}
                      className="sr-only"
                    />
                    <span
                      className={`size-6 rounded-full ${categoryDotClass[color]}`}
                      aria-hidden="true"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        />
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" {...register('outsourced')} />
          <span>
            <strong className="block font-medium">Outsourced</strong>
            <span className="text-muted-foreground">
              Done by someone outside the company and paid per ticket. Each new ticket in this
              category asks what it pays, and shows in the payout report.
            </span>
          </span>
        </label>
      </form>
    </Sheet>
  );
}

const externalFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters.'),
  countryCode: z.string(),
  phone: z
    .string()
    .trim()
    .min(1, 'Enter the phone number.')
    .regex(/^\+?[\d\s()-]*$/, 'Use digits only.'),
});
type ExternalFormValues = z.infer<typeof externalFormSchema>;

function ExternalPersonSheet({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  const formId = useId();
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ExternalFormValues>({
    resolver: zodResolver(externalFormSchema),
    values: { name: '', phone: '', countryCode: defaultCountryCode(settings.data?.country) },
    resetOptions: { keepDirtyValues: true },
  });

  const save = useMutation({
    mutationFn: (values: ExternalFormValues) =>
      addExternalTicketUser(values.name, joinPhone(values.countryCode, values.phone) ?? ''),
    onSuccess: (_, values) => onAdded(values.name),
    onError: (error) => showFieldErrors(error, setError, { username: 'name', phone: 'phone' }),
  });

  return (
    <Sheet
      title="Add an external person"
      description="External people get ticket updates by SMS. They can't sign in."
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Add person'}
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
            The person was not added: {save.error.message}
          </Banner>
        ) : null}
        <Field label="Name *" error={errors.name?.message}>
          <Input
            autoComplete="off"
            placeholder="Person or company"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>
        <Field label="Phone *" error={errors.phone?.message}>
          <PhoneInput
            control={control}
            countryCodeName="countryCode"
            phone={register('phone')}
            invalid={Boolean(errors.phone)}
          />
        </Field>
      </form>
    </Sheet>
  );
}

function Categories() {
  const categories = useQuery({ queryKey: ['ticket-categories'], queryFn: fetchTicketCategories });
  const [adding, setAdding] = useState(false);

  return (
    <Card className="min-w-0 flex-[999_1_480px] bg-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <h2 className="m-0 text-base font-semibold">Categories</h2>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            Outsourced categories are paid per ticket and show in the payout report.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          + New category
        </Button>
      </div>
      {categories.isPending ? (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground">Loading categories…</p>
      ) : null}
      {categories.isError ? (
        <div className="p-4">
          <Banner tone="error" role="alert">
            Could not load categories: {categories.error.message}
          </Banner>
        </div>
      ) : null}
      {categories.data?.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground">
          No categories yet. Tickets need one, so add the first.
        </p>
      ) : null}
      {categories.data && categories.data.length > 0 ? (
        <ul aria-label="Categories" className="m-0 list-none divide-y divide-border p-0">
          {categories.data.map((category) => (
            <li
              key={category.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm sm:px-5"
            >
              <span className="font-medium">
                <CategoryDot category={category} />
              </span>
              {category.out_source ? (
                <span className="rounded-full bg-blue/10 px-2 py-0.5 text-xs text-blue">
                  Outsourced
                </span>
              ) : (
                <span className="text-muted-foreground">In house</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? <CategorySheet onClose={() => setAdding(false)} /> : null}
    </Card>
  );
}

function SupportStaff() {
  const users = useQuery({ queryKey: ['ticket-crm-users'], queryFn: fetchCrmUsers });
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  return (
    <Card className="min-w-0 flex-[1_1_320px] bg-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <h2 className="m-0 text-base font-semibold">Support staff</h2>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            People who can be assigned tickets
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          + External person
        </Button>
      </div>
      {users.isPending ? (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground">Loading people…</p>
      ) : null}
      {users.isError ? (
        <div className="p-4">
          <Banner tone="error" role="alert">
            Could not load support staff: {users.error.message}
          </Banner>
        </div>
      ) : null}
      {users.data ? (
        <ul aria-label="Support staff" className="m-0 list-none divide-y divide-border p-0">
          {users.data.map((user) => {
            const [first = '', second = ''] = user.name.trim().split(/\s+/);
            return (
              <li key={user.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-tile text-xs font-semibold text-white"
                  aria-hidden="true"
                >
                  {initials(first, second)}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate">{user.name}</strong>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.relation_ticket_user ? 'CRM user' : 'CRM user · cannot be assigned yet'}
                    {user.email ? ` · ${user.email}` : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {added ? (
        <div className="border-t border-border p-4">
          <Banner tone="success" role="status">
            {added} was added. External people don't appear in this list.
          </Banner>
        </div>
      ) : null}
      <p className="m-0 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
        Everyone with a CRM login is listed. External people get ticket updates by SMS and can't
        sign in.
      </p>
      {adding ? (
        <ExternalPersonSheet
          onClose={() => setAdding(false)}
          onAdded={(name) => {
            setAdding(false);
            setAdded(name);
          }}
        />
      ) : null}
    </Card>
  );
}

export function TicketSettings() {
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/tickets" className="hover:underline">
          Tickets
        </Link>{' '}
        / Settings
      </nav>
      <div>
        <h1 className="m-0 text-2xl font-bold">Ticket settings</h1>
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">
          Categories and who can be assigned tickets
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <Categories />
        <SupportStaff />
      </div>
    </div>
  );
}
