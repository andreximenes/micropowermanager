import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { z } from 'zod';

import { personOf, roleLabel } from './roles';

import { ApiError } from '@/api/client';
import { fetchMainSettings } from '@/api/customers';
import {
  changeUserPassword,
  fetchUser,
  updateUser,
  updateUserAddress,
  type User,
} from '@/api/users';
import { readSession } from '@/auth/session';
import { Field } from '@/components/form';
import { PersonAvatar } from '@/components/PersonAvatar';
import { PhoneInput } from '@/components/PhoneInput';
import { VillagePicker, type Village } from '@/components/VillagePicker';
import { showFieldErrors } from '@/lib/fieldErrors';
import { defaultCountryCode, joinPhone, splitPhone } from '@/lib/phone';

/** A 403 means the account lacks the right, which reads better than the server's wording. */
function failureText(error: Error, forbidden: string): string {
  return error instanceof ApiError && error.status === 403 ? forbidden : error.message;
}

function ProfileCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 flex-[1_1_360px] bg-panel">
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <h2 className="m-0 text-base font-bold">{title}</h2>
        {description ? (
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

const detailsSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name.'),
    countryCode: z.string(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s()-]*$/, 'Use digits only.'),
    street: z.string().trim(),
    village: z.custom<Village | null>(),
  })
  // The address endpoint needs a village and a phone number together.
  .superRefine((values, context) => {
    const hasAddress = values.phone !== '' || values.street !== '' || values.village !== null;
    if (hasAddress && values.village === null) {
      context.addIssue({
        code: 'custom',
        path: ['village'],
        message: 'Choose your village to save a phone or address.',
      });
    }
    if (hasAddress && values.phone === '') {
      context.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter your phone number to save an address.',
      });
    }
  });
type DetailsValues = z.infer<typeof detailsSchema>;

const detailsFieldOf: Record<string, Path<DetailsValues>> = {
  name: 'name',
  phone: 'phone',
  street: 'street',
  city_id: 'village',
};

function DetailsForm({ user, defaultCountry }: { user: User; defaultCountry: string }) {
  const queryClient = useQueryClient();
  const address = user.address_details;
  const phone = splitPhone(address?.phone, defaultCountry);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    values: {
      name: user.name,
      countryCode: phone.countryCode,
      phone: phone.local,
      street: address?.street ?? '',
      village: address?.city ? { id: address.city.id, name: address.city.name } : null,
    },
    resetOptions: { keepDirtyValues: true },
  });

  const save = useMutation({
    mutationFn: async (values: DetailsValues) => {
      await updateUser(user.id, { name: values.name });
      const fullPhone = joinPhone(values.countryCode, values.phone);
      if (values.village && fullPhone) {
        await updateUserAddress(user.id, {
          name: values.name,
          phone: fullPhone,
          street: values.street || null,
          cityId: values.village.id,
        });
      }
    },
    onSuccess: async (_, values) => {
      reset(values);
      await queryClient.invalidateQueries({ queryKey: ['user', user.id] });
    },
    onError: (error) => showFieldErrors(error, setError, detailsFieldOf),
  });

  return (
    <ProfileCard title="Details">
      <form
        noValidate
        aria-label="Details"
        onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
      >
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
          {save.isError ? (
            <Banner tone="error" role="alert">
              Your details were not saved:{' '}
              {failureText(save.error, 'your account is not allowed to change them.')}
            </Banner>
          ) : null}
          {save.isSuccess && !isDirty ? (
            <Banner tone="success" role="status">
              Details saved.
            </Banner>
          ) : null}
          <Field label="Full name *" error={errors.name?.message}>
            <Input aria-invalid={Boolean(errors.name)} {...register('name')} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <Field label="E-mail">
              <Input readOnly value={user.email} className="bg-panel-2 text-muted-foreground" />
            </Field>
            <p className="m-0 text-xs text-muted-foreground">Ask an admin to change your e-mail.</p>
          </div>
          <Field label="Phone" error={errors.phone?.message}>
            <PhoneInput
              countryCode={register('countryCode')}
              phone={register('phone')}
              invalid={Boolean(errors.phone)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Village" error={errors.village?.message}>
              <Controller
                control={control}
                name="village"
                render={({ field }) => (
                  <VillagePicker
                    label="Village"
                    placeholder="Start typing the village name"
                    value={field.value}
                    onChange={field.onChange}
                    invalid={Boolean(errors.village)}
                  />
                )}
              />
            </Field>
            <Field label="Street or landmark" error={errors.street?.message}>
              <Input {...register('street')} />
            </Field>
          </div>
        </div>
        <div className="flex justify-end border-t border-border px-4 py-4 sm:px-6">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save details'}
          </Button>
        </div>
      </form>
    </ProfileCard>
  );
}

// The backend asks for at least 5 characters.
const passwordSchema = z
  .object({
    password: z.string().min(5, 'Use at least 5 characters.'),
    repeat: z.string(),
  })
  .refine((values) => values.password === values.repeat, {
    path: ['repeat'],
    message: 'The two passwords differ.',
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function PasswordForm({ userId }: { userId: number }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', repeat: '' },
  });

  const change = useMutation({
    mutationFn: (values: PasswordValues) => changeUserPassword(userId, values.password),
    onSuccess: () => reset(),
    onError: (error) =>
      showFieldErrors(error, setError, { password: 'password', confirm_password: 'repeat' }),
  });

  return (
    <ProfileCard title="Change password" description="You stay signed in on this device.">
      <form
        noValidate
        aria-label="Change password"
        onSubmit={(event) => void handleSubmit((values) => change.mutate(values))(event)}
      >
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
          {change.isError ? (
            <Banner tone="error" role="alert">
              Your password was not changed:{' '}
              {failureText(
                change.error,
                'changing passwords needs the user management right. Ask an owner or admin to change it for you.',
              )}
            </Banner>
          ) : null}
          {change.isSuccess ? (
            <Banner tone="success" role="status">
              Password changed. Use the new one next time you sign in.
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
          <Field label="Repeat new password *" error={errors.repeat?.message}>
            <Input
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.repeat)}
              {...register('repeat')}
            />
          </Field>
        </div>
        <div className="flex justify-end border-t border-border px-4 py-4 sm:px-6">
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? 'Changing…' : 'Change password'}
          </Button>
        </div>
      </form>
    </ProfileCard>
  );
}

export function Profile() {
  const session = readSession();
  const userId = session?.user.id ?? 0;
  const user = useQuery({ queryKey: ['user', userId], queryFn: () => fetchUser(userId) });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const name = user.data?.name ?? session?.user.name ?? '';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <PersonAvatar person={personOf(name)} size="lg" />
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold">Your profile</h1>
          <p className="m-0 mt-0.5 truncate text-sm text-muted-foreground">
            {[session?.user.email, ...(session?.roles ?? []).map(roleLabel)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      {user.isPending ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading your profile…</p>
      ) : null}
      {user.isError ? (
        <Banner tone="error" role="alert">
          Could not load your profile: {user.error.message}
        </Banner>
      ) : null}
      {user.data ? (
        <div className="flex flex-wrap items-start gap-5">
          <DetailsForm
            user={user.data}
            defaultCountry={defaultCountryCode(settings.data?.country)}
          />
          <PasswordForm userId={user.data.id} />
        </div>
      ) : null}
    </div>
  );
}
