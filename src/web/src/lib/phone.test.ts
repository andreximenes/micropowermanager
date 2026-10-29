import { defaultCountryCode, joinPhone, splitPhone } from './phone';

describe('defaultCountryCode', () => {
  it('uses the company country when the list has it', () => {
    expect(defaultCountryCode('Tanzania')).toBe('TZ');
    expect(defaultCountryCode(' kenya ')).toBe('KE');
  });

  it('falls back to Nigeria', () => {
    expect(defaultCountryCode('Atlantis')).toBe('NG');
    expect(defaultCountryCode(null)).toBe('NG');
  });
});

describe('splitPhone', () => {
  it('finds the country by the longest matching dial code', () => {
    expect(splitPhone('+2348035550199', 'TZ')).toEqual({ countryCode: 'NG', local: '8035550199' });
    expect(splitPhone('+15551234567', 'TZ')).toEqual({ countryCode: 'US', local: '5551234567' });
  });

  it('keeps an unknown number whole', () => {
    expect(splitPhone('+81312345678', 'NG')).toEqual({ countryCode: 'NG', local: '+81312345678' });
  });

  it('starts empty without a number', () => {
    expect(splitPhone(null, 'NG')).toEqual({ countryCode: 'NG', local: '' });
  });
});

describe('joinPhone', () => {
  it('prefixes the dial code and drops spaces and the trunk zero', () => {
    expect(joinPhone('NG', '0803 555-0199')).toBe('+2348035550199');
  });

  it('keeps a number typed with its own country code', () => {
    expect(joinPhone('NG', '+81 3 1234 5678')).toBe('+81312345678');
  });

  it('returns null when nothing was typed', () => {
    expect(joinPhone('NG', '  ')).toBeNull();
  });

  it('adds no prefix for an unknown country', () => {
    expect(joinPhone('XX', '123')).toBe('123');
  });
});
