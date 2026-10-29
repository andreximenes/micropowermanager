import { showFieldErrors } from './fieldErrors';

import { ApiError } from '@/api/client';

describe('showFieldErrors', () => {
  it('puts the first message of each known field on its form field', () => {
    const setError = vi.fn();

    showFieldErrors(
      new ApiError(422, 'Invalid', { name: ['Too short.', 'Taken.'], other: ['Ignored.'] }),
      setError,
      { name: 'title' },
    );

    expect(setError).toHaveBeenCalledExactlyOnceWith('title', {
      type: 'server',
      message: 'Too short.',
    });
  });

  it('ignores errors that are not API errors', () => {
    const setError = vi.fn();

    showFieldErrors(new Error('offline'), setError, { name: 'title' });

    expect(setError).not.toHaveBeenCalled();
  });
});
