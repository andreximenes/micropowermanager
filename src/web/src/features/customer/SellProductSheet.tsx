import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';

import { fetchStockDevices, sellProduct, type SaleInput } from '@/api/customers';
import { fetchAppliances } from '@/api/products';
import type { Person } from '@/api/schemas';
import { Field, selectClass, Step } from '@/components/form';
import { LocationMap, type LatLng } from '@/components/LocationMap';
import { Sheet } from '@/components/Sheet';
import { formatDate, formatMoney } from '@/lib/format';
import { pointOf } from '@/lib/geo';

import { previewPlan } from './salePlan';

type SellProductSheetProps = {
  customer: Person;
  userId: number;
  currency: string;
  onClose: () => void;
};

const numberOf = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

export function SellProductSheet({ customer, userId, currency, onClose }: SellProductSheetProps) {
  const queryClient = useQueryClient();
  const primary = customer.addresses.find((address) => address.is_primary === 1) ?? customer.addresses[0];
  const homePoint = pointOf(primary?.geo);

  const [applianceId, setApplianceId] = useState<number | null>(null);
  const [serialSearch, setSerialSearch] = useState('');
  const [deviceSerial, setDeviceSerial] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<SaleInput['paymentType']>('installment');
  const [totalCost, setTotalCost] = useState('');
  const [downPayment, setDownPayment] = useState('0');
  const [rateCount, setRateCount] = useState('12');
  const [rateType, setRateType] = useState<'monthly' | 'weekly'>('monthly');
  const [pricePerDay, setPricePerDay] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [useHomeAddress, setUseHomeAddress] = useState(true);
  const [pickedPoint, setPickedPoint] = useState<LatLng | null>(homePoint);

  const appliances = useQuery({ queryKey: ['appliances'], queryFn: fetchAppliances });
  const stock = useQuery({
    queryKey: ['stock-devices', applianceId, serialSearch],
    queryFn: () => fetchStockDevices(applianceId as number, serialSearch),
    enabled: applianceId !== null,
  });

  const preview = previewPlan({
    totalCost: numberOf(totalCost),
    downPayment: numberOf(downPayment || '0'),
    rateCount: numberOf(rateCount),
    rateType,
  });

  const plan: SaleInput | null =
    paymentType === 'installment'
      ? preview
        ? { paymentType, cost: numberOf(totalCost), downPayment: numberOf(downPayment || '0'), rateCount: numberOf(rateCount), rateType }
        : null
      : numberOf(pricePerDay) > 0
        ? { paymentType, pricePerDay: numberOf(pricePerDay), minimumPayableAmount: numberOf(minimumPayment || '0') }
        : null;

  const location = deviceSerial ? (useHomeAddress ? homePoint : pickedPoint) : null;

  const sale = useMutation({
    mutationFn: () =>
      sellProduct({
        userId,
        customerId: customer.id,
        applianceId: applianceId as number,
        deviceSerial,
        location,
        plan: plan as SaleInput,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contracts', customer.id] }),
        queryClient.invalidateQueries({ queryKey: ['customer', customer.id] }),
      ]);
      onClose();
    },
  });

  function chooseAppliance(value: string) {
    const id = Number(value);
    const appliance = appliances.data?.find((item) => item.id === id);
    setApplianceId(appliance ? id : null);
    setDeviceSerial(null);
    setTotalCost(appliance ? String(appliance.price) : '');
  }

  const ready = applianceId !== null && plan !== null && !sale.isPending;
  const downPaymentNow = paymentType === 'installment' ? numberOf(downPayment || '0') : 0;

  return (
    <Sheet
      title="Sell product"
      description={`to ${customer.name} ${customer.surname}`}
      onClose={onClose}
      footer={
        <>
          <div className="min-w-0 flex-1 text-sm">
            {paymentType === 'installment' && preview ? (
              <>
                <div className="font-semibold">
                  {downPaymentNow > 0 ? `Down payment ${formatMoney(downPaymentNow, currency)} now` : 'No down payment'}
                </div>
                <div className="text-muted-foreground">
                  Then {formatMoney(preview.installment, currency)} {rateType === 'monthly' ? 'per month' : 'per week'}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">Fill in the plan to see the summary.</div>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ready} onClick={() => sale.mutate()}>
            {sale.isPending ? 'Saving…' : 'Confirm sale'}
          </Button>
        </>
      }
    >
      {sale.isError ? (
        <Banner tone="error" role="alert">
          The sale was not saved: {sale.error.message}
        </Banner>
      ) : null}

      <Step title="1 · Product and device">
        <Field label="Product">
          <select className={selectClass} value={applianceId ?? ''} onChange={(event) => chooseAppliance(event.target.value)}>
            <option value="">Choose a product</option>
            {(appliances.data ?? []).map((appliance) => (
              <option key={appliance.id} value={appliance.id}>
                {appliance.name} · {formatMoney(appliance.price, currency)}
              </option>
            ))}
          </select>
        </Field>
        {applianceId !== null ? (
          <Field label="Device from stock (optional)">
            <Input
              type="search"
              placeholder="Search by serial"
              value={serialSearch}
              onChange={(event) => setSerialSearch(event.target.value)}
            />
          </Field>
        ) : null}
        {applianceId !== null && !deviceSerial ? (
          <ul aria-label="Devices in stock" className="flex flex-col gap-1">
            {(stock.data?.data ?? []).map((device) => (
              <li key={device.id}>
                <button
                  type="button"
                  onClick={() => setDeviceSerial(device.device_serial)}
                  className="w-full rounded-md border border-border px-3 py-2 text-left font-mono text-sm hover:bg-panel-2"
                >
                  {device.device_serial}
                </button>
              </li>
            ))}
            {stock.data && stock.data.data.length === 0 ? (
              <li className="text-sm text-muted-foreground">No unassigned devices of this product match.</li>
            ) : null}
          </ul>
        ) : null}
        {deviceSerial ? (
          <div className="flex items-center gap-2.5 rounded-md border border-auto-line bg-auto-bg px-3 py-2.5 text-sm text-auto-ink">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">
              Device <span className="font-mono">{deviceSerial}</span> from stock
            </span>
            <Button size="sm" variant="ghost" onClick={() => setDeviceSerial(null)}>
              Change
            </Button>
          </div>
        ) : null}
      </Step>

      <Step title="2 · Payment plan">
        <div role="radiogroup" aria-label="Plan type" className="grid grid-cols-2 gap-2">
          {(
            [
              ['installment', 'Installments', 'Customer owns the product when paid off'],
              ['energy_service', 'Energy as a service', 'Pays per day, never owns it'],
            ] as const
          ).map(([value, title, hint]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={paymentType === value}
              onClick={() => setPaymentType(value)}
              className={`rounded-lg border px-4 py-3 text-left ${paymentType === value ? 'border-2 border-primary' : 'border-border'}`}
            >
              <div className="font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">{hint}</div>
            </button>
          ))}
        </div>
        {paymentType === 'installment' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total price">
                <Input inputMode="decimal" value={totalCost} onChange={(event) => setTotalCost(event.target.value)} />
              </Field>
              <Field label="Down payment">
                <Input inputMode="decimal" value={downPayment} onChange={(event) => setDownPayment(event.target.value)} />
              </Field>
              <Field label="Frequency">
                <select className={selectClass} value={rateType} onChange={(event) => setRateType(event.target.value as 'monthly' | 'weekly')}>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </Field>
              <Field label="Number of installments">
                <Input inputMode="numeric" value={rateCount} onChange={(event) => setRateCount(event.target.value)} />
              </Field>
            </div>
            {preview ? (
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-lg bg-panel-2 px-4 py-3.5 text-sm">
                <dt className="text-muted-foreground">Each installment</dt>
                <dd className="m-0 font-semibold">{formatMoney(preview.installment, currency)}</dd>
                <dt className="text-muted-foreground">First due</dt>
                <dd className="m-0 font-semibold">{formatDate(preview.firstDue.toISOString())}</dd>
                <dt className="text-muted-foreground">Paid off</dt>
                <dd className="m-0 font-semibold">{formatDate(preview.paidOffBy.toISOString())}</dd>
              </dl>
            ) : null}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price per day">
              <Input inputMode="decimal" value={pricePerDay} onChange={(event) => setPricePerDay(event.target.value)} />
            </Field>
            <Field label="Minimum payment">
              <Input inputMode="decimal" value={minimumPayment} onChange={(event) => setMinimumPayment(event.target.value)} />
            </Field>
          </div>
        )}
      </Step>

      {deviceSerial ? (
        <Step title="3 · Where the device is installed">
          {homePoint ? (
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={useHomeAddress}
                onChange={(event) => setUseHomeAddress(event.target.checked)}
                className="size-4 accent-primary"
              />
              Same as the customer&apos;s address
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">
              The customer&apos;s address has no map location, so the device will be saved without one.
            </p>
          )}
          {homePoint && !useHomeAddress && pickedPoint ? (
            <>
              <LocationMap
                position={pickedPoint}
                label="Drag the pin to where the device is installed"
                onMove={setPickedPoint}
                className="h-52 w-full overflow-hidden rounded-lg border border-border"
              />
              <p className="text-xs text-muted-foreground">
                Drag the pin to the installation site · {pickedPoint.latitude.toFixed(5)}, {pickedPoint.longitude.toFixed(5)}
              </p>
            </>
          ) : null}
        </Step>
      ) : null}
    </Sheet>
  );
}
