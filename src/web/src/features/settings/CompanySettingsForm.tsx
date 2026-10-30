import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, type Path } from 'react-hook-form';
import { z } from 'zod';

import {
  fetchCompanySettings,
  fetchCountries,
  fetchCurrencies,
  fetchUsageTypes,
  updateCompanySettings,
  type CompanySettings,
} from '@/api/settings';
import { SelectSearch } from '@/components/Combobox';
import { Field, selectClass, Step } from '@/components/form';
import { showFieldErrors } from '@/lib/fieldErrors';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'bu', label: 'Burmese' },
];

const percent = z
  .string()
  .trim()
  .min(1, 'Enter a rate, 0 for none.')
  .refine((value) => {
    const rate = Number(value);
    return Number.isFinite(rate) && rate >= 0 && rate <= 100;
  }, 'Use a number from 0 to 100.');

const formSchema = z.object({
  companyName: z.string().trim().min(1, 'Enter the company name.'),
  siteTitle: z.string().trim(),
  country: z.string(),
  currency: z.string().min(1, 'Choose the currency.'),
  language: z.string(),
  usageType: z.string(),
  vatEnergy: percent,
  vatAppliance: percent,
  maxTokenDays: z
    .string()
    .trim()
    .regex(/^(\d+)?$/, 'Use a whole number of days, or leave it empty for no limit.'),
});
type FormValues = z.infer<typeof formSchema>;

const formFieldOf: Record<string, Path<FormValues>> = {
  company_name: 'companyName',
  site_title: 'siteTitle',
  country: 'country',
  currency: 'currency',
  language: 'language',
  usage_type: 'usageType',
  vat_energy: 'vatEnergy',
  vat_appliance: 'vatAppliance',
  down_payment_max_token_days: 'maxTokenDays',
};

function formValuesOf(settings: CompanySettings | undefined): FormValues {
  return {
    companyName: settings?.company_name ?? '',
    siteTitle: settings?.site_title ?? '',
    country: settings?.country ?? '',
    currency: settings?.currency ?? '',
    language: settings?.language ?? '',
    usageType: settings?.usage_type ?? '',
    vatEnergy: settings ? String(settings.vat_energy) : '',
    vatAppliance: settings ? String(settings.vat_appliance) : '',
    maxTokenDays: settings?.down_payment_max_token_days?.toString() ?? '',
  };
}

const blankToNull = (value: string) => (value === '' ? null : value);

