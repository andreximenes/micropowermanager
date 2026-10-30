import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchMapSettings, type MapSettings } from '@/api/customers';
import { mapProviders, updateMapSettings } from '@/api/settings';
import { Field, selectClass } from '@/components/form';
import { LocationMap } from '@/components/LocationMap';

const MIN_ZOOM = 1;
const MAX_ZOOM = 18;

type Draft = { latitude: string; longitude: string; zoom: number; provider: string };

const draftOf = (settings: MapSettings): Draft => ({
  latitude: String(settings.latitude),
  longitude: String(settings.longitude),
  zoom: settings.zoom,
  provider: settings.provider ?? '',
});

function coordinate(value: string, limit: number): number | null {
  const number = Number(value);
  return value.trim() !== '' && Number.isFinite(number) && Math.abs(number) <= limit
    ? number
    : null;
}

export function MapSettingsForm() {
  const settings = useQuery({ queryKey: ['map-settings'], queryFn: fetchMapSettings });

  if (settings.isPending) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading map…</p>;
  }
  if (settings.isError) {
    return (
      <Banner tone="error" role="alert">
        Could not load the map settings: {settings.error.message}
      </Banner>
    );
  }
  if (!settings.data) {
    return (
      <Banner tone="info">
        This company has no map settings yet. They are created when the company is set up.
      </Banner>
    );
  }
  return <MapSettingsEditor saved={settings.data} />;
}

function MapSettingsEditor({ saved }: { saved: MapSettings }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => draftOf(saved));
  // The map keeps the last valid centre while a coordinate is being typed.
  const [centre, setCentre] = useState({ latitude: saved.latitude, longitude: saved.longitude });
  const latitude = coordinate(draft.latitude, 90);
  const longitude = coordinate(draft.longitude, 180);

  const save = useMutation({
    mutationFn: () =>
      updateMapSettings({
        id: saved.id,
        zoom: draft.zoom,
        latitude: latitude as number,
        longitude: longitude as number,
        provider: draft.provider === '' ? null : draft.provider,
      }),
    onSuccess: (updated) => queryClient.setQueryData(['map-settings'], updated),
  });

  function moveTo(position: { latitude: number; longitude: number }) {
    setCentre(position);
    setDraft((previous) => ({
      ...previous,
      latitude: position.latitude.toFixed(5),
      longitude: position.longitude.toFixed(5),
    }));
  }

  function typeCoordinate(field: 'latitude' | 'longitude', value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    const nextLatitude = coordinate(next.latitude, 90);
    const nextLongitude = coordinate(next.longitude, 180);
    if (nextLatitude !== null && nextLongitude !== null) {
      setCentre({ latitude: nextLatitude, longitude: nextLongitude });
    }
  }

  const changed =
    latitude !== saved.latitude ||
    longitude !== saved.longitude ||
    draft.zoom !== saved.zoom ||
    draft.provider !== (saved.provider ?? '');

  return (
    <Card className="bg-panel">
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <h2 className="m-0 text-base font-bold">Where maps open</h2>
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">
          Drag the pin or click the map, then set the zoom. Maps across the CRM start here.
        </p>
      </div>
      <div className="flex flex-wrap gap-5 px-4 py-5 sm:px-6">
        <LocationMap
          position={centre}
          zoom={draft.zoom}
          label="Map centre"
          onMove={moveTo}
          onZoom={(zoom) => setDraft((previous) => ({ ...previous, zoom }))}
          className="h-72 min-w-0 flex-[999_1_420px] overflow-hidden rounded-lg border border-border sm:h-[420px]"
        />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Latitude"
              error={latitude === null ? 'Use a number from -90 to 90.' : undefined}
            >
              <Input
                inputMode="decimal"
                className="tabular-nums"
                aria-invalid={latitude === null}
                value={draft.latitude}
                onChange={(event) => typeCoordinate('latitude', event.target.value)}
              />
            </Field>
            <Field
              label="Longitude"
              error={longitude === null ? 'Use a number from -180 to 180.' : undefined}
            >
              <Input
                inputMode="decimal"
                className="tabular-nums"
                aria-invalid={longitude === null}
                value={draft.longitude}
                onChange={(event) => typeCoordinate('longitude', event.target.value)}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-label">
              <span className="flex justify-between">
                Starting zoom <strong className="text-foreground">{draft.zoom}</strong>
              </span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                value={draft.zoom}
                onChange={(event) =>
                  setDraft((previous) => ({ ...previous, zoom: Number(event.target.value) }))
                }
                className="accent-primary"
              />
            </label>
            <span className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
              <span>Country</span>
              <span>Street</span>
            </span>
          </div>
          <Field label="Map provider">
            <select
              className={`${selectClass} h-10`}
              value={draft.provider}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, provider: event.target.value }))
              }
            >
              <option value="">Not set</option>
              {mapProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </Field>
          {save.isError ? (
            <Banner tone="error" role="alert">
              The map settings were not saved: {save.error.message}
            </Banner>
          ) : null}
          {save.isSuccess && !changed ? (
            <Banner tone="success" role="status">
              Map settings saved.
            </Banner>
          ) : null}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={!changed || save.isPending}
              onClick={() => {
                setDraft(draftOf(saved));
                setCentre({ latitude: saved.latitude, longitude: saved.longitude });
              }}
            >
              Reset
            </Button>
            <Button
              disabled={!changed || latitude === null || longitude === null || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
