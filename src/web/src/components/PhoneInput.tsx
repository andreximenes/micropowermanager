import { Input } from '@spark/ui/input';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { selectClass } from '@/components/form';
import { dialCountries } from '@/lib/phone';

type PhoneInputProps = {
  countryCode: UseFormRegisterReturn;
  phone: UseFormRegisterReturn;
  invalid?: boolean;
};

/** A country dialling code and the local number, joined into E.164 with `joinPhone`. */
export function PhoneInput({ countryCode, phone, invalid }: PhoneInputProps) {
  return (
    <span className="flex gap-1.5">
      <select aria-label="Country code" className={`${selectClass} w-28 shrink-0`} {...countryCode}>
        {dialCountries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.code} {country.dial}
          </option>
        ))}
      </select>
      <Input
        type="tel"
        inputMode="tel"
        aria-label="Phone number"
        aria-invalid={invalid}
        placeholder="803 555 0199"
        {...phone}
      />
    </span>
  );
}