export function CompanySettingsForm() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['main-settings', 'full'], queryFn: fetchCompanySettings });
  const currencies = useQuery({ queryKey: ['currencies'], queryFn: fetchCurrencies });
  const countries = useQuery({ queryKey: ['countries'], queryFn: fetchCountries });
  const usageTypes = useQuery({ queryKey: ['usage-types'], queryFn: fetchUsageTypes });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: formValuesOf(settings.data),
    resetOptions: { keepDirtyValues: true },
  });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      updateCompanySettings(settings.data as CompanySettings, {
        company_name: values.companyName,
        site_title: blankToNull(values.siteTitle),
        country: blankToNull(values.country),
        currency: values.currency,
        language: blankToNull(values.language),
        usage_type: blankToNull(values.usageType),
        vat_energy: Number(values.vatEnergy),
        vat_appliance: Number(values.vatAppliance),
        down_payment_max_token_days:
          values.maxTokenDays === '' ? null : Number(values.maxTokenDays),
      }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['main-settings', 'full'], saved);
      reset(formValuesOf(saved));
      await queryClient.invalidateQueries({ queryKey: ['main-settings'] });
    },
    onError: (error) => showFieldErrors(error, setError, formFieldOf),
  });

  if (settings.isPending) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading settings…</p>;
  }
  if (settings.isError) {
    return (
      <Banner tone="error" role="alert">
        Could not load the company settings: {settings.error.message}
      </Banner>
    );
  }

  const optionsError = currencies.error ?? countries.error ?? usageTypes.error;
  const currentCountry = settings.data.country;
  const countryOptions =
    currentCountry && countries.data && !countries.data.includes(currentCountry)
      ? [currentCountry, ...countries.data]
      : (countries.data ?? (currentCountry ? [currentCountry] : []));

  return (
    <Card className="max-w-3xl bg-panel">
      <form
        noValidate
        aria-label="Company settings"
        onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
      >
        <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
          {optionsError ? (
            <Banner tone="error" role="alert">
              Could not load every list of choices: {optionsError.message}
            </Banner>
          ) : null}
          {save.isError ? (
            <Banner tone="error" role="alert">
              The settings were not saved: {save.error.message}
            </Banner>
          ) : null}
          {save.isSuccess && !isDirty ? (
            <Banner tone="success" role="status">
              Settings saved.
            </Banner>
          ) : null}

          <Step title="Company">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Company name *"
                error={errors.companyName?.message}
                className="sm:col-span-2"
              >
                <Input aria-invalid={Boolean(errors.companyName)} {...register('companyName')} />
              </Field>
              <Field label="Country" error={errors.country?.message}>
                <Controller
                  control={control}
                  name="country"
                  render={({ field }) => (
                    <SelectSearch
                      label="Country"
                      noun="countries"
                      emptyText="No matching country."
                      emptyLabel="Not set"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      options={countryOptions.map((country) => ({
                        value: country,
                        label: country,
                      }))}
                    />
                  )}
                />
              </Field>
              <Field label="Currency *" error={errors.currency?.message}>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <SelectSearch
                      label="Currency *"
                      noun="currencies"
                      emptyText="No matching currency."
                      invalid={Boolean(errors.currency)}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      options={(currencies.data ?? []).map((currency) => ({
                        value: currency.code,
                        label: `${currency.name} (${currency.code})`,
                        detail: currency.symbol,
                      }))}
                    />
                  )}
                />
              </Field>
              <Field label="Language" error={errors.language?.message}>
                <select className={`${selectClass} h-10`} {...register('language')}>
                  <option value="">Not set</option>
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Business type" error={errors.usageType?.message}>
                <select className={`${selectClass} h-10`} {...register('usageType')}>
                  <option value="">Not set</option>
                  {(usageTypes.data ?? []).map((usageType) => (
                    <option key={usageType.id} value={usageType.value}>
                      {usageType.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Browser tab title"
                error={errors.siteTitle?.message}
                className="sm:col-span-2"
              >
                <Input {...register('siteTitle')} />
              </Field>
            </div>
          </Step>

          <Step title="Tax">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="VAT on energy (%) *" error={errors.vatEnergy?.message}>
                <Input
                  inputMode="decimal"
                  aria-invalid={Boolean(errors.vatEnergy)}
                  {...register('vatEnergy')}
                />
              </Field>
              <Field label="VAT on products (%) *" error={errors.vatAppliance?.message}>
                <Input
                  inputMode="decimal"
                  aria-invalid={Boolean(errors.vatAppliance)}
                  {...register('vatAppliance')}
                />
              </Field>
            </div>
          </Step>

          <Step title="Sales">
            <Field
              label="Most token days a down payment can buy"
              error={errors.maxTokenDays?.message}
              className="sm:max-w-sm"
            >
              <Input
                inputMode="numeric"
                placeholder="No limit"
                aria-invalid={Boolean(errors.maxTokenDays)}
                {...register('maxTokenDays')}
              />
            </Field>
            <p className="m-0 text-xs text-muted-foreground sm:max-w-sm">
              A larger down payment still pays off installments, but the first token stops at this
              many days. Leave it empty for no limit.
            </p>
          </Step>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-4 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={!isDirty || save.isPending}
            onClick={() => reset(formValuesOf(settings.data), { keepDirtyValues: false })}
          >
            Discard changes
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
