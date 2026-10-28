import { Button } from '@spark/ui/button';
import { Card, CardContent } from '@spark/ui/card';
import { Input } from '@spark/ui/input';
import { SparkLogo } from '@spark/ui/spark-logo';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import { ApiError } from '@/api/client';
import { login } from '@/api/customers';

type LoginPageProps = { redirectTo?: string };

export function LoginPage({ redirectTo }: LoginPageProps) {
  const navigate = useNavigate();
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-foreground">
          <SparkLogo className="h-8 w-auto fill-foreground" />
          <h1 className="text-2xl font-semibold">Spark CRM</h1>
          <p className="text-sm text-muted-foreground">Powered by MicroPowerManager</p>
        </div>
        <Card className="w-full">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                E-mail
                <Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Password
                <Input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              {error ? (
                <p role="alert" className="text-sm text-red">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
              <a href="/legacy/#/forgot-password" className="text-center text-sm text-muted-foreground underline">
                Forgot your password?
              </a>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
