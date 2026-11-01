import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../shared/components/ui/dialog';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useAuditLog } from '../hooks/useSystem';
import { actionLabel, entityLabel, formatDateTime, formatValue } from '../lib/auditFormat';

const Detail = ({ label, children }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm text-foreground wrap-break-word">{children || '-'}</p>
  </div>
);

const AuditEntryDialog = ({ entryId, onClose }) => {
  const { data: entry, isLoading, error } = useAuditLog(entryId);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entry ? actionLabel(entry.action) : 'Log Entry'}</DialogTitle>
          <DialogDescription>{entry ? formatDateTime(entry.createdAt) : 'What happened, who did it and what changed.'}</DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load this entry.')}</p>}

        {entry && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Detail label="Person">{entry.actor?.fullName ?? 'System'}</Detail>
              <Detail label="Item">{entityLabel(entry.entityType)}</Detail>
              <Detail label="Item ID">{entry.entityId}</Detail>
              <Detail label="IP Address">{entry.ipAddress}</Detail>
              {entry.reason && <Detail label="Reason">{entry.reason}</Detail>}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Changes</p>
              {entry.changes.length === 0 && <p className="text-sm text-muted-foreground">No field changes were recorded.</p>}
              {entry.changes.map((change) => (
                <div key={change.field} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-foreground">{change.field}</p>
                  <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Before</p>
                      <p className="font-mono text-xs text-foreground wrap-break-word">{formatValue(change.old)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">After</p>
                      <p className="font-mono text-xs text-foreground wrap-break-word">{formatValue(change.new)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuditEntryDialog;
