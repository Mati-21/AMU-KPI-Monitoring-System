import { useState } from 'react';
import { Building2, Edit3, History, Plus, Power, Trash2 } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/components/ui/Card';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useDeleteOffice, useOffice, useOfficeHistory, useSaveOffice } from '../hooks/useOffices';
import { formatDate } from '../lib/officeTree';
import { ConfirmDialog } from './FormParts';
import MembersCard from './MembersCard';
import PositionsCard from './PositionsCard';
import PreviewList from './PreviewList';

const SUB_OFFICE_STATUS_FILTER = {
  allLabel: 'All statuses',
  options: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
  matches: (child, status) => child.isActive === (status === 'active'),
};

const SubOfficesCard = ({ office, onSelect }) => (
  <Card className="border-border bg-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base">
        <Building2 className="h-4 w-4 text-primary" />
        Sub-offices ({office.children.length})
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {office.children.length === 0 && <p className="text-sm text-muted-foreground">No sub-offices.</p>}
      <PreviewList
        title="Sub-offices"
        items={office.children}
        searchText={(child) => `${child.name} ${child.code ?? ''}`}
        filter={SUB_OFFICE_STATUS_FILTER}
        renderRow={(child) => (
          <button type="button" onClick={() => onSelect(child.id)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border p-3 text-left text-sm hover:bg-muted">
            <span className={`truncate font-medium ${child.isActive ? 'text-foreground' : 'text-muted-foreground line-through'}`}>{child.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{child.officeType.name}</span>
          </button>
        )}
      />
    </CardContent>
  </Card>
);

const HistoryCard = ({ officeId }) => {
  const { data: history = [], isLoading, error } = useOfficeHistory(officeId);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          Reporting History ({history.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load the history.')}</p>}
        <PreviewList
          title="Reporting History"
          items={history}
          renderRow={(row) => (
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">{row.parent ? `Under ${row.parent.name}` : 'Top of the university'}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(row.validFrom)} to {row.validTo ? formatDate(row.validTo) : 'now'}
                {row.changedBy && ` · By ${row.changedBy.fullName}`}
              </p>
              {row.reason && <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>}
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
};

const OfficeDetail = ({ officeId, onSelect, onDeleted, onEdit, onAddSubOffice }) => {
  const can = useCan();
  const { notify } = useNotification();
  const { data: office, isLoading, error } = useOffice(officeId);
  const save = useSaveOffice();
  const remove = useDeleteOffice();
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load this office.')}</p>;

  const closeDelete = () => {
    remove.reset();
    setDeleting(false);
  };

  const confirmDelete = () =>
    remove.mutate(office.id, {
      onSuccess: () => {
        notify(`${office.name} was deleted.`, 'success');
        onDeleted();
      },
    });

  const setActive = (isActive) => {
    setProblem(null);
    save.mutate(
      { id: office.id, values: { isActive } },
      {
        onSuccess: () => notify(isActive ? 'Office activated.' : 'Office deactivated.', 'success'),
        onError: setProblem,
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-5">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold text-foreground">
            {office.name}
            {office.code && <Badge variant="outline">{office.code}</Badge>}
            {!office.isActive && <Badge variant="outline">Inactive</Badge>}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {office.officeType.name}
            {office.parent && ` under ${office.parent.name}`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{office.head ? `Head: ${office.head.person.fullName} (${office.head.position.title})` : 'No head assigned'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{office.canAssignKpi ? 'Can assign KPIs to offices below it' : 'Cannot assign KPIs'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('office:create') && office.isActive && (
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onAddSubOffice(office.id)}>
              <Plus className="h-4 w-4" />
              Add Sub-office
            </Button>
          )}
          {can('office:update') && (
            <>
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onEdit(office)}>
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
              {office.parent && (
                <Button type="button" size="sm" variant="outline" className="gap-1" disabled={save.isPending} onClick={() => setActive(!office.isActive)}>
                  <Power className="h-4 w-4" />
                  {office.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </>
          )}
          {can('office:manage') && office.parent && (
            <Button type="button" size="sm" variant="destructive" className="gap-1" onClick={() => setDeleting(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
        {problem && <p className="w-full text-sm text-red-500">{apiErrorMessage(problem, 'Could not change this office.')}</p>}
      </div>

      <ConfirmDialog open={deleting} onClose={closeDelete} title="Delete Office" description={`Delete ${office.name} for good, with its positions and past placements? This cannot be undone. An office that is still in use cannot be deleted.`} onConfirm={confirmDelete} error={remove.error} pending={remove.isPending} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MembersCard office={office} />
        <PositionsCard office={office} />
        <SubOfficesCard office={office} onSelect={onSelect} />
        <HistoryCard officeId={office.id} />
      </div>
    </div>
  );
};

export default OfficeDetail;
