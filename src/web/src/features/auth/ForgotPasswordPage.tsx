import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import { AuthHeading, AuthLayout } from './AuthLayout';

import { ApiError } from '@/api/client';
import { requestPasswordReset } from '@/api/password';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const request = useMutation({ mutationFn: () => requestPasswordReset(email) });

  function submit(event: FormEvent) {
    event.preventDefault();
    request.mutate();
  }

  // A 422 without field errors is how the server says it could not send mail, which not every
  // server is set up for yet.
  const mailUnavailable =
    request.error instanceof ApiError &&
    request.error.status === 422 &&
    Object.keys(request.error.fieldErrors).length === 0;

  return (
    <AuthLayout>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <AuthHeading title="Forgot your password?">
          Enter the e-mail you sign in with. We'll send a link to set a new password.
        </AuthHeading>
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
        <Button type="submit" disabled={request.isPending}>
          {request.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
        {request.isSuccess ? (
          <Banner tone="success" role="status">
            If that e-mail has an account, a link is on its way. Check your spam folder too.
          </Banner>
        ) : null}
        {mailUnavailable ? (
          <Banner tone="warning" role="alert">
            We couldn't send the e-mail right now. Try again later, or ask an administrator to set a
            new password for you.
          </Banner>
        ) : null}
        {request.isError && !mailUnavailable ? (
          <Banner tone="error" role="alert">
            The link was not sent: {request.error.message}
          </Banner>
        ) : null}
        <Link to="/login" className="text-center text-sm text-muted-foreground underline">
          Back to sign in
        </Link>
      </form>
    </AuthLayout>
  );
}
