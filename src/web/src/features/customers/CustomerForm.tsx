import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { LocateFixed } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { z } from 'zod';

import { fetchMainSettings, fetchMapSettings } from '@/api/customers';
import {
  createPerson,
  deletePerson,
  savePrimaryAddress,
  updatePerson,
  type AddressDetails,
  type PersonDetails,
} from '@/api/people';
import type { Person } from '@/api/schemas';
import { Field, selectClass, Step } from '@/components/form';
import { LocationMap, type LatLng } from '@/components/LocationMap';
import { PhoneInput } from '@/components/PhoneInput';
import { Sheet } from '@/components/Sheet';
import { VillagePicker } from '@/components/VillagePicker';
import { showFieldErrors } from '@/lib/fieldErrors';
import { pointOf } from '@/lib/geo';
import { defaultCountryCode, joinPhone, splitPhone } from '@/lib/phone';

const genders = ['female', 'male', 'other'] as const;

const formSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters.'),
  surname: z.string().trim().min(2, 'Enter at least 2 characters.'),
  countryCode: z.string(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]*$/, 'Use digits only.'),
  email: z.union([z.literal(''), z.email('Enter a valid e-mail address.')]),
  gender: z.enum(['', ...genders]),
  birthDate: z.string(),
  title: z.string().trim(),
  education: z.string().trim(),
  village: z
    .object({ id: z.number(), name: z.string() })
    .nullable()
    .refine((village) => village !== null, 'Choose the village.'),
  street: z
    .string()
    .trim()
    .refine((street) => street === '' || street.length >= 5, 'Enter at least 5 characters.'),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

// Laravel reports validation errors by request field; these are the form fields they belong to.
const formFieldOf: Record<string, Path<FormInput>> = {
  name: 'name',
  surname: 'surname',
  title: 'title',
  education: 'education',
  birth_date: 'birthDate',
  gender: 'gender',
  email: 'email',
  phone: 'phone',
  country_code: 'phone',
  city_id: 'village',
  street: 'street',
};

const blankToNull = (value: string) => (value === '' ? null : value);

type CustomerFormProps = {
  /** The customer to edit; without it the form registers a new customer. */
  person?: Person;
  onClose: () => void;
};

