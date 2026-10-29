import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { createGate } from '@/test/gate';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

describe('ForgotPasswordPage', () => {
  it('sends the link and says so without revealing whether the e-mail has an account', async () => {
    const gate = createGate();
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/users/password', async ({ request }) => {
        bodies.push(await request.json());
        await gate.promise;
        return HttpResponse.json({
          data: { message: 'If the email exists, a reset link has been sent.', status_code: 200 },
        });
      }),
    );
    const { user } = renderApp('/forgot-password');

    await user.type(await screen.findByLabelText('E-mail'), 'grace@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled();
    gate.open();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If that e-mail has an account, a link is on its way.',
    );
    expect(bodies).toEqual([{ email: 'grace@example.com' }]);
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });

  it('stays calm when the server cannot send e-mail', async () => {
    server.use(
      http.post('/api/users/password', () =>
        HttpResponse.json(
          { data: { message: 'Failed to send reset email.', status_code: 409 } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/forgot-password');

    await user.type(await screen.findByLabelText('E-mail'), 'grace@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't send the e-mail right now.",
    );
  });

  it('shows a refused address as the server words it', async () => {
    server.use(
      http.post('/api/users/password', () =>
        HttpResponse.json(
          { message: 'The email must be valid.', errors: { email: ['The email must be valid.'] } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/forgot-password');

    await user.type(await screen.findByLabelText('E-mail'), 'grace@example');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The link was not sent: The email must be valid.',
    );
  });
});

function acceptToken(email: string | null = 'grace@example.com') {
  server.use(
    http.get('/api/users/password/validate/:token', ({ params }) =>
      HttpResponse.json({ data: { valid: params.token === 'good', email } }),
    ),
  );
}

describe('ResetPasswordPage', () => {
  it('sets the new password and signs in from the login page', async () => {
    acceptToken();
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/users/password/confirm', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          data: { message: 'Password has been reset successfully.', status_code: 200 },
        });
      }),
    );
    const { user, router } = renderApp('/reset-password?token=good');

    expect(await screen.findByText(/For grace@example.com\./)).toBeInTheDocument();
    const password = screen.getByLabelText('New password');
    await user.type(password, 'Sunrise-2026');
    expect(screen.getByRole('meter', { name: 'Password strength' })).toHaveAttribute(
      'aria-valuetext',
      'Strong',
    );
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.type(screen.getByLabelText('Repeat new password'), 'Sunrise-2026');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByRole('status')).toHaveTextContent('Your new password is set.');
    expect(bodies).toEqual([
      { token: 'good', password: 'Sunrise-2026', password_confirmation: 'Sunrise-2026' },
    ]);
  });

  it('checks the length and the repeat before sending', async () => {
    acceptToken(null);
    const sent = vi.fn();
    server.use(http.post('/api/users/password/confirm', sent));
    const { user } = renderApp('/reset-password?token=good');

    await user.type(await screen.findByLabelText('New password'), 'abc');
    expect(screen.getByText('Too short')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Repeat new password'), 'abd');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText('That is shorter than 6 characters.')).toBeInTheDocument();
    expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument();
    expect(sent).not.toHaveBeenCalled();
  });

  it('explains a refusal, which arrives with a 200 status', async () => {
    acceptToken();
    server.use(
      http.post('/api/users/password/confirm', () =>
        HttpResponse.json({ data: { message: 'Invalid or expired token.', status_code: 400 } }),
      ),
    );
    const { user, router } = renderApp('/reset-password?token=good');

    await user.type(await screen.findByLabelText('New password'), 'secret1');
    await user.type(screen.getByLabelText('Repeat new password'), 'secret1');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The password was not changed: Invalid or expired token.',
    );
    expect(router.state.location.pathname).toBe('/reset-password');
  });

  it.each([
    ['an expired token', '/reset-password?token=old'],
    ['no token', '/reset-password'],
  ])('offers a new link for %s', async (_, path) => {
    acceptToken();
    renderApp(path);

    expect(await screen.findByText('This link no longer works')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('says when the link cannot be checked', async () => {
    server.use(
      http.get('/api/users/password/validate/:token', () =>
        HttpResponse.json({ message: 'Down' }, { status: 503 }),
      ),
    );
    renderApp('/reset-password?token=good');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check the link: Down');
  });
});
