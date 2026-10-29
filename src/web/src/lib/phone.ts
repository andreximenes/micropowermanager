export type DialCountry = { code: string; name: string; dial: string };

// Countries where MPM operators run mini-grids and solar home systems, plus a few
// common home countries of staff. Any other number can be typed with its leading `+`.
export const dialCountries: DialCountry[] = [
  { code: 'BJ', name: 'Benin', dial: '+229' },
  { code: 'BF', name: 'Burkina Faso', dial: '+226' },
  { code: 'BI', name: 'Burundi', dial: '+257' },
  { code: 'CM', name: 'Cameroon', dial: '+237' },
  { code: 'CD', name: 'DR Congo', dial: '+243' },
  { code: 'ET', name: 'Ethiopia', dial: '+251' },
  { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'GH', name: 'Ghana', dial: '+233' },
  { code: 'HT', name: 'Haiti', dial: '+509' },
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'KE', name: 'Kenya', dial: '+254' },
  { code: 'LR', name: 'Liberia', dial: '+231' },
  { code: 'MG', name: 'Madagascar', dial: '+261' },
  { code: 'MW', name: 'Malawi', dial: '+265' },
  { code: 'ML', name: 'Mali', dial: '+223' },
  { code: 'MZ', name: 'Mozambique', dial: '+258' },
  { code: 'MM', name: 'Myanmar', dial: '+95' },
  { code: 'NP', name: 'Nepal', dial: '+977' },
  { code: 'NE', name: 'Niger', dial: '+227' },
  { code: 'NG', name: 'Nigeria', dial: '+234' },
  { code: 'RW', name: 'Rwanda', dial: '+250' },
  { code: 'SN', name: 'Senegal', dial: '+221' },
  { code: 'SL', name: 'Sierra Leone', dial: '+232' },
  { code: 'SO', name: 'Somalia', dial: '+252' },
  { code: 'ZA', name: 'South Africa', dial: '+27' },
  { code: 'SS', name: 'South Sudan', dial: '+211' },
  { code: 'TZ', name: 'Tanzania', dial: '+255' },
  { code: 'TG', name: 'Togo', dial: '+228' },
  { code: 'UG', name: 'Uganda', dial: '+256' },
  { code: 'GB', name: 'United Kingdom', dial: '+44' },
  { code: 'US', name: 'United States', dial: '+1' },
  { code: 'ZM', name: 'Zambia', dial: '+260' },
  { code: 'ZW', name: 'Zimbabwe', dial: '+263' },
];

const NIGERIA = 'NG';

/** The company's own country when the list has it, Nigeria otherwise. */
export function defaultCountryCode(companyCountry: string | null | undefined): string {
  const name = companyCountry?.trim().toLowerCase();
  return dialCountries.find((country) => country.name.toLowerCase() === name)?.code ?? NIGERIA;
}

/** Splits an E.164 number into a listed country and the rest of the number. */
export function splitPhone(
  phone: string | null | undefined,
  fallbackCode: string,
): { countryCode: string; local: string } {
  if (!phone) {
    return { countryCode: fallbackCode, local: '' };
  }
  const match = [...dialCountries]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((country) => phone.startsWith(country.dial));
  return match
    ? { countryCode: match.code, local: phone.slice(match.dial.length) }
    : { countryCode: fallbackCode, local: phone };
}

/** Builds an E.164 number, or null when no number was typed. */
export function joinPhone(countryCode: string, local: string): string | null {
  const digits = local.replace(/[\s()-]/g, '');
  if (digits === '') {
    return null;
  }
  if (digits.startsWith('+')) {
    return digits;
  }
  const dial = dialCountries.find((country) => country.code === countryCode)?.dial ?? '';
  // Numbers are often written with the national trunk prefix (0803…), which E.164 drops.
  return `${dial}${digits.replace(/^0+/, '')}`;
}