export function CustomerForm({ person, onClose }: CustomerFormProps) {
  const formId = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const mapSettings = useQuery({ queryKey: ['map-settings'], queryFn: fetchMapSettings });
  const primary =
    person?.addresses.find((address) => address.is_primary === 1) ?? person?.addresses[0];
  const fallbackCountry = defaultCountryCode(settings.data?.country);
  const phone = splitPhone(primary?.phone, fallbackCountry);
  const gender = genders.find((value) => value === person?.gender?.toLowerCase()) ?? '';

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: person?.name ?? '',
      surname: person?.surname ?? '',
      countryCode: phone.countryCode,
      phone: phone.local,
      email: primary?.email ?? '',
      gender,
      birthDate: person?.birth_date?.slice(0, 10) ?? '',
      title: person?.title ?? '',
      education: person?.education ?? '',
      village: primary?.city ? { id: primary.city.id, name: primary.city.name } : null,
      street: primary?.street ?? '',
    },
  });

  // The company's country may arrive after the form opened; it only replaces the guess.
  useEffect(() => {
    if (!primary?.phone && settings.data && !getFieldState('countryCode').isDirty) {
      setValue('countryCode', defaultCountryCode(settings.data.country));
    }
  }, [primary?.phone, settings.data, getFieldState, setValue]);

  const [point, setPoint] = useState<LatLng | null>(pointOf(primary?.geo));
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const details: PersonDetails = {
        name: values.name,
        surname: values.surname,
        title: blankToNull(values.title),
        education: blankToNull(values.education),
        birth_date: blankToNull(values.birthDate),
        gender: blankToNull(values.gender),
      };
      const address: AddressDetails = {
        email: blankToNull(values.email),
        phone: joinPhone(values.countryCode, values.phone),
        street: blankToNull(values.street),
        city_id: values.village.id,
        points: point ? `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}` : null,
      };
      if (!person) {
        return createPerson(details, { ...address, country_code: values.countryCode });
      }
      await updatePerson(person.id, details);
      await savePrimaryAddress(person.id, primary?.id ?? null, address);
      return { id: person.id };
    },
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: ['people'] });
      onClose();
      if (person) {
        await queryClient.invalidateQueries({ queryKey: ['customer', id] });
        return;
      }
      await navigate({ to: '/customers/$customerId', params: { customerId: id } });
    },
    onError: (error) => showFieldErrors(error, setError, formFieldOf),
  });

  const removal = useMutation({
    mutationFn: () => deletePerson((person as Person).id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['customer', (person as Person).id] });
      await queryClient.invalidateQueries({ queryKey: ['people'] });
      onClose();
      await navigate({ to: '/customers' });
    },
  });

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setLocationError('This browser cannot share its location. Drag the pin instead.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setPoint({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location access was denied. Drag the pin instead.'
            : 'Could not find your location. Drag the pin instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const mapCentre: LatLng | null =
    point ??
    (mapSettings.data
      ? { latitude: mapSettings.data.latitude, longitude: mapSettings.data.longitude }
      : null);

  return (
    <Sheet
      title={person ? 'Edit customer' : 'New customer'}
      description={
        person
          ? `${person.name} ${person.surname}`
          : 'Name and village are required. The rest can be added later.'
      }
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            {person
              ? 'Name and village are required.'
              : 'After saving, the customer profile opens so you can sell a product.'}
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save customer'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
        className="flex flex-col gap-6"
      >
        {save.isError ? (
          <Banner tone="error" role="alert">
            The customer was not saved: {save.error.message}
          </Banner>
        ) : null}

        <Step title="1 · Personal details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name *" error={errors.name?.message}>
              <Input autoComplete="off" aria-invalid={Boolean(errors.name)} {...register('name')} />
            </Field>
            <Field label="Last name *" error={errors.surname?.message}>
              <Input
                autoComplete="off"
                aria-invalid={Boolean(errors.surname)}
                {...register('surname')}
              />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <PhoneInput
                countryCode={register('countryCode')}
                phone={register('phone')}
                invalid={Boolean(errors.phone)}
              />
            </Field>
            <Field label="E-mail" error={errors.email?.message}>
              <Input
                type="email"
                placeholder="Optional"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </Field>
            <Field label="Gender" error={errors.gender?.message}>
              <select className={selectClass} {...register('gender')}>
                <option value="">Not given</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Date of birth" error={errors.birthDate?.message}>
              <Input type="date" {...register('birthDate')} />
            </Field>
          </div>
          <details open={Boolean(person?.title || person?.education)} className="text-sm">
            <summary className="cursor-pointer font-medium">
              More details (title, education)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Title" error={errors.title?.message}>
                <Input placeholder="Mrs., Dr., Chief…" {...register('title')} />
              </Field>
              <Field label="Education" error={errors.education?.message}>
                <Input {...register('education')} />
              </Field>
            </div>
          </details>
        </Step>

        <Step title="2 · Where the customer lives">
          <Field label="Village *" error={errors.village?.message}>
            <Controller
              control={control}
              name="village"
              render={({ field }) => (
                <VillagePicker
                  label="Village *"
                  placeholder="Start typing the village name"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.village)}
                />
              )}
            />
          </Field>
          <Field label="Street or landmark" error={errors.street?.message}>
            <Input aria-invalid={Boolean(errors.street)} {...register('street')} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-label">House on the map</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={locateMe}
              disabled={locating}
            >
              <LocateFixed aria-hidden="true" />
              {locating ? 'Finding you…' : 'Use my location'}
            </Button>
          </div>
          {locationError ? (
            <Banner tone="warning" role="alert">
              {locationError}
            </Banner>
          ) : null}
          {mapCentre ? (
            <>
              <LocationMap
                position={mapCentre}
                label="Map with a draggable pin on the customer's house"
                onMove={setPoint}
                className="h-56 w-full overflow-hidden rounded-lg border border-border"
              />
              <p className="m-0 text-xs text-muted-foreground">
                {point
                  ? `Drag the pin to the house · ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
                  : 'Drag the pin to the house, or use your location. Without a pin, no location is saved.'}
              </p>
            </>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              {mapSettings.isPending
                ? 'Loading map…'
                : 'No map centre is set for this company. Use your location to place the pin.'}
            </p>
          )}
        </Step>
      </form>

      {person ? (
        <section className="flex flex-col gap-3 border-t border-border pt-5">
          {removal.isError ? (
            <Banner tone="error" role="alert">
              The customer was not deleted: {removal.error.message}
            </Banner>
          ) : null}
          {confirmingDelete ? (
            <div className="flex flex-col gap-3 rounded-lg border border-red bg-red/10 p-4 text-sm">
              <p className="m-0 font-semibold">
                Delete {person.name} {person.surname}? They will disappear from the customer list.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={removal.isPending}
                  onClick={() => removal.mutate()}
                >
                  {removal.isPending ? 'Deleting…' : 'Yes, delete'}
                </Button>
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                  Keep customer
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                variant="outline"
                className="text-red"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete customer
              </Button>
            </div>
          )}
        </section>
      ) : null}
    </Sheet>
  );
}
