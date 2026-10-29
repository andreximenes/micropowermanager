import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { AuthHeading, AuthLayout } from './AuthLayout';

import { resetPassword, validateResetToken } from '@/api/password';
import { Field } from '@/components/form';

declare module '@tanstack/history' {
  interface HistoryState {
    /** Set when the sign-in page opens right after a password reset. */
    passwordReset?: boolean;
  }
}

/** The backend's own minimum. */
const MIN_LENGTH = 6;

const formSchema = z
  .object({
    password: z.string().min(MIN_LENGTH, `That is shorter than ${MIN_LENGTH} characters.`),
    repeat: z.string(),
  })
  .refine((values) => values.password === values.repeat, {
    message: "The two passwords don't match.",
    path: ['repeat'],
  });
type FormValues = z.infer<typeof formSchema>;

const strengthLabels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/** A rough guide, 0 to 4: length past the minimum, mixed case, digits and symbols each add a step. */
function passwordStrength(password: string): number {
  if (password.length < MIN_LENGTH) {
    return 0;
  }
  const extras = [
    password.length >= 10,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password) && /[^\da-zA-Z]/.test(password),
  ].filter(Boolean).length;
  return 1 + extras;
}

function StrengthMeter({ password }: { password: string }) {
  const strength = passwordStrength(password);
  const tone = strength >= 3 ? 'bg-green' : strength === 2 ? 'bg-amber' : 'bg-red';
  return (
    <div className="flex flex-col gap-1">
      <div
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={strength}
        aria-valuetext={strengthLabels[strength]}
        className="grid grid-cols-4 gap-1"
      >
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`h-1 rounded-full ${step <= strength ? tone : 'bg-border'}`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{strengthLabels[strength]}</span>
    </div>
  );
}

function ResetForm({ token, email }: { token: string; email: string | null }) {
  const navigate = useNavigate();
  const [shown, setShown] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', repeat: '' },
  });
  const password = useWatch({ control, name: 'password' });
  const save = useMutation({
    mutationFn: (values: FormValues) => resetPassword(token, values.password),
    onSuccess: () => navigate({ to: '/login', state: { passwordReset: true } }),
  });

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
      className="flex flex-col gap-4"
    >
      <AuthHeading title="Set a new password">
        {email ? `For ${email}. ` : ''}Use at least {MIN_LENGTH} characters.
      </AuthHeading>
      <Field label="New password" error={errors.password?.message}>
        <span className="relative flex">
          <Input
            type={shown ? 'text' : 'password'}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            className="pr-10"
            {...register('password')}
          />
          <button
            type="button"
            aria-label={shown ? 'Hide password' : 'Show password'}
            onClick={() => setShown((current) => !current)}
            className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-panel-2"
          >
            {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </Field>
      <StrengthMeter password={password} />
      <Field label="Repeat new password" error={errors.repeat?.message}>
        <Input
          type={shown ? 'text' : 'password'}
          autoComplete="new-password"
          aria-invalid={Boolean(errors.repeat)}
          {...register('repeat')}
        />
      </Field>
      {save.isError ? (
        <Banner tone="error" role="alert">
          The password was not changed: {save.error.message}{' '}
          <Link to="/forgot-password" className="underline">
            Request a new link
          </Link>
        </Banner>
      ) : null}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save new password'}
      </Button>
      <Link to="/login" className="text-center text-sm text-muted-foreground underline">
        Back to sign in
      </Link>
    </form>
  );
}

function InvalidLink() {
  return (
    <div className="flex flex-col gap-4">
      <AuthHeading title="This link no longer works">
        Reset links work once and expire after a while. Ask for a new one and use the latest e-mail.
      </AuthHeading>
      <Button asChild>
        <Link to="/forgot-password">Request a new link</Link>
      </Button>
      <Link to="/login" className="text-center text-sm text-muted-foreground underline">
        Back to sign in
      </Link>
    </div>
  );
}

export function ResetPasswordPage({ token }: { token: string | undefined }) {
  const validation = useQuery({
    queryKey: ['password-reset-token', token],
    queryFn: () => validateResetToken(token ?? ''),
    enabled: Boolean(token),
    // A reset token is checked once; refetching on focus would only repeat the same answer.
    staleTime: Infinity,
  });

  function content() {
    if (!token || validation.data?.valid === false) {
      return <InvalidLink />;
    }
    if (validation.isError) {
      return (
        <Banner tone="error" role="alert">
          Could not check the link: {validation.error.message}
        </Banner>
      );
    }
    if (!validation.data) {
      return <p className="m-0 text-sm text-muted-foreground">Checking the link…</p>;
    }
    return <ResetForm token={token} email={validation.data.email} />;
  }

  return <AuthLayout>{content()}</AuthLayout>;
}
