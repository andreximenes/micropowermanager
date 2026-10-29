import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { DeleteVillageDialog } from './DeleteVillageDialog';
import { DangerZone, EditorCard, MAP_CLASS, MapCard, type LocationsData } from './EditorLayout';
import { LocationsMap, type Frame } from './LocationsMap';
import { useRefreshLocations } from './useRefreshLocations';

import {
  createMiniGrid,
  createVillage,
  deleteMiniGrid,
  fetchCountries,
  updateMiniGrid,
  updateVillage,
  type Cluster,
  type MiniGrid,
  type Village,
} from '@/api/locations';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field, selectClass } from '@/components/form';
import type { LatLng } from '@/components/LocationMap';
import { showFieldErrors } from '@/lib/fieldErrors';
import { plural } from '@/lib/format';
import { areaContains, parsePoint, pointOf } from '@/lib/geo';

const formatPoint = ({ latitude, longitude }: LatLng) =>
  `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

/** The pin's position as text, for typing it in; it follows the pin when the map moves it. */
function CentrePointField({
  point,
  onChange,
  error,
}: {
  point: LatLng | null;
  onChange: (point: LatLng) => void;
  error?: string;
}) {
  const [text, setText] = useState(point ? formatPoint(point) : '');
  const [shownPoint, setShownPoint] = useState(point);
  const [invalid, setInvalid] = useState(false);

  if (point !== shownPoint) {
    setShownPoint(point);
    setText(point ? formatPoint(point) : '');
    setInvalid(false);
  }

  function commit() {
    if (text.trim() === '' && !point) {
      return;
    }
    const parsed = parsePoint(text);
    setInvalid(!parsed);
    if (parsed) {
      onChange(parsed);
    }
  }

  return (
    <Field
      label="Centre point *"
      error={invalid ? 'Write it as latitude, longitude, e.g. -6.80000, 39.28000.' : error}
    >
      <Input
        inputMode="decimal"
        placeholder="Click the map, or type latitude, longitude"
        aria-invalid={invalid || Boolean(error)}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
    </Field>
  );
}

/** Why the point can't be saved, if it can't: missing, or outside its cluster's area. */
function pointProblem(point: LatLng | null, cluster: Cluster | undefined, noun: string) {
  if (!point) {
    return `Click the map to place the ${noun}.`;
  }
  const area = cluster?.geo_json?.geometry;
  if (area && !areaContains(area, point)) {
    return `The ${noun} must be inside the ${cluster?.name ?? ''} cluster's area.`;
  }
  return undefined;
}

/** Holds the pin while editing, and checks it only once the user tried to save. */
function usePoint(initial: LatLng | null) {
  const [point, setPoint] = useState(initial);
  const [checked, setChecked] = useState(false);
  return { point, setPoint, checked, check: () => setChecked(true) };
}

type PointEditorProps = {
  data: LocationsData;
  mapLabel: string;
  hidden?: { kind: 'site' | 'village'; id: number };
  cluster: Cluster | undefined;
  frame: Frame;
  pin: ReturnType<typeof usePoint>;
  problem: string | undefined;
  canEdit: boolean;
  card: Omit<Parameters<typeof EditorCard>[0], 'children' | 'canEdit'>;
  fields: ReactNode;
  onSubmit: () => void;
};

