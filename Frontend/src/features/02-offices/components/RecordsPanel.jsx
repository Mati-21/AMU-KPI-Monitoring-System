import { Archive, Briefcase, Building2, History, ShieldOff, UserMinus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '../../../shared/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/components/ui/Card';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useOfficeHistory, useOfficeRecords } from '../hooks/useOffices';
import { formatDate } from '../lib/officeTree';
import PreviewList from './PreviewList';

const RecordCard = ({ icon, title, items, empty, searchText, renderRow, isLoading }) => (
  <Card className="border-border bg-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base">
        {icon}
        {title} ({items.length})
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      <PreviewList title={title} items={items} searchText={searchText} renderRow={renderRow} />
    </CardContent>
  </Card>
);

const Row = ({ children }) => <div className="rounded-lg border border-border p-3 text-sm">{children}</div>;
const Meta = ({ children }) => <p className="text-xs text-muted-foreground">{children}</p>;

const period = (from, to) => `${from ? formatDate(from) : '?'} to ${to ? formatDate(to) : 'now'}`;
const roleLine = (assignment) => `${assignment.role.name}${assignment.scopeOffice ? ` (${assignment.scopeOffice.name})` : ' (university-wide)'} · ${period(assignment.validFrom, assignment.validTo)}`;

const PersonName = ({ person, canOpenUser }) => (canOpenUser ? <Link to={`/users/${person.id}`} className="hover:underline underline-offset-4">{person.fullName}</Link> : person.fullName);

/**
 * The office's records: what it no longer has (people who left, roles that ended, positions archived,
 * sub-offices deactivated) and where it has sat in the hierarchy. Nothing here can be changed.
 */
const RecordsPanel = ({ office }) => {
  const can = useCan();
  const canOpenUser = can('user:read');
  const { data, isLoading, error } = useOfficeRecords(office.id);
  const history = useOfficeHistory(office.id);
  const inactiveChildren = office.children.filter((child) => !child.isActive);

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load the records.')}</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RecordCard
          icon={<UserMinus className="h-4 w-4 text-primary" />}
          title="Former Members"
          isLoading={isLoading}
          items={data?.formerMembers ?? []}
          empty="Nobody has left this office yet."
          searchText={(member) => `${member.person.fullName} ${member.position.title}`}
          renderRow={(member) => (
            <Row>
              <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                <PersonName person={member.person} canOpenUser={canOpenUser} />
                {member.position.isHead && <Badge variant="outline">Head</Badge>}
              </p>
              <Meta>
                {member.position.title} · {period(member.startDate, member.endDate)}
              </Meta>
              {member.roles.map((assignment) => (
                <p key={assignment.id} className="text-xs text-primary">
                  {roleLine(assignment)}
                </p>
              ))}
            </Row>
          )}
        />

        <RecordCard
          icon={<ShieldOff className="h-4 w-4 text-primary" />}
          title="Ended Roles"
          isLoading={isLoading}
          items={(data?.endedRoles ?? []).flatMap((member) => member.roles.map((assignment) => ({ ...assignment, member })))}
          empty="No role has ended for the people still here."
          searchText={(item) => `${item.member.person.fullName} ${item.role.name}`}
          renderRow={(item) => (
            <Row>
              <p className="font-medium text-foreground">
                <PersonName person={item.member.person} canOpenUser={canOpenUser} />
              </p>
              <Meta>{item.member.position.title}</Meta>
              <p className="text-xs text-primary">{roleLine(item)}</p>
            </Row>
          )}
        />

        <RecordCard
          icon={<Archive className="h-4 w-4 text-primary" />}
          title="Archived Positions"
          isLoading={isLoading}
          items={data?.archivedPositions ?? []}
          empty="No position has been archived."
          searchText={(position) => position.title}
          renderRow={(position) => (
            <Row>
              <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                {position.title}
                {position.isHead && <Badge variant="outline">Head</Badge>}
              </p>
              <Meta>
                Archived {formatDate(position.archivedAt)} · Held by {position.pastHolders} {position.pastHolders === 1 ? 'person' : 'people'} over time
              </Meta>
            </Row>
          )}
        />

        <RecordCard
          icon={<Building2 className="h-4 w-4 text-primary" />}
          title="Deactivated Sub-offices"
          items={inactiveChildren}
          empty="No sub-office is deactivated."
          searchText={(child) => child.name}
          renderRow={(child) => (
            <Row>
              <p className="font-medium text-foreground">{child.name}</p>
              <Meta>{child.officeType.name}</Meta>
            </Row>
          )}
        />

        <RecordCard
          icon={<History className="h-4 w-4 text-primary" />}
          title="Reporting History"
          isLoading={history.isLoading}
          items={history.data ?? []}
          empty="No changes yet."
          renderRow={(row) => (
            <Row>
              <p className="font-medium text-foreground">{row.parent ? `Under ${row.parent.name}` : 'Top of the university'}</p>
              <Meta>
                {period(row.validFrom, row.validTo)}
                {row.changedBy && ` · By ${row.changedBy.fullName}`}
              </Meta>
              {row.reason && <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>}
            </Row>
          )}
        />
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Briefcase className="h-3.5 w-3.5" />
        Records are read-only. Positions are archived rather than deleted, so they always stay here.
      </p>
    </div>
  );
};

export default RecordsPanel;
