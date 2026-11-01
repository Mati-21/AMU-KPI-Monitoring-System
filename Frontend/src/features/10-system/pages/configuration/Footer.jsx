import { Save } from 'lucide-react';

import Button from '../../../../shared/components/ui/Button';
import { formatDate } from '../../../02-offices/lib/officeTree';

const lastChange = (settings) =>
  settings
    .filter((setting) => setting.updatedBy)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

function Footer({ settings, isDirty, pending, onSave, onReset }) {
  const change = lastChange(settings);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">{change ? `Last changed by ${change.updatedBy.fullName} on ${formatDate(change.updatedAt)}` : 'Not changed yet.'}</p>
      <div className="flex items-center gap-3">
        {isDirty && <span className="text-sm text-muted-foreground">You have unsaved changes.</span>}
        <Button type="button" variant="outline" disabled={pending} onClick={onReset}>
          Reset to Defaults
        </Button>
        <Button type="button" className="gap-2" disabled={!isDirty || pending} onClick={onSave}>
          <Save className="h-4 w-4" />
          {pending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

export default Footer;
