import { Card, CardContent } from '@spark/ui/card';
import { SparkLogo } from '@spark/ui/spark-logo';
import { type ReactNode } from 'react';

/** The signed-out frame shared by sign-in and password reset: the brand above one card. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-foreground">
          <SparkLogo className="h-8 w-auto fill-foreground" />
          <h1 className="text-2xl font-semibold">Spark CRM</h1>
          <p className="text-sm text-muted-foreground">Powered by MicroPowerManager</p>
        </div>
        <Card className="w-full">
          <CardContent className="pt-6">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

/** The card's own heading; the page's h1 is the brand. */
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      {children ? (
        <p className="m-0 mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
      ) : null}
    </div>
  );
}
