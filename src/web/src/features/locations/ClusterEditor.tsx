import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PenLine, Search } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DangerZone, EditorCard, MAP_CLASS, MapCard, type LocationsData } from './EditorLayout';
import { LocationsMap, type Frame } from './LocationsMap';
import { useRefreshLocations } from './useRefreshLocations';

import { ApiError } from '@/api/client';
import {
  createCluster,
  deleteCluster,
  searchPlaces,
  updateCluster,
  type Area,
  type Cluster,
} from '@/api/locations';
import { fetchAllUsers } from '@/api/users';
import { readSession } from '@/auth/session';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field, selectClass } from '@/components/form';
import { showFieldErrors } from '@/lib/fieldErrors';
import { canReshape } from '@/lib/geo';
import { plural } from '@/lib/format';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Enter the cluster name.'),
  managerId: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

function PlaceSearch({ onPick }: { onPick: (area: Area) => void }) {
  const [text, setText] = useState('');
  const places = useMutation({ mutationFn: searchPlaces });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim()) {
      places.mutate(text.trim());
    }
  }

  return (
    <div className="relative flex min-w-0 flex-[1_1_260px] flex-col">
      <form role="search" onSubmit={submit} className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search a place by name"
            placeholder="Search a place by name"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="pl-9"
          />
        </label>
        <Button type="submit" variant="outline" disabled={places.isPending}>
          {places.isPending ? 'Searching…' : 'Find'}
        </Button>
      </form>
      {places.isError ? (
        <p role="alert" className="m-0 mt-1 text-sm text-red">
          {places.error.message}
        </p>
      ) : null}
      {places.data?.length === 0 ? (
        <p className="m-0 mt-1 text-sm text-muted-foreground">
          OpenStreetMap has no outline for that name. Try a wider place, or draw the area.
        </p>
      ) : null}
      {places.data && places.data.length > 0 ? (
        <ul
          aria-label="Places found"
          className="m-0 mt-1 flex max-h-48 list-none flex-col overflow-y-auto rounded-md border border-border p-1"
        >
          {places.data.map((place) => (
            <li key={place.name}>
              <button
                type="button"
                onClick={() => {
                  onPick(place.area);
                  places.reset();
                }}
                className="w-full rounded-sm px-2.5 py-2 text-left text-sm hover:bg-panel-2"
              >
                {place.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type ClusterEditorProps = {
  data: LocationsData;
  /** The cluster to edit, or undefined to add one. */
  cluster?: Cluster;
  canEdit: boolean;
};

export function ClusterEditor({ data, cluster, canEdit }: ClusterEditorProps) {
  const formId = useId();
  const navigate = useNavigate();
  const refresh = useRefreshLocations();
  const session = readSession();
  const storedArea = cluster?.geo_json?.geometry ?? null;
  const [area, setArea] = useState<Area | null>(storedArea);
  const [frame, setFrame] = useState<Frame>(storedArea ? { area: storedArea } : null);
  const [drawing, setDrawing] = useState(false);
  const [areaMissing, setAreaMissing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const sites = data.sites.filter((site) => site.cluster_id === cluster?.id);

  // Listing users needs the `users` permission; without it the manager cannot be picked.
  const users = useQuery({
    queryKey: ['users'],
    queryFn: fetchAllUsers,
    enabled: canEdit,
  });
  const usersForbidden = users.error instanceof ApiError && users.error.status === 403;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      name: cluster?.name ?? '',
      managerId: String(cluster?.manager_id ?? session?.user.id ?? ''),
    },
    resetOptions: { keepDirtyValues: true },
  });

  const save = useMutation({
    mutationFn: ({ values, outline }: { values: FormValues; outline: Area }) => {
      // Without the user list the manager stays as it is, or is whoever adds the cluster.
      const managerId = users.data
        ? Number(values.managerId)
        : cluster
          ? null
          : (session?.user.id ?? null);
      const changes = { name: values.name, area: outline, managerId };
      return cluster ? updateCluster(cluster.id, changes) : createCluster(changes);
    },
    onSuccess: async ({ id }) => {
      await refresh();
      void navigate({ to: '/locations', search: { cluster: id } });
    },
    onError: (error) => showFieldErrors(error, setError, { name: 'name', manager_id: 'managerId' }),
  });

  function pickArea(picked: Area) {
    setArea(picked);
    setAreaMissing(false);
  }

  const submit = handleSubmit((values) => {
    if (!area) {
      setAreaMissing(true);
      return;
    }
    save.mutate({ values, outline: area });
  });

  const title = cluster ? `Edit cluster · ${cluster.name}` : 'New cluster';

  return (
    <>
      <MapCard
        toolbar={
          canEdit ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start gap-2">
                <Button
                  type="button"
                  variant={drawing ? 'default' : 'outline'}
                  aria-pressed={drawing}
                  onClick={() => setDrawing((current) => !current)}
                >
                  <PenLine className="size-4" aria-hidden="true" />
                  {area ? 'Draw again' : 'Draw area'}
                </Button>
                <PlaceSearch
                  onPick={(picked) => {
                    pickArea(picked);
                    setFrame({ area: picked });
                  }}
                />
              </div>
              <p className="m-0 text-xs text-muted-foreground">
                {drawing
                  ? 'Click to add points, then click the first point to finish.'
                  : area
                    ? canReshape(area)
                      ? 'Drag the corners to adjust the area.'
                      : 'This outline has too many corners to drag. Draw it again to change it.'
                    : 'Draw the area on the map, or find a place by name to use its outline.'}
              </p>
              {areaMissing ? (
                <p role="alert" className="m-0 text-sm text-red">
                  Draw the cluster's area or find it by name.
                </p>
              ) : null}
            </div>
          ) : null
        }
      >
        <LocationsMap
          label={cluster ? `Map of the ${cluster.name} cluster` : 'Map for the new cluster'}
          clusters={data.clusters}
          sites={data.sites}
          villages={data.villages}
          hidden={cluster && canEdit ? { kind: 'cluster', id: cluster.id } : undefined}
          highlightedClusterId={cluster?.id}
          frame={frame}
          view={data.view}
          area={
            canEdit
              ? {
                  value: area,
                  drawing,
                  onChange: pickArea,
                  onDrawingEnd: () => setDrawing(false),
                }
              : undefined
          }
          className={MAP_CLASS}
        />
      </MapCard>
      <EditorCard
        title={title}
        detail={cluster ? plural(sites.length, 'site') : undefined}
        formId={formId}
        canEdit={canEdit}
        saving={save.isPending}
        saveLabel={cluster ? 'Save cluster' : 'Add cluster'}
        error={save.error}
        failureLabel="The cluster was not saved"
        onCancel={() =>
          void navigate({ to: '/locations', search: cluster ? { cluster: cluster.id } : {} })
        }
        danger={
          cluster ? (
            <DangerZone
              title="Delete this cluster"
              explanation={
                sites.length > 0
                  ? `Delete its ${plural(sites.length, 'site')} first.`
                  : 'It has no sites, so nothing else is affected.'
              }
              action={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={sites.length > 0}
                  onClick={() => setDeleting(true)}
                >
                  Delete cluster
                </Button>
              }
            />
          ) : null
        }
      >
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Name *" error={errors.name?.message}>
            <Input autoComplete="off" aria-invalid={Boolean(errors.name)} {...register('name')} />
          </Field>
          {!canEdit ? null : usersForbidden ? (
            <p className="m-0 self-end text-sm text-muted-foreground">
              {cluster
                ? "The manager stays as it is: your role can't list users."
                : "You'll manage this cluster: your role can't list users."}
            </p>
          ) : (
            <Field label="Manager *" error={errors.managerId?.message ?? users.error?.message}>
              <select
                key={users.data ? 'loaded' : 'loading'}
                className={selectClass}
                disabled={!users.data}
                {...register('managerId')}
              >
                {users.data ? null : (
                  <option value={String(cluster?.manager_id ?? '')}>Loading…</option>
                )}
                {users.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </form>
      </EditorCard>
      {deleting && cluster ? (
        <ConfirmDialog
          title={`Delete ${cluster.name}?`}
          description="The cluster and its area are removed. This can't be undone."
          confirmLabel="Delete cluster"
          pendingLabel="Deleting…"
          failureLabel="The cluster was not deleted"
          onConfirm={() => deleteCluster(cluster.id)}
          onDone={async () => {
            await refresh();
            void navigate({ to: '/locations', search: {} });
          }}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </>
  );
}
