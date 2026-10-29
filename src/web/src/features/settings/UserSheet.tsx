import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { z } from 'zod';

import { canAssignRole, roleLabel, roleSummary } from './roles';

import { createUser, fetchRoles, updateUser, type ListedUser } from '@/api/users';
import { can, readSession } from '@/auth/session';
import { CopyButton } from '@/components/CopyButton';
import { Field, Step } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { showFieldErrors } from '@/lib/fieldErrors';

// Letters and digits that cannot be mistaken for one another when read out.
const passwordAlphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePassword(length = 12): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => passwordAlphabet[value % passwordAlphabet.length]).join('');
}

// The backend asks for at least 3 characters in the name and 6 in the password.
const formSchemaFor = (isNew: boolean, picksRoles: boolean) =>
  z.object({
    name: z.string().trim().min(3, 'Enter at least 3 characters.'),
    email: isNew ? z.email('Enter a valid e-mail address.') : z.string(),
    password: isNew ? z.string().min(6, 'Use at least 6 characters.') : z.string(),
    roles: picksRoles
      ? z.array(z.string()).min(1, 'Choose at least one role.')
      : z.array(z.string()),
  });
type FormValues = z.infer<ReturnType<typeof formSchemaFor>>;

const formFieldOf: Record<string, Path<FormValues>> = {
  name: 'name',
  email: 'email',
  password: 'password',
  roles: 'roles',
};

type UserSheetProps = {
  /** The user to edit; without it the sheet adds one. */
  user?: ListedUser;
  onClose: () => void;
};

export function UserSheet({ user, onClose }: UserSheetProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const session = readSession();
  // Listing roles needs the `roles` permission; without it the user is saved without a role choice.
  const picksRoles = can(session, 'roles');
  const roles = useQuery({ queryKey: ['roles'], queryFn: fetchRoles, enabled: picksRoles });

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchemaFor(user === undefined, picksRoles)),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: user ? '' : generatePassword(),
      roles: user?.roles ?? [],
    },
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const chosenRoles = picksRoles ? { roles: values.roles } : {};
      if (user) {
        await updateUser(user.id, { name: values.name, ...chosenRoles });
        return;
      }
      await createUser({
        name: values.name,
        email: values.email,
        password: values.password,
        roles: picksRoles ? values.roles : [],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (error) => showFieldErrors(error, setError, formFieldOf),
  });

  const password = useWatch({ control, name: 'password' });

  return (
    <Sheet
      title={user ? `Edit ${user.name}` : 'New user'}
      description={
        user
          ? user.email
          : 'They sign in to Spark CRM with this e-mail and password. Nothing is e-mailed to them.'
      }
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            {user ? null : 'Roles can be changed later from the users list.'}
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : user ? 'Save user' : 'Create user'}
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
            The user was not saved: {save.error.message}
          </Banner>
        ) : null}

        <Step title="Who">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name *" error={errors.name?.message}>
              <Input autoComplete="off" aria-invalid={Boolean(errors.name)} {...register('name')} />
            </Field>
            {user ? (
              <Field label="E-mail">
                <Input readOnly value={user.email} className="bg-panel-2 text-muted-foreground" />
              </Field>
            ) : (
              <Field label="E-mail *" error={errors.email?.message}>
                <Input
                  type="email"
                  autoComplete="off"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
              </Field>
            )}
          </div>
          {user ? null : (
            <div className="flex flex-col gap-1.5">
              <Field label="Password *" error={errors.password?.message}>
                <Input
                  autoComplete="new-password"
                  className="font-mono"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValue('password', generatePassword(), { shouldValidate: true })}
                >
                  Generate another
                </Button>
                <CopyButton text={password} />
                <span className="text-xs text-muted-foreground">
                  Share it in person or by phone.
                </span>
              </div>
            </div>
          )}
        </Step>

        {picksRoles ? (
          <Step title="What they can do">
            {roles.isError ? (
              <Banner tone="error" role="alert">
                Could not load roles: {roles.error.message}
              </Banner>
            ) : null}
            {roles.isPending ? (
              <p className="m-0 text-sm text-muted-foreground">Loading roles…</p>
            ) : null}
            <Controller
              control={control}
              name="roles"
              render={({ field }) => (
                <div role="group" aria-label="Roles" className="flex flex-col gap-2">
                  {(roles.data ?? []).map((role) => {
                    const checked = field.value.includes(role.name);
                    const allowed = canAssignRole(session, role.name);
                    return (
                      <label
                        key={role.name}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${checked ? 'border-primary bg-panel-2' : 'border-border'} ${allowed ? 'cursor-pointer' : 'opacity-60'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!allowed}
                          onChange={(event) =>
                            field.onChange(
                              event.target.checked
                                ? [...field.value, role.name]
                                : field.value.filter((name) => name !== role.name),
                            )
                          }
                          className="mt-0.5 size-4 accent-primary"
                        />
                        <span className="flex flex-col gap-0.5">
                          <strong>{roleLabel(role.name)}</strong>
                          <span className="text-muted-foreground">
                            {allowed
                              ? roleSummary(role)
                              : 'Only an owner or admin with that right can give this role.'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.roles?.message ? (
              <p className="m-0 text-xs text-red">{errors.roles.message}</p>
            ) : null}
          </Step>
        ) : null}
      </form>
    </Sheet>
  );
}
