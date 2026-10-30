import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { StatusPill } from '@spark/ui/status-pill';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

import {
  checkDeviceMapping,
  fetchDeviceCapabilities,
  generateDeviceToken,
  type DeviceToken,
  type SolarHomeSystem,
} from '@/api/solarHomeSystems';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { selectClass } from '@/components/form';
import { SectionCard } from '@/features/customer/sections';
import { formatDateTime } from '@/lib/format';

import { groupDigits, mappingPill } from './solarHomeSystem';

const CURRENCY_UNIT = 'currency';

function TokenCode({ token, caption }: { token: DeviceToken; caption: string }) {
  const credit = token.token_amount
    ? `${token.token_amount} ${token.token_unit ?? ''}`.trim()
    : null;
  return (
    <div className="rounded-lg bg-panel-2 px-4 py-3">
      <div className="text-xs text-muted-foreground">
        {[caption, formatDateTime(token.created_at), credit].filter(Boolean).join(' · ')}
      </div>
      <div className="mt-1 tabular-nums text-xl font-bold tracking-wider break-all">
        {groupDigits(token.token)}
      </div>
    </div>
  );
}

type DeviceControlProps = {
  solarHomeSystem: SolarHomeSystem;
  deviceId: number;
  currency: string;
};

/** Talks to the manufacturer's device API: mapping checks and tokens issued without a payment. */
export function DeviceControl({ solarHomeSystem, deviceId, currency }: DeviceControlProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<string | null>(null);
  const [issued, setIssued] = useState<DeviceToken | null>(null);
  const [confirming, setConfirming] = useState<'unlock' | 'reset' | null>(null);
  const capabilities = useQuery({
    queryKey: ['device-capabilities', deviceId],
    queryFn: () => fetchDeviceCapabilities(deviceId),
  });
  const manufacturer = solarHomeSystem.manufacturer?.name ?? 'the manufacturer';
  const status = solarHomeSystem.device?.manufacturer_mapping_status ?? 'unknown';
  const lastToken = [...solarHomeSystem.tokens]
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .at(-1);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['solar-home-system', solarHomeSystem.id] }),
      queryClient.invalidateQueries({
        queryKey: ['solar-home-system-transactions', solarHomeSystem.id],
      }),
      queryClient.invalidateQueries({ queryKey: ['device-capabilities', deviceId] }),
    ]);
  }

  const mappingCheck = useMutation({
    mutationFn: () => checkDeviceMapping(deviceId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['solar-home-system', solarHomeSystem.id] }),
  });

  const creditUnit = capabilities.data?.credit_unit ?? null;
  const chosenUnit = unit ?? creditUnit ?? CURRENCY_UNIT;
  const amountValue = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(amountValue) && amountValue > 0;
  const credit = useMutation({
    mutationFn: () =>
      generateDeviceToken(deviceId, { type: 'credit', amount: amountValue, unit: chosenUnit }),
    onSuccess: async (token) => {
      setIssued(token);
      setAmount('');
      await refresh();
    },
  });

  const mappingResult = mappingCheck.data;
  const details = Object.entries(mappingResult?.device ?? {}).filter(
    (entry): entry is [string, string | number | boolean] =>
      ['string', 'number', 'boolean'].includes(typeof entry[1]),
  );

  return (
    <SectionCard
      title="Device control"
      action={
        <span className="text-sm text-muted-foreground">Tokens come from {manufacturer}</span>
      }
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Mapping </span>
            <StatusPill status={mappingPill[status].status}>{mappingPill[status].label}</StatusPill>
            {solarHomeSystem.device?.manufacturer_mapping_checked_at ? (
              <span className="text-muted-foreground">
                {' '}
                · checked {formatDateTime(solarHomeSystem.device.manufacturer_mapping_checked_at)}
              </span>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={mappingCheck.isPending}
            onClick={() => mappingCheck.mutate()}
          >
            <RefreshCw aria-hidden="true" />
            {mappingCheck.isPending ? 'Checking…' : 'Check with manufacturer'}
          </Button>
        </div>
        {mappingCheck.isError ? (
          <Banner tone="error" role="alert">
            The check failed: {mappingCheck.error.message}
          </Banner>
        ) : null}
        {mappingResult ? (
          <Banner
            tone={!mappingResult.supported ? 'info' : mappingResult.mapped ? 'success' : 'warning'}
            role="status"
          >
            {!mappingResult.supported
              ? `${manufacturer} has no device API to check against.`
              : mappingResult.mapped
                ? `${manufacturer} knows this device and has it on your account.`
                : `${manufacturer} does not have this device on your account. Tokens will fail until it is mapped.`}
            {details.length > 0 ? (
              <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
                {details.map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="capitalize">{key.replace(/_/g, ' ')}</dt>
                    <dd className="m-0 break-all">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </Banner>
        ) : null}

        {issued ? (
          <TokenCode token={issued} caption="New token" />
        ) : lastToken ? (
          <TokenCode token={lastToken} caption="Last token" />
        ) : (
          <p className="m-0 text-sm text-muted-foreground">No token issued yet.</p>
        )}

        {capabilities.isPending ? (
          <p className="m-0 text-sm text-muted-foreground">Checking what the device supports…</p>
        ) : null}
        {capabilities.isError ? (
          <Banner tone="error" role="alert">
            Could not read what the device supports: {capabilities.error.message}
          </Banner>
        ) : null}

        {capabilities.data?.token_generation ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (amountValid) {
                credit.mutate();
              }
            }}
          >
            <label className="flex min-w-28 flex-1 flex-col gap-1.5 text-sm font-medium text-label">
              Credit
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <select
              aria-label="Credit unit"
              className={`${selectClass} h-9`}
              value={chosenUnit}
              onChange={(event) => setUnit(event.target.value)}
            >
              {creditUnit ? <option value={creditUnit}>{creditUnit}</option> : null}
              <option value={CURRENCY_UNIT}>{currency || 'Money'}</option>
            </select>
            <Button type="submit" disabled={!amountValid || credit.isPending}>
              {credit.isPending ? 'Generating…' : 'Generate token'}
            </Button>
          </form>
        ) : null}
        {capabilities.data?.token_generation_blocked_reason ? (
          <p className="m-0 text-sm text-muted-foreground">
            No credit token: {capabilities.data.token_generation_blocked_reason}
          </p>
        ) : null}
        {credit.isError ? (
          <Banner tone="error" role="alert">
            No token was generated: {credit.error.message}
          </Banner>
        ) : null}
        {capabilities.data?.unlock_token || capabilities.data?.reset_token ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              {capabilities.data.unlock_token ? (
                <Button variant="outline" onClick={() => setConfirming('unlock')}>
                  Unlock permanently
                </Button>
              ) : null}
              {capabilities.data.reset_token ? (
                <Button variant="outline" onClick={() => setConfirming('reset')}>
                  Reset credit
                </Button>
              ) : null}
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              Unlock only when the contract is paid off. It can&apos;t be undone.
            </p>
          </div>
        ) : null}
      </div>

      {confirming === 'unlock' ? (
        <ConfirmDialog
          title={`Unlock ${solarHomeSystem.serial_number} permanently?`}
          description="The device leaves pay-as-you-go for good and never asks for a token again. Do this only when the contract is paid off."
          confirmLabel="Unlock permanently"
          pendingLabel="Unlocking…"
          failureLabel="The device was not unlocked"
          onConfirm={async () => setIssued(await generateDeviceToken(deviceId, { type: 'unlock' }))}
          onDone={refresh}
          onClose={() => setConfirming(null)}
        />
      ) : null}
      {confirming === 'reset' ? (
        <ConfirmDialog
          title={`Reset the credit on ${solarHomeSystem.serial_number}?`}
          description="The device's remaining credit drops to zero, so a repossessed unit can be sold again. Its owner and plan don't change here."
          confirmLabel="Reset credit"
          pendingLabel="Resetting…"
          failureLabel="The credit was not reset"
          onConfirm={async () => setIssued(await generateDeviceToken(deviceId, { type: 'reset' }))}
          onDone={refresh}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </SectionCard>
  );
}
