import { KeyRound, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import Button from '../../../shared/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../shared/components/ui/dialog';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import PersonAvatar from '../../01-identity/components/PersonAvatar';
import { usePersons } from '../../01-identity/hooks/useUsers';
import { useCan } from '../hooks/useCan';

const PREVIEW_SIZE = 5;

export const RoleIcon = ({ role }) => {
  const Icon = role.isSystem ? ShieldCheck : KeyRound;
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
      <Icon className="h-5 w-5" />
    </div>
  );
};

const SectionTitle = ({ children }) => <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;

const RoleHolders = ({ role }) => {
  const navigate = useNavigate();
  const { data, isLoading, error } = usePersons({ roleId: role.id, limit: PREVIEW_SIZE });
  const people = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const openAll = () => navigate(`/user-management?roleId=${role.id}`);

  return (
    <div className="space-y-1.5">
      <SectionTitle>People With This Role ({total})</SectionTitle>
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load people.')}</p>}
      {!isLoading && !error && total === 0 && <p className="text-sm text-muted-foreground">Nobody holds this role today.</p>}
      {people.map((person) => (
        <Link key={person.id} to={`/users/${person.id}`} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-muted">
          <PersonAvatar personId={person.id} fileId={person.profilePictureFileId} fullName={person.fullName} className="h-8 w-8 shrink-0 text-xs" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{person.fullName}</span>
            <span className="block truncate text-xs text-muted-foreground">{person.email || 'No email yet'}</span>
          </span>
        </Link>
      ))}
      {total > 0 && (
        <div className="flex justify-end pt-1">
          <Button type="button" size="sm" variant="outline" onClick={openAll}>
            View all {total}
          </Button>
        </div>
      )}
    </div>
  );
};

const RoleDetailDialog = ({ role, rows, onEdit, onClose }) => {
  const can = useCan();
  const granted = rows.filter((row) => role.permissionCodes.includes(row.code));
  const hiddenCount = granted.length - PREVIEW_SIZE;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-2xl">
        <DialogHeader className="text-left">
          <div className="flex items-start gap-3">
            <RoleIcon role={role} />
            <div>
              <DialogTitle>{role.name}</DialogTitle>
              <DialogDescription>{role.description || 'No description provided.'}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-1.5">
          <SectionTitle>Permissions ({role.isSystem ? 'All' : granted.length})</SectionTitle>
          {role.isSystem && <p className="text-sm text-foreground">This role has every permission across the whole university.</p>}
          {!role.isSystem && granted.length === 0 && <p className="text-sm text-muted-foreground">This role has no permissions yet.</p>}
          {!role.isSystem &&
            granted.slice(0, PREVIEW_SIZE).map((permission) => (
              <div key={permission.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="text-sm text-foreground">{permission.description}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{permission.code}</span>
              </div>
            ))}
          {!role.isSystem && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-muted-foreground">{hiddenCount > 0 ? `and ${hiddenCount} more` : ''}</span>
              <Button type="button" size="sm" onClick={() => onEdit(role)}>
                Open in Matrix
              </Button>
            </div>
          )}
        </div>
        {can('user:read') ? <RoleHolders role={role} /> : <p className="text-sm text-muted-foreground">People holding this role today: {role.activeAssignments}</p>}
      </DialogContent>
    </Dialog>
  );
};

export default RoleDetailDialog;
