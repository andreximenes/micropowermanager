import { formatDate, formatMoney, initials, paymentChannel } from './format';

describe('formatMoney', () => {
  it('prefixes the currency and groups thousands', () => {
    expect(formatMoney(1234567, 'TZS')).toBe('TZS 1,234,567');
  });

  it('keeps at most two decimals', () => {
    expect(formatMoney(10.456, 'USD')).toBe('USD 10.46');
    expect(formatMoney(10.5, 'USD')).toBe('USD 10.5');
  });
});

describe('formatDate', () => {
  it('formats in UTC so plain dates never shift a day', () => {
    expect(formatDate('2026-03-01')).toBe('01 Mar 2026');
    expect(formatDate('2026-03-01T23:30:00Z')).toBe('01 Mar 2026');
  });

  it.each([null, undefined, '', 'not a date'])('shows a dash for %j', (value) => {
    expect(formatDate(value)).toBe('—');
  });
});

describe('initials', () => {
  it('upper-cases the first letters', () => {
    expect(initials('amina', 'okafor')).toBe('AO');
  });

  it('tolerates empty names', () => {
    expect(initials('', 'Okafor')).toBe('O');
  });
});

describe('paymentChannel', () => {
  it('turns a transaction table name into a label', () => {
    expect(paymentChannel('wavecom_transaction')).toBe('Wavecom');
    expect(paymentChannel('mesomb_mobile_money_transaction')).toBe('Mesomb Mobile Money');
    expect(paymentChannel('cash')).toBe('Cash');
  });

  it('shows a dash when there is no service', () => {
    expect(paymentChannel(null)).toBe('—');
    expect(paymentChannel('')).toBe('—');
  });
});
