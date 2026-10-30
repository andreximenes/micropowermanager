import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { type ClipboardEvent, type KeyboardEvent, useId, useState } from 'react';

import { ApiError } from '@/api/client';
import { fetchAppliances, SOLAR_HOME_SYSTEM_TYPE_ID } from '@/api/products';
import { createSolarHomeSystems, fetchShsManufacturers } from '@/api/solarHomeSystems';
import { Field, selectClass } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { plural } from '@/lib/format';

/** The backend's limits for a serial number. */
const MIN_SERIAL = 8;
const MAX_SERIAL = 15;

const separators = /[\s,;]+/;

function serialProblem(serial: string): string | null {
  return serial.length < MIN_SERIAL || serial.length > MAX_SERIAL
    ? `${MIN_SERIAL}–${MAX_SERIAL} characters`
    : null;
}

export function AddDevicesSheet({ onClose }: { onClose: () => void }) {
  const formId = useId();
  const queryClient = useQueryClient();
  const manufacturers = useQuery({
    queryKey: ['manufacturers', 'shs'],
    queryFn: fetchShsManufacturers,
  });
  const products = useQuery({ queryKey: ['appliances'], queryFn: fetchAppliances });
  const solarProducts = (products.data ?? []).filter(
    (product) => product.appliance_type_id === SOLAR_HOME_SYSTEM_TYPE_ID,
  );

  const [serials, setSerials] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [manufacturerId, setManufacturerId] = useState('');
  const [productId, setProductId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  /** The server's refusal of individual serials, such as one that is already registered. */
  const [serialErrors, setSerialErrors] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function addSerials(text: string) {
    const typed = text.split(separators).filter(Boolean);
    setSerials((current) => [...new Set([...current, ...typed])]);
    setDraft('');
  }

  function removeSerial(serial: string) {
    setSerials((current) => current.filter((existing) => existing !== serial));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (['Enter', ',', ' ', 'Tab'].includes(event.key) && draft.trim()) {
      event.preventDefault();
      addSerials(draft);
      return;
    }
    if (event.key === 'Backspace' && draft === '' && serials.length > 0) {
      setSerials((current) => current.slice(0, -1));
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    addSerials(`${draft} ${event.clipboardData.getData('text')}`);
  }

  const save = useMutation({
    mutationFn: (serialNumbers: string[]) =>
      createSolarHomeSystems({
        serialNumbers,
        manufacturerId: Number(manufacturerId),
        productId: Number(productId),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['solar-home-systems'] });
      onClose();
    },
    onError: (error, serialNumbers) => {
      if (!(error instanceof ApiError)) {
        return;
      }
      const bySerial: Record<string, string> = {};
      const byField: Record<string, string> = {};
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        const index = /^serial_numbers\.(\d+)$/.exec(field)?.[1];
        const serial = index === undefined ? undefined : serialNumbers[Number(index)];
        if (serial !== undefined) {
          bySerial[serial] = messages[0] ?? 'Not accepted';
        } else {
          byField[field] = messages[0] ?? '';
        }
      }
      setSerialErrors(bySerial);
      setFieldErrors(byField);
    },
  });

  // A serial still being typed counts too, so "Add" never silently drops it.
  const pending = draft.trim()
    ? [...new Set([...serials, ...draft.split(separators).filter(Boolean)])]
    : serials;
  const invalid = pending.filter((serial) => serialProblem(serial) !== null);
  const refused = pending.filter((serial) => serialErrors[serial] !== undefined);

  function submit() {
    setSubmitted(true);
    if (draft.trim()) {
      addSerials(draft);
    }
    const blocked = invalid.length > 0 || refused.length > 0;
    if (pending.length === 0 || blocked || !manufacturerId || !productId) {
      return;
    }
    setSerialErrors({});
    setFieldErrors({});
    save.mutate(pending);
  }

  const missing = (value: string, message: string) => (submitted && !value ? message : undefined);

  return (
    <Sheet
      title="Add devices"
      description="Paste or scan serials. Separate them with a space, comma or new line."
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            {pending.length === 0
              ? 'No serials yet'
              : refused.length > 0
                ? `${plural(refused.length, 'serial')} refused. Remove ${refused.length === 1 ? 'it' : 'them'} to add the rest.`
                : invalid.length > 0
                  ? `${plural(invalid.length, 'serial')} with the wrong length`
                  : `${plural(pending.length, 'new device')}`}
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending
              ? 'Adding…'
              : `Add ${pending.length > 0 ? plural(pending.length, 'device') : 'devices'}`}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        {save.isError ? (
          <Banner tone="error" role="alert">
            No devices were added: {save.error.message}
          </Banner>
        ) : null}
        <Field
          label="Serials *"
          error={
            submitted && pending.length === 0
              ? 'Add at least one serial.'
              : fieldErrors.serial_numbers
          }
        >
          <span className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input-border bg-input p-1.5 focus-within:ring-2 focus-within:ring-ring">
            <input
              aria-label="Serial number"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              onBlur={() => draft.trim() && addSerials(draft)}
              placeholder={serials.length === 0 ? '6380332001 6380332002 …' : ''}
              className="h-7 min-w-32 flex-1 bg-transparent px-1.5 text-sm text-foreground outline-none"
            />
          </span>
        </Field>
        {serials.length > 0 ? (
          <ul aria-label="Serials to add" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {serials.map((serial) => {
              const problem = serialErrors[serial] ?? serialProblem(serial);
              return (
                <li
                  key={serial}
                  className={`inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 tabular-nums text-sm ${problem ? 'bg-red/10 text-red' : 'bg-panel-2'}`}
                >
                  {serial}
                  {problem ? <span className="font-sans text-xs"> · {problem}</span> : null}
                  <button
                    type="button"
                    aria-label={`Remove ${serial}`}
                    onClick={() => removeSerial(serial)}
                    className="grid size-5 cursor-pointer place-items-center rounded-full hover:bg-border"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Manufacturer *"
            error={
              missing(manufacturerId, 'Choose the manufacturer.') ?? fieldErrors.manufacturer_id
            }
          >
            <select
              className={selectClass}
              value={manufacturerId}
              onChange={(event) => setManufacturerId(event.target.value)}
            >
              <option value="">Choose a manufacturer</option>
              {(manufacturers.data ?? []).map((manufacturer) => (
                <option key={manufacturer.id} value={manufacturer.id}>
                  {manufacturer.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Product *"
            error={missing(productId, 'Choose the product.') ?? fieldErrors.appliance_id}
          >
            <select
              className={selectClass}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Choose a product</option>
              {solarProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {manufacturers.isError || products.isError ? (
          <Banner tone="error" role="alert">
            Could not load the manufacturers or products:{' '}
            {(manufacturers.error ?? products.error)?.message}
          </Banner>
        ) : null}
      </form>
    </Sheet>
  );
}
