import { useState } from 'react';
import { CalendarX2, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/components/ui/Card';
import { Input } from '../../../shared/components/ui/Input';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useEndPlacement, useMembers } from '../hooks/useOffices';
import { formatDate, todayIso } from '../lib/officeTree';
import { Field, FormDialog } from './FormParts';
import PlaceMemberDialog from './PlaceMemberDialog';
import PreviewList from './PreviewList';

const headFirstByName = (a, b) => Number(b.position.isHead) - Number(a.position.isHead) || a.person.fullName.localeCompare(b.person.fullName);

const EndPlacementDialog = ({ member, onClose }) => {
  const { notify } = useNotification();
  const end = useEndPlacement();
  const [endDate, setEndDate] = useState(todayIso());

  const submit = (event) => {
    event.preventDefault();
    end.mutate(
      { id: member.id, endDate },
      {
        onSuccess: () => {
          notify('Placement end date saved.', 'success');
          onClose();
        },
      }
    );
  };

  return (
    <FormDialog open onClose={onClose} title="End Placement" description={`${member.person.fullName} keeps this position and its roles through the last day, then loses them.`} onSubmit={submit} error={end.error} pending={end.isPending} submitLabel="End Placement">
      <Field label="Last Day" required>
        <Input type="date" required min={member.startDate.slice(0, 10)} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      </Field>
    </FormDialog>
  );
};

const MemberRow = ({ member, canAssign, canOpenUser, onEnd }) => (
  <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
        {canOpenUser ? (
          <Link to={`/users/${member.person.id}`} className="hover:underline underline-offset-4">
            {member.person.fullName}
          </Link>
        ) : (
          member.person.fullName
        )}
        {member.position.isHead && <Badge variant="outline">Head</Badge>}
      </p>
      <p className="text-xs text-muted-foreground">
        {member.position.title} · From {formatDate(member.startDate)}
        {member.endDate && ` · Last day ${formatDate(member.endDate)}`}
      </p>
      <p className="mt-0.5 text-xs text-primary">{member.roles.map((assignment) => assignment.role.name).join(', ') || 'No role yet'}</p>
    </div>
    {canAssign && (
      <button type="button" onClick={() => onEnd(member)} aria-label={`End placement of ${member.person.fullName}`} title="End placement" className="shrink-0 rounded p-1 text-destructive hover:bg-destructive/10">
        <CalendarX2 className="h-4 w-4" />
      </button>
    )}
  </div>
);

const MembersCard = ({ office }) => {
  const can = useCan();
  const { data: members = [], isLoading, error } = useMembers(office.id);
  const [placing, setPlacing] = useState(false);
  const [ending, setEnding] = useState(null);
  const canAssign = can('office:assign');
  const sorted = [...members].sort(headFirstByName);
  const positionFilter = {
    allLabel: 'All positions',
    options: office.positions.map((position) => ({ value: position.id, label: position.title })),
    matches: (member, positionId) => member.position.id === positionId,
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          People ({members.length})
        </CardTitle>
        {canAssign && office.isActive && (
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setPlacing(true)}>
            <UserPlus className="h-4 w-4" />
            Place Person
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load people.')}</p>}
        {!isLoading && !error && members.length === 0 && <p className="text-sm text-muted-foreground">Nobody is placed here yet.</p>}
        <PreviewList
          title="People"
          items={sorted}
          searchText={(member) => `${member.person.fullName} ${member.position.title}`}
          filter={positionFilter}
          renderRow={(member) => <MemberRow member={member} canAssign={canAssign} canOpenUser={can('user:read')} onEnd={setEnding} />}
        />
      </CardContent>

      {placing && <PlaceMemberDialog office={office} onClose={() => setPlacing(false)} />}
      {ending && <EndPlacementDialog member={ending} onClose={() => setEnding(null)} />}
    </Card>
  );
};

export default MembersCard;
