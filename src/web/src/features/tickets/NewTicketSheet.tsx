import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { useId } from 'react';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { z } from 'zod';

import { fetchMainSettings } from '@/api/customers';
import { fetchPeople, type ListedPerson } from '@/api/people';
import { createTicket, fetchAssignees, fetchTicketCategories } from '@/api/tickets';
import { Field, selectClass } from '@/components/form';
import { SearchPicker, type Picked } from '@/components/SearchPicker';
import { Sheet } from '@/components/Sheet';
import { showFieldErrors } from '@/lib/fieldErrors';

const formSchema = z.object({
  customer: z
    .object({ id: z.number(), name: z.string() })
    .nullable()
    .refine((customer) => customer !== null, 'Choose the customer.'),
  title: z.string().trim().min(3, 'Enter at least 3 characters.').max(255),
  categoryId: z.string().min(1, 'Choose the category.'),
  pay: z.string().trim(),
  assigneeId: z.string(),
  dueDate: z.string(),
  description: z.string().trim().min(1, 'Describe the issue.'),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

const formFieldOf: Record<string, Path<FormInput>> = {
  owner_id: 'customer',
  title: 'title',
  label: 'categoryId',
  outsourcing: 'pay',
  assignedPerson: 'assigneeId',
  dueDate: 'dueDate',
  description: 'description',
};

const searchCustomers = async (term: string) =>
  (await fetchPeople({ term: term.trim() || undefined, per_page: 10 })).data;

function customerContext(person: ListedPerson): string {
  const address = person.addresses[0];
  return [address?.phone, address?.city?.name].filter(Boolean).join(' · ');
}

type NewTicketSheetProps = {
  /** The customer the ticket is for, when the sheet opens from their profile. */
  customer?: Picked;
  onClose: () => void;
  onCreated: (ticketId: number) => void;
};

export function NewTicketSheet({ customer, onClose, onCreated }: NewTicketSheetProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['ticket-categories'], queryFn: fetchTicketCategories });
  const assignees = useQuery({ queryKey: ['ticket-assignees'], queryFn: fetchAssignees });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer: customer ?? null,
      title: '',
      categoryId: '',
      pay: '',
      assigneeId: '',
      dueDate: '',
      description: '',
    },
  });

  const categoryId = useWatch({ control, name: 'categoryId' });
  const outsourced =
    categories.data?.find((category) => String(category.id) === categoryId)?.out_source ?? false;

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      createTicket({
        title: values.title,
        description: values.description,
        categoryId: Number(values.categoryId),
        customerId: values.customer.id,
        assigneeId: values.assigneeId ? Number(values.assigneeId) : null,
        dueDate: values.dueDate || null,
        outsourcing: outsourced ? Number(values.pay) : null,
      }),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      onCreated(id);
    },
    onError: (error) => showFieldErrors(error, setError, formFieldOf),
  });

  // Only outsourced categories pay per ticket, so the amount is checked against the chosen one.
  function submit(values: FormValues) {
    // The backend stores the pay as a whole amount.
    if (outsourced && !/^\d+$/.test(values.pay)) {
      setError('pay', { type: 'manual', message: 'Enter a whole amount, e.g. 3500.' });
      return;
    }
    save.mutate(values);
  }

  return (
    <Sheet
      title="New ticket"
      description={customer ? `For ${customer.name}` : 'Log a customer issue and who handles it.'}
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Open ticket'}
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
            The ticket was not opened: {save.error.message}
          </Banner>
        ) : null}
        {customer ? null : (
          <Field label="Customer *" error={errors.customer?.message}>
            <Controller
              control={control}
              name="customer"
              render={({ field }) => (
                <SearchPicker
                  label="Customer *"
                  placeholder="Search by name or phone"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.customer)}
                  icon={UserRound}
                  noun="customers"
                  emptyText="No matching customer."
                  queryKey="ticket-customer-search"
                  search={searchCustomers}
                  toValue={(person: ListedPerson) => ({
                    id: person.id,
                    name: `${person.name} ${person.surname}`,
                  })}
                  context={customerContext}
                />
              )}
            />
          </Field>
        )}
        <Field label="Title *" error={errors.title?.message}>
          <Input
            autoComplete="off"
            placeholder="Kit not charging after rain"
            aria-invalid={Boolean(errors.title)}
            {...register('title')}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category *" error={errors.categoryId?.message}>
            <select
              className={`${selectClass} h-10`}
              aria-invalid={Boolean(errors.categoryId)}
              {...register('categoryId')}
            >
              <option value="">Choose a category</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label_name}
                  {category.out_source ? ' (outsourced)' : ''}
                </option>
              ))}
            </select>
          </Field>
          {outsourced ? (
            <Field
              label={`Pay for this ticket (${settings.data?.currency ?? ''}) *`}
              error={errors.pay?.message}
            >
              <Input inputMode="numeric" aria-invalid={Boolean(errors.pay)} {...register('pay')} />
            </Field>
          ) : null}
          <Field label="Assigned to" error={errors.assigneeId?.message}>
            <select className={`${selectClass} h-10`} {...register('assigneeId')}>
              <option value="">Unassigned</option>
              {(assignees.data ?? []).map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" error={errors.dueDate?.message}>
            <Input type="date" {...register('dueDate')} />
          </Field>
        </div>
        {categories.isError ? (
          <Banner tone="error" role="alert">
            Could not load categories: {categories.error.message}
          </Banner>
        ) : null}
        {categories.data?.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">
            No categories yet. Add one in ticket settings first.
          </p>
        ) : null}
        <Field label="Description *" error={errors.description?.message}>
          <textarea
            rows={5}
            aria-invalid={Boolean(errors.description)}
            placeholder="What the customer reported, and anything the assignee needs to know"
            className="rounded-md border border-input-border bg-input px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            {...register('description')}
          />
        </Field>
      </form>
    </Sheet>
  );
}