function PointEditor({
  data,
  mapLabel,
  hidden,
  cluster,
  frame,
  pin,
  problem,
  canEdit,
  card,
  fields,
  onSubmit,
}: PointEditorProps) {
  return (
    <>
      <MapCard
        toolbar={
          canEdit ? (
            <p className="m-0 text-xs text-muted-foreground">
              Click the map to place the pin, or drag it.
              {cluster?.geo_json ? ` It must be inside the ${cluster.name} cluster.` : ''}
            </p>
          ) : null
        }
      >
        <LocationsMap
          label={mapLabel}
          clusters={data.clusters}
          sites={data.sites}
          villages={data.villages}
          hidden={canEdit ? hidden : undefined}
          highlightedClusterId={cluster?.id}
          frame={frame}
          view={data.view}
          point={canEdit ? { value: pin.point, onChange: pin.setPoint } : undefined}
          className={MAP_CLASS}
        />
      </MapCard>
      <EditorCard {...card} canEdit={canEdit}>
        <form
          id={card.formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {fields}
          <CentrePointField
            point={pin.point}
            onChange={pin.setPoint}
            error={pin.checked ? problem : undefined}
          />
        </form>
      </EditorCard>
    </>
  );
}

function frameFor(point: LatLng | null, cluster: Cluster | undefined): Frame {
  if (point) {
    return { point };
  }
  return cluster?.geo_json ? { area: cluster.geo_json.geometry } : null;
}

const siteSchema = z.object({
  // The backend's own minimum for a new site.
  name: z.string().trim().min(3, 'Use at least 3 characters.'),
  clusterId: z.string().min(1, 'Pick the cluster.'),
});
type SiteValues = z.infer<typeof siteSchema>;

type SiteEditorProps = {
  data: LocationsData;
  site?: MiniGrid;
  /** Where a new site goes; ignored when editing. */
  clusterId?: number;
  canEdit: boolean;
};

export function SiteEditor({ data, site, clusterId, canEdit }: SiteEditorProps) {
  const formId = useId();
  const navigate = useNavigate();
  const refresh = useRefreshLocations();
  const storedPoint = pointOf(site?.location);
  const pin = usePoint(storedPoint);
  const [deleting, setDeleting] = useState(false);
  const villages = data.villages.filter((village) => village.mini_grid_id === site?.id);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<SiteValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: site?.name ?? '',
      clusterId: String(site?.cluster_id ?? clusterId ?? ''),
    },
  });
  const chosenClusterId = useWatch({ control, name: 'clusterId' });
  const cluster = data.clusters.find((candidate) => String(candidate.id) === chosenClusterId);
  const [frame] = useState(() => frameFor(storedPoint, cluster));
  const problem = pointProblem(pin.point, cluster, 'site');

  const save = useMutation({
    mutationFn: ({ values, point }: { values: SiteValues; point: LatLng }) => {
      const changes = { name: values.name, clusterId: Number(values.clusterId), point };
      return site ? updateMiniGrid(site.id, changes) : createMiniGrid(changes);
    },
    onSuccess: async ({ id }, { values }) => {
      await refresh();
      void navigate({ to: '/locations', search: { cluster: Number(values.clusterId), site: id } });
    },
    onError: (error) => showFieldErrors(error, setError, { name: 'name', cluster_id: 'clusterId' }),
  });

  const submit = () => {
    pin.check();
    void handleSubmit((values) => {
      if (!problem && pin.point) {
        save.mutate({ values, point: pin.point });
      }
    })();
  };

  const parentSearch = { cluster: site?.cluster_id ?? clusterId };

  return (
    <>
      <PointEditor
        data={data}
        mapLabel={site ? `Map of the ${site.name} site` : 'Map for the new site'}
        hidden={site ? { kind: 'site', id: site.id } : undefined}
        cluster={cluster}
        frame={frame}
        pin={pin}
        problem={problem}
        canEdit={canEdit}
        onSubmit={submit}
        card={{
          title: site ? `Edit site · ${site.name}` : 'New site',
          detail: site ? plural(villages.length, 'village') : undefined,
          formId,
          saving: save.isPending,
          saveLabel: site ? 'Save site' : 'Add site',
          error: save.error,
          failureLabel: 'The site was not saved',
          onCancel: () =>
            void navigate({
              to: '/locations',
              search: site ? { ...parentSearch, site: site.id } : parentSearch,
            }),
          danger: site ? (
            <DangerZone
              title="Delete this site"
              explanation={
                villages.length > 0
                  ? `Delete its ${plural(villages.length, 'village')} first.`
                  : 'It has no villages, so nothing else is affected.'
              }
              action={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={villages.length > 0}
                  onClick={() => setDeleting(true)}
                >
                  Delete site
                </Button>
              }
            />
          ) : null,
        }}
        fields={
          <>
            <Field label="Name *" error={errors.name?.message}>
              <Input autoComplete="off" aria-invalid={Boolean(errors.name)} {...register('name')} />
            </Field>
            <Field label="Cluster *" error={errors.clusterId?.message}>
              <select className={selectClass} {...register('clusterId')}>
                {data.clusters.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        }
      />
      {deleting && site ? (
        <ConfirmDialog
          title={`Delete ${site.name}?`}
          description="The site is removed from its cluster. This can't be undone."
          confirmLabel="Delete site"
          pendingLabel="Deleting…"
          failureLabel="The site was not deleted"
          onConfirm={() => deleteMiniGrid(site.id)}
          onDone={async () => {
            await refresh();
            void navigate({ to: '/locations', search: parentSearch });
          }}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </>
  );
}

const villageSchema = z.object({
  name: z.string().trim().min(1, 'Enter the village name.'),
  siteId: z.string().min(1, 'Pick the site.'),
  countryId: z.string().min(1, 'Pick the country.'),
});
type VillageValues = z.infer<typeof villageSchema>;

/** The country most villages are in: a new village is almost always in the same one. */
function usualCountry(villages: Village[]): number | null {
  const counts = new Map<number, number>();
  for (const { country_id: countryId } of villages) {
    if (countryId !== null) {
      counts.set(countryId, (counts.get(countryId) ?? 0) + 1);
    }
  }
  return [...counts].sort((first, second) => second[1] - first[1])[0]?.[0] ?? null;
}

type VillageEditorProps = {
  data: LocationsData;
  village?: Village;
  /** Where a new village goes; ignored when editing. */
  siteId?: number;
  canEdit: boolean;
};

export function VillageEditor({ data, village, siteId, canEdit }: VillageEditorProps) {
  const formId = useId();
  const navigate = useNavigate();
  const refresh = useRefreshLocations();
  const storedPoint = pointOf(village?.location);
  const pin = usePoint(storedPoint);
  const [deleting, setDeleting] = useState(false);
  const countries = useQuery({ queryKey: ['countries'], queryFn: fetchCountries });
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<VillageValues>({
    resolver: zodResolver(villageSchema),
    values: {
      name: village?.name ?? '',
      siteId: String(village?.mini_grid_id ?? siteId ?? ''),
      countryId: String(village?.country_id ?? usualCountry(data.villages) ?? ''),
    },
    resetOptions: { keepDirtyValues: true },
  });
  const chosenSiteId = useWatch({ control, name: 'siteId' });
  const site = data.sites.find((candidate) => String(candidate.id) === chosenSiteId);
  const cluster = data.clusters.find((candidate) => candidate.id === site?.cluster_id);
  const [frame] = useState(() => frameFor(storedPoint ?? pointOf(site?.location), cluster));
  const problem = pointProblem(pin.point, cluster, 'village');

  const save = useMutation({
    mutationFn: ({ values, point }: { values: VillageValues; point: LatLng }) => {
      const changes = {
        name: values.name,
        miniGridId: Number(values.siteId),
        countryId: Number(values.countryId),
        point,
      };
      return village ? updateVillage(village.id, changes) : createVillage(changes);
    },
    onSuccess: async ({ id }) => {
      await refresh();
      void navigate({
        to: '/locations',
        search: { cluster: cluster?.id, site: site?.id, village: id },
      });
    },
    onError: (error) =>
      showFieldErrors(error, setError, {
        name: 'name',
        mini_grid_id: 'siteId',
        country_id: 'countryId',
      }),
  });

  const submit = () => {
    pin.check();
    void handleSubmit((values) => {
      if (!problem && pin.point) {
        save.mutate({ values, point: pin.point });
      }
    })();
  };

  const parentSearch = { cluster: cluster?.id, site: village?.mini_grid_id ?? siteId };

  return (
    <>
      <PointEditor
        data={data}
        mapLabel={village ? `Map of ${village.name}` : 'Map for the new village'}
        hidden={village ? { kind: 'village', id: village.id } : undefined}
        cluster={cluster}
        frame={frame}
        pin={pin}
        problem={problem}
        canEdit={canEdit}
        onSubmit={submit}
        card={{
          title: village ? `Edit village · ${village.name}` : 'New village',
          detail: site ? `${site.name}${cluster ? ` · ${cluster.name}` : ''}` : undefined,
          formId,
          saving: save.isPending,
          saveLabel: village ? 'Save village' : 'Add village',
          error: save.error,
          failureLabel: 'The village was not saved',
          onCancel: () =>
            void navigate({
              to: '/locations',
              search: village ? { ...parentSearch, village: village.id } : parentSearch,
            }),
          danger: village ? (
            <DangerZone
              title="Delete this village"
              explanation="Customers and agents living there move to another village first."
              action={
                <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
                  Delete village
                </Button>
              }
            />
          ) : null,
        }}
        fields={
          <>
            <Field label="Name *" error={errors.name?.message}>
              <Input autoComplete="off" aria-invalid={Boolean(errors.name)} {...register('name')} />
            </Field>
            <Field label="Site *" error={errors.siteId?.message}>
              <select className={selectClass} {...register('siteId')}>
                {data.sites.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Country *" error={errors.countryId?.message ?? countries.error?.message}>
              <select
                key={countries.data ? 'loaded' : 'loading'}
                className={selectClass}
                {...register('countryId')}
              >
                <option value="">{countries.data ? 'Pick a country' : 'Loading…'}</option>
                {countries.data?.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.country_name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        }
      />
      {deleting && village ? (
        <DeleteVillageDialog
          village={village}
          onClose={() => setDeleting(false)}
          onDeleted={async () => {
            await refresh();
            void navigate({ to: '/locations', search: parentSearch });
          }}
        />
      ) : null}
    </>
  );
}
