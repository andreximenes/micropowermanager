import { deviceLabel, transactionStatusOf, transactionTypeLabel } from './labels';

describe('transactionStatusOf', () => {
  it.each([
    [1, 'Confirmed'],
    [2, 'Confirmed'],
    [0, 'Processing'],
    [-1, 'Rejected'],
    [3, 'Cancelled'],
    [9, 'Unknown'],
  ])('reads provider status %i as %s', (status, label) => {
    expect(transactionStatusOf({ status }).label).toBe(label);
  });

  it('has no status before the provider recorded one', () => {
    expect(transactionStatusOf(null).label).toBe('Unknown');
  });
});

describe('labels', () => {
  it('names transaction types and devices in plain words', () => {
    expect(transactionTypeLabel('deferred_payment')).toBe('Installment');
    expect(transactionTypeLabel('access_rate')).toBe('Access rate');
    expect(transactionTypeLabel(null)).toBe('—');
    expect(deviceLabel('solar_home_system')).toBe('Solar home system');
    expect(deviceLabel('smart_lock')).toBe('Smart lock');
  });
});
