import { Input } from '@spark/ui/input';
import {
  useController,
  type Control,
  type FieldValues,
  type Path,
  type UseFormRegisterReturn,
} from 'react-hook-form';

import { dialCountries } from '@/lib/phone';

import { SelectSearch } from './Combobox';

type PhoneInputProps<Values extends FieldValues> = {
  control: Control<Values>;
  /** The form field that holds the ISO country code, e.g. `NG`. */
  countryCodeName: Path<Values>;
  phone: UseFormRegisterReturn;
  invalid?: boolean;
};

const dialOptions = dialCountries.map((country) => ({
  value: country.code,
  label: `${country.code} ${country.dial}`,
  detail: country.name,
}));

/** A country dialling code and the local number, joined into E.164 with `joinPhone`. */
export function PhoneInput<Values extends FieldValues>({
  control,
  countryCodeName,
  phone,
  invalid,
}: PhoneInputProps<Values>) {
  const { field } = useController({ control, name: countryCodeName });
  return (
    <span className="flex gap-1.5">
      <SelectSearch
        label="Country code"
        noun="countries"
        emptyText="No matching country."
        className="w-32 shrink-0"
        value={String(field.value ?? '')}
        onChange={field.onChange}
        onBlur={field.onBlur}
        options={dialOptions}
      />
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
