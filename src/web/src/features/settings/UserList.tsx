import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { matchesUser, USERS_PER_PAGE, type UserListSearch } from './listSearch';
import { canDeleteUser, canEditUser, personOf, roleLabel } from './roles';
import { UserSheet } from './UserSheet';

import { deleteUser, fetchAllUsers, type ListedUser } from '@/api/users';
import { can, readSession } from '@/auth/session';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Pagination } from '@/components/Pagination';
import { SearchBox } from '@/components/SearchBox';
import { pageOf } from '@/lib/paging';

type Panel =
  { kind: 'new' } | { kind: 'edit'; user: ListedUser } | { kind: 'delete'; user: ListedUser };

function Roles({ roles }: { roles: string[] }) {
  if (roles.length === 0) {
    return <span className="text-muted-foreground">No role</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <StatusPill key={role} status={role === 'owner' || role === 'admin' ? 'info' : 'neutral'}>
          {roleLabel(role)}
        </StatusPill>
      ))}
    </span>
  );
}

function Actions({
  user,
  ownerCount,
  onPanel,
}: {
  user: ListedUser;
  ownerCount: number;
  onPanel: (panel: Panel) => void;
}) {
  const session = readSession();
  return (
    <span className="flex justify-end gap-2">
      {canEditUser(session, user, ownerCount) ? (
        <Button variant="outline" size="sm" onClick={() => onPanel({ kind: 'edit', user })}>
          Edit
        </Button>
      ) : null}
      {canDeleteUser(session, user) ? (
        <Button
          variant="outline"
          size="sm"
          className="text-red"
          aria-label={`Delete ${user.name}`}
          onClick={() => onPanel({ kind: 'delete', user })}
        >
          <Trash2 />
        </Button>
      ) : null}
    </span>
  );
}

export function UserList({ search }: { search: UserListSearch }) {
  const navigate = useNavigate({ from: '/settings/users' });
  const queryClient = useQueryClient();
  const session = readSession();
  const [panel, setPanel] = useState<Panel | null>(null);
  const allowed = can(session, 'users');
  const users = useQuery({ queryKey: ['users'], queryFn: fetchAllUsers, enabled: allowed });

  function update(changes: Partial<UserListSearch>, options: { replace?: boolean } = {}) {
    void navigate({
      search: (previous) => ({ ...previous, page: undefined, ...changes }),
      replace: options.replace,
    });
  }

  const matching = (users.data ?? []).filter((user) => matchesUser(user, search.term ?? ''));
  const page = pageOf(matching, search.page ?? 1, USERS_PER_PAGE);
  const ownerCount = (users.data ?? []).filter((user) => user.roles.includes('owner')).length;
  const you = (user: ListedUser) => user.id === session?.user.id;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/settings" className="hover:underline">
          Settings
        </Link>{' '}
        / Users
      </nav>
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="m-0 text-2xl font-bold">Users</h1>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            People who sign in to Spark CRM and what they can do
          </p>
        </div>
        {allowed ? (
          <Button className="h-10" onClick={() => setPanel({ kind: 'new' })}>
            + New user
          </Button>
        ) : null}
      </div>

      {allowed ? null : (
        <Banner tone="info">
          Your account cannot manage users. Ask an owner or admin to add or change one.
        </Banner>
      )}

      {allowed ? (
        <Card className="bg-panel">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <SearchBox
              term={search.term ?? ''}
              onSearch={(term) => update({ term: term.trim() || undefined }, { replace: true })}
              label="Search users"
              placeholder="Search by name or e-mail"
              className="block max-w-md"
            />
          </div>

          {users.isPending ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading users…</p>
          ) : null}
          {users.isError ? (
            <div className="p-4">
              <Banner tone="error" role="alert">
                Could not load users: {users.error.message}
              </Banner>
            </div>
          ) : null}
          {users.data && page.total === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
              <p className="m-0">No users match this search.</p>
              <Button variant="outline" size="sm" onClick={() => update({ term: undefined })}>
                Clear search
              </Button>
            </div>
          ) : null}

          {page.data.length > 0 ? (
            <>
              <Table aria-label="Users" className="hidden md:table">
                <TableHeader>
                  <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
                    <TableHead className="pl-5 font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">E-mail</TableHead>
                    <TableHead className="font-semibold">Roles</TableHead>
                    <TableHead className="pr-5">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.data.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-5">
                        <span className="flex items-center gap-2.5 font-semibold">
                          <PersonAvatar person={personOf(user.name)} size="sm" />
                          {user.name}
                          {you(user) ? (
                            <span className="font-normal text-muted-foreground">(you)</span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Roles roles={user.roles} />
                      </TableCell>
                      <TableCell className="pr-5">
                        <Actions user={user} ownerCount={ownerCount} onPanel={setPanel} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <ul aria-label="Users" className="m-0 flex list-none flex-col gap-2 p-3 md:hidden">
                {page.data.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <PersonAvatar person={personOf(user.name)} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <strong className="truncate">
                        {user.name}
                        {you(user) ? (
                          <span className="font-normal text-muted-foreground"> (you)</span>
                        ) : null}
                      </strong>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                      <Roles roles={user.roles} />
                    </span>
                    <Actions user={user} ownerCount={ownerCount} onPanel={setPanel} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {page.total > 0 ? (
            <Pagination
              page={page}
              noun="user"
              onPage={(next) => update({ page: next === 1 ? undefined : next })}
            />
          ) : null}
        </Card>
      ) : null}

      {panel?.kind === 'new' ? <UserSheet onClose={() => setPanel(null)} /> : null}
      {panel?.kind === 'edit' ? (
        <UserSheet user={panel.user} onClose={() => setPanel(null)} />
      ) : null}
      {panel?.kind === 'delete' ? (
        <ConfirmDialog
          title={`Delete ${panel.user.name}?`}
          description={`${panel.user.email} can no longer sign in to Spark CRM. This cannot be undone.`}
          confirmLabel="Delete user"
          pendingLabel="Deleting…"
          failureLabel="The user was not deleted"
          onConfirm={() => deleteUser(panel.user.id)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </div>
  );
}
