import { Banner } from '@spark/ui/banner';

import { ApiError } from '@/api/client';

type ConnectionResultProps = { valid: boolean | undefined; error: Error | null };

function failureMessage(error: Error): string {
  if (error instanceof ApiError && error.status === 503) {
    return 'Could not reach the Spark cloud. Check the addresses, or try again in a moment.';
  }
  return `The test failed: ${error.message}`;
}

/** The outcome of "Test connection", kept in view until the next test. */
export function ConnectionResult({ valid, error }: ConnectionResultProps) {
  if (error) {
    return (
      <Banner tone="error" role="alert">
        {failureMessage(error)}
      </Banner>
    );
  }
  if (valid === undefined) {
    return null;
  }
  return valid ? (
    <Banner tone="success" role="status">
      Connection works. Spark accepted the credentials and answered.
    </Banner>
  ) : (
    <Banner tone="error" role="alert">
      Spark refused these credentials. Check the client ID and secret.
    </Banner>
  );
}
