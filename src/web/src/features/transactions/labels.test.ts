import { changeOf, deviceLabel, transactionStatusOf, transactionTypeLabel } from './labels';

describe('changeOf', () => {
  it('gives the change as a signed percentage of the past value', () => {
    expect(changeOf(412, 380, 'percent')).toEqual({ text: '+8.4%', direction: 'up' });
    expect(changeOf(50, 100, 'percent')).toEqual({ text: '−50%', direction: 'down' });
  });

  it('gives the change as a signed count', () => {
    expect(changeOf(11, 8, 'count')).toEqual({ text: '+3', direction: 'up' });
    expect(changeOf(1, 1200, 'count')).toEqual({ text: '−1,199', direction: 'down' });
  });

  it('says when nothing changed', () => {
    expect(changeOf(5, 5, 'percent')).toEqual({ text: 'No change', direction: 'flat' });
    expect(changeOf(0, 0, 'count')).toEqual({ text: 'No change', direction: 'flat' });
    expect(changeOf(0, 0, 'percent')).toEqual({ text: 'No change', direction: 'flat' });
  });

  it('has no percentage of nothing', () => {
    expect(changeOf(3, 0, 'percent')).toBeNull();
  });
});

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
