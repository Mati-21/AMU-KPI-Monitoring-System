import { useState } from 'react';
import { Briefcase, Edit3, Mail, Phone, Save, User, X } from 'lucide-react';

import Button from '../../../../shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../shared/components/ui/Card';
import { Input } from '../../../../shared/components/ui/Input';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { formatEthiopianDate } from '../../../../shared/lib/ethiopianDate';
import { roleNames } from '../../../03-access-control/lib/roleAssignments';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import { useUpdateMyProfile } from '../../hooks/useProfile';

const Row = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground break-words">{children}</div>
    </div>
  </div>
);

export const AboutCard = ({ user }) => {
  const { notify } = useNotification();
  const update = useUpdateMyProfile();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const startEditing = () => {
    setPhone(user.phone ?? '');
    setEmail(user.email ?? '');
    setEditing(true);
  };

  const save = (event) => {
    event.preventDefault();
    update.mutate(
      { phone, email },
      {
        onSuccess: () => {
          setEditing(false);
          notify('Your details were saved.', 'success');
        },
        onError: (error) => notify(apiErrorMessage(error, 'Could not save your details.'), 'error'),
      }
    );
  };

  return (
    <Card className="border-border bg-card">
      <form onSubmit={save}>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            About
          </CardTitle>
          {editing ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-2">
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" size="sm" className="gap-2" disabled={update.isPending}>
                <Save className="h-4 w-4" />
                {update.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={startEditing} className="gap-2">
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Row icon={User} label="Username">
            {user.username}
          </Row>
          <Row icon={Mail} label="Email">
            {editing ? <Input type="email" aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} /> : user.email || 'Not set'}
          </Row>
          <Row icon={Phone} label="Phone">
            {editing ? <Input type="tel" aria-label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} /> : user.phone || 'Not set'}
          </Row>
          {editing && <p className="text-xs text-muted-foreground">To change your name, contact a user administrator.</p>}
        </CardContent>
      </form>
    </Card>
  );
};

export const PlacementsCard = ({ placements = [], action, placementAction }) => (
  <Card className="border-border bg-card">
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="flex items-center gap-2 text-base">
        <Briefcase className="h-4 w-4 text-primary" />
        Offices and Roles
      </CardTitle>
      {action}
    </CardHeader>
    <CardContent className="space-y-3">
      {placements.length === 0 && <p className="text-sm text-muted-foreground">Not placed in an office yet.</p>}
      {placements.map((placement) => (
        <div key={placement.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{placement.office.name}</p>
            {placement.position && <p className="text-xs text-muted-foreground">{placement.position.title}</p>}
            <p className="mt-1 text-xs text-primary">{roleNames(placement.roles)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Since {formatEthiopianDate(placement.startDate)}</p>
          </div>
          {placementAction?.(placement)}
        </div>
      ))}
    </CardContent>
  </Card>
);
