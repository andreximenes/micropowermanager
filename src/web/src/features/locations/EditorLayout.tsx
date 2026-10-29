import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { type ReactNode } from 'react';

import type { MapView } from './LocationsMap';

import type { Cluster, MiniGrid, Village } from '@/api/locations';

/** Everything on the map, shared by the editors. */
export type LocationsData = {
  clusters: Cluster[];
  sites: MiniGrid[];
  villages: Village[];
  view: MapView | null;
};

export const MAP_CLASS = 'h-[320px] w-full rounded-md border border-border lg:h-[380px]';

export function MapCard({ toolbar, children }: { toolbar?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 bg-panel p-3 sm:p-4">
      {toolbar}
      {children}
    </Card>
  );
}

type EditorCardProps = {
  title: string;
  detail?: string;
  formId: string;
  canEdit: boolean;
  saving: boolean;
  saveLabel: string;
  error: Error | null;
  /** Shown before the server's message, e.g. "The site was not saved". */
  failureLabel: string;
  onCancel: () => void;
  /** The delete action, below the fields. */
  danger?: ReactNode;
  children: ReactNode;
};

/** The form beside the map. Without the settings permission it only shows the details. */
export function EditorCard({
  title,
  detail,
  formId,
  canEdit,
  saving,
  saveLabel,
  error,
  failureLabel,
  onCancel,
  danger,
  children,
}: EditorCardProps) {
  return (
    <Card aria-label={title} role="region" className="flex flex-col bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-4 sm:px-5">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        {detail ? <span className="text-sm text-muted-foreground">{detail}</span> : null}
      </div>
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        {error ? (
          <Banner tone="error" role="alert">
            {failureLabel}: {error.message}
          </Banner>
        ) : null}
        <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
          {children}
        </fieldset>
        {canEdit ? danger : null}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap justify-end gap-3 border-t border-border px-4 py-3 sm:px-5">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/** The delete row under the fields: what deleting means, and the button. */
export function DangerZone({
  title,
  explanation,
  action,
}: {
  title: string;
  explanation: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red/30 bg-red/5 px-3 py-3">
      <div className="flex min-w-0 flex-[1_1_220px] flex-col">
        <strong className="text-sm">{title}</strong>
        <span className="text-sm text-muted-foreground">{explanation}</span>
      </div>
      {action}
    </div>
  );
}
