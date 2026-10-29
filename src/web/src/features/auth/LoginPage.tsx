import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import { AuthLayout } from './AuthLayout';

import { ApiError } from '@/api/client';
import { login } from '@/api/customers';

type LoginPageProps = { redirectTo?: string };

export function LoginPage({ redirectTo }: LoginPageProps) {
  const navigate = useNavigate();
  const passwordReset = useRouterState({
    select: (state) => state.location.state.passwordReset === true,
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: () => {
      if (redirectTo) {
        window.location.assign(redirectTo);
        return;
      }
      void navigate({ to: '/' });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  const error =
    mutation.error instanceof ApiError && mutation.error.status === 401
      ? 'Wrong e-mail or password.'
      : mutation.error?.message;

  return (
    <AuthLayout>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {passwordReset && !mutation.isError ? (
          <Banner tone="success" role="status">
            Your new password is set. Sign in with it.
          </Banner>
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          E-mail
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
        <Link to="/forgot-password" className="text-center text-sm text-muted-foreground underline">
          Forgot your password?
        </Link>
      </form>
    </AuthLayout>
  );
}
