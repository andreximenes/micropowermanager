import { Card } from '@spark/ui/card';

import { appModules, type ModuleKey } from './catalog';

export function ModulePlaceholder({ moduleKey }: { moduleKey: ModuleKey }) {
  const module = appModules[moduleKey];
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="m-0 text-2xl font-bold">{module.name}</h1>
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">{module.description}</p>
      </div>
      <Card className="bg-panel px-4 py-10 text-center sm:px-6">
        <module.icon className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="m-0 mt-3 font-semibold">
          The screen for {module.name} has not been rebuilt yet.
        </p>
        <p className="m-0 mt-1 text-sm text-muted-foreground">
          LEGACY_SCREENS.md, at the root of the repository, lists the legacy routes, files and API
          calls to rebuild it from.
        </p>
      </Card>
    </div>
  );
}
