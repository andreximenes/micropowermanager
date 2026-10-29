import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useId } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { z } from 'zod';

import {
  createAgent,
  fetchCommissionTypes,
  primaryPhone,
  updateAgent,
  type Agent,
} from '@/api/agents';
import { fetchMainSettings } from '@/api/customers';
import { fetchMiniGrids } from '@/api/locations';
import { Field, selectClass, Step } from '@/components/form';
import { PhoneInput } from '@/components/PhoneInput';
import { Sheet } from '@/components/Sheet';
import { showFieldErrors } from '@/lib/fieldErrors';
import { defaultCountryCode, joinPhone, splitPhone } from '@/lib/phone';

const genders = ['female', 'male'] as const;

// The backend asks for at least three letters in both names.
const name = z.string().trim().min(3, 'Enter at least 3 characters.');

const detailsSchema = z.object({
  name,
  surname: name,
  countryCode: z.string(),
  phone: z
    .string()
    .trim()
    .min(1, 'Enter the phone number.')
    .regex(/^\+?[\d\s()-]*$/, 'Use digits only.'),
  gender: z.enum(['', ...genders]),
  birthDate: z.string(),
  miniGridId: z.string().min(1, 'Choose the site.'),
  commissionTypeId: z.string().min(1, 'Choose the commission type.'),
});

// Editing never sends the e-mail or password, so their rules apply only to a new agent.
const formSchemaFor = (isNew: boolean) =>
  detailsSchema.extend({
    email: isNew ? z.email('Enter a valid e-mail address.') : z.string(),
    password: isNew ? z.string().min(6, 'Use at least 6 characters.') : z.string(),
  });
type FormValues = z.infer<ReturnType<typeof formSchemaFor>>;

const formFieldOf: Record<string, Path<FormValues>> = {
  name: 'name',
  surname: 'surname',
  email: 'email',
  password: 'password',
  phone: 'phone',
  gender: 'gender',
  birth_date: 'birthDate',
  birthday: 'birthDate',
  city_id: 'miniGridId',
  miniGridId: 'miniGridId',
  agent_commission_id: 'commissionTypeId',
  commissionTypeId: 'commissionTypeId',
};

const blankToNull = (value: string) => (value === '' ? null : value);

type AgentFormProps = {
  /** The agent to edit; without it the form adds one. */
  agent?: Agent;
  onClose: () => void;
};

export function AgentForm({ agent, onClose }: AgentFormProps) {
  const formId = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const miniGrids = useQuery({ queryKey: ['mini-grids'], queryFn: fetchMiniGrids });
  const commissionTypes = useQuery({
    queryKey: ['commission-types'],
    queryFn: fetchCommissionTypes,
  });
  const phone = splitPhone(
    agent ? primaryPhone(agent) : null,
    defaultCountryCode(settings.data?.country),
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchemaFor(agent === undefined)),
    values: {
      name: agent?.person.name ?? '',
      surname: agent?.person.surname ?? '',
      email: agent?.email ?? '',
      password: '',
      countryCode: phone.countryCode,
      phone: phone.local,
      gender: genders.find((value) => value === agent?.person.gender?.toLowerCase()) ?? '',
      birthDate: agent?.person.birth_date?.slice(0, 10) ?? '',
      miniGridId: agent?.mini_grid ? String(agent.mini_grid.id) : '',
      commissionTypeId: agent?.commission ? String(agent.commission.id) : '',
    },
    resetOptions: { keepDirtyValues: true },
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const details = {
        name: values.name,
        surname: values.surname,
        phone: joinPhone(values.countryCode, values.phone),
        gender: blankToNull(values.gender),
        birthDate: blankToNull(values.birthDate),
        miniGridId: Number(values.miniGridId),
        commissionTypeId: Number(values.commissionTypeId),
      };
      if (agent) {
        await updateAgent(agent.id, details);
        return agent.id;
      }
      return (await createAgent({ ...details, email: values.email, password: values.password })).id;
    },
    onSuccess: async (agentId) => {
      await queryClient.invalidateQueries({ queryKey: ['agents'] });
      onClose();
      if (!agent) {
        await navigate({ to: '/agents/$agentId', params: { agentId } });
      }
    },
    onError: (error) => showFieldErrors(error, setError, formFieldOf),
  });

  return (
    <Sheet
      title={agent ? 'Edit agent' : 'New agent'}
      description={
        agent
          ? `${agent.person.name} ${agent.person.surname}`
          : 'The agent signs in to the agent app with this e-mail and password.'
      }
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save agent'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
        className="flex flex-col gap-6"
      >
        {save.isError ? (
          <Banner tone="error" role="alert">
            The agent was not saved: {save.error.message}
          </Banner>
        ) : null}

        <Step title="Personal details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name *" error={errors.name?.message}>
              <Input autoComplete="off" aria-invalid={Boolean(errors.name)} {...register('name')} />
            </Field>
            <Field label="Last name *" error={errors.surname?.message}>
              <Input
                autoComplete="off"
                aria-invalid={Boolean(errors.surname)}
                {...register('surname')}
              />
            </Field>
            <Field label="Phone *" error={errors.phone?.message}>
              <PhoneInput
                countryCode={register('countryCode')}
                phone={register('phone')}
                invalid={Boolean(errors.phone)}
              />
            </Field>
            <Field label="Gender" error={errors.gender?.message}>
              <select className={`${selectClass} h-10`} {...register('gender')}>
                <option value="">Not given</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </Field>
            <Field label="Date of birth" error={errors.birthDate?.message}>
              <Input type="date" {...register('birthDate')} />
            </Field>
          </div>
        </Step>

        <Step title="Work">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Site *" error={errors.miniGridId?.message}>
              <select
                className={`${selectClass} h-10`}
                aria-invalid={Boolean(errors.miniGridId)}
                {...register('miniGridId')}
              >
                <option value="">Choose a site</option>
                {(miniGrids.data ?? []).map((miniGrid) => (
                  <option key={miniGrid.id} value={miniGrid.id}>
                    {miniGrid.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Commission type *" error={errors.commissionTypeId?.message}>
              <select
                className={`${selectClass} h-10`}
                aria-invalid={Boolean(errors.commissionTypeId)}
                {...register('commissionTypeId')}
              >
                <option value="">Choose a commission type</option>
                {(commissionTypes.data ?? []).map((commission) => (
                  <option key={commission.id} value={commission.id}>
                    {commission.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {commissionTypes.isError ? (
            <Banner tone="error" role="alert">
              Could not load commission types: {commissionTypes.error.message}
            </Banner>
          ) : null}
          {miniGrids.isError ? (
            <Banner tone="error" role="alert">
              Could not load sites: {miniGrids.error.message}
            </Banner>
          ) : null}
        </Step>

        {agent ? null : (
          <Step title="Agent app sign-in">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-mail *" error={errors.email?.message}>
                <Input
                  type="email"
                  autoComplete="off"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
              </Field>
              <Field label="Password *" error={errors.password?.message}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
              </Field>
            </div>
          </Step>
        )}
      </form>
    </Sheet>
  );
}
