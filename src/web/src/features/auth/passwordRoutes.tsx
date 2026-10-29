import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';

import { rootRoute } from '@/routes/base';

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPasswordPage,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  validateSearch: z.object({ token: z.string().min(1).optional().catch(undefined) }),
  component: function ResetPasswordRoute() {
    const { token } = resetPasswordRoute.useSearch();
    return <ResetPasswordPage token={token} />;
  },
});

export const passwordRoutes = [forgotPasswordRoute, resetPasswordRoute];
