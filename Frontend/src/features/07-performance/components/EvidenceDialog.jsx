import { useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';

import Button from '../../../shared/components/ui/Button';
import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../shared/components/ui/dialog';
import { Input } from '../../../shared/components/ui/Input';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { formatEthiopianDate as formatDate } from '../../../shared/lib/ethiopianDate';
import { Field } from '../../02-offices/components/FormParts';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { openFile, useAttachEvidence, useDocumentTypes, useRemoveEvidence, useVerifyEvidence } from '../hooks/useReports';
import { EVIDENCE_WORDS } from '../lib/reportRules';

const TONES = {
  PENDING: 'text-muted-foreground',
  VERIFIED: 'text-green-700 dark:text-green-400',
  REJECTED: 'text-red-600 dark:text-red-400',
};

/**
 * The reviewer's verdict on one piece of evidence. Rejecting needs a reason, so the office knows what to fix.
 */
const VerifyControls = ({ item }) => {
  const verify = useVerifyEvidence();
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');
  const send = (status) => verify.mutate({ id: item.id, status, comment: comment.trim() || undefined }, { onSuccess: () => setRejecting(false) });

  return (
    <div className="space-y-2">
      {!rejecting ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={verify.isPending} onClick={() => send('VERIFIED')}>
            Verify
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={verify.isPending} onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What is wrong with it?" aria-label="Reason for rejecting" className="h-8 flex-1 text-sm" />
          <Button type="button" size="sm" variant="destructive" disabled={verify.isPending || !comment.trim()} onClick={() => send('REJECTED')}>
            Reject
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
        </div>
      )}
      {verify.error && <p className="text-xs text-red-500">{apiErrorMessage(verify.error, 'Could not save this.')}</p>}
    </div>
  );
};

const AttachForm = ({ line, officeId }) => {
  const { notify } = useNotification();
  const { data: types = [] } = useDocumentTypes();
  const attach = useAttachEvidence();
  const active = types.filter((type) => type.isActive);
  const [typeId, setTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [inputKey, setInputKey] = useState(0);
  const chosenType = typeId || active.find((type) => type.name === 'Performance Evidence')?.id || active[0]?.id || '';
  const extensions = active.find((type) => type.id === chosenType)?.allowedExtensions;

  const submit = (event) => {
    event.preventDefault();
    attach.mutate(
      { valueId: line.direct.id, officeId, documentTypeId: chosenType, title: title.trim(), file },
      {
        onSuccess: () => {
          notify('Evidence attached.', 'success');
          setTitle('');
          setFile(null);
          setInputKey((key) => key + 1);
        },
      }
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-semibold text-foreground">Attach Evidence</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" required>
          <Input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Q1 receipts" />
        </Field>
        <Field label="Document Type" required group>
          <CustomSelect compact options={active.map((type) => ({ value: type.id, label: type.name }))} value={chosenType} onChange={setTypeId} />
        </Field>
      </div>
      <Field label="File" required hint={extensions ? `Allowed: ${extensions.split(',').join(', ')}` : undefined}>
        <input key={inputKey} type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground" />
      </Field>
      {attach.error && <p className="text-sm text-red-500">{apiErrorMessage(attach.error, 'Could not attach this file.')}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={attach.isPending || !file || !title.trim() || !chosenType}>
          {attach.isPending ? 'Uploading...' : 'Attach'}
        </Button>
      </div>
    </form>
  );
};

/**
 * The evidence behind one result: the reporting office attaches it, the office above verifies it.
 */
const EvidenceDialog = ({ report, line, onClose }) => {
  const { notify } = useNotification();
  const remove = useRemoveEvidence();
  const { can } = report;
  const open = (fileId) => openFile(fileId).catch((failure) => notify(apiErrorMessage(failure, 'Could not open this file.'), 'error'));

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Evidence</DialogTitle>
          <DialogDescription>{line.kpi.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {line.evidence.length === 0 && <p className="text-sm text-muted-foreground">No evidence attached yet.</p>}
          {line.evidence.map((item) => (
            <div key={item.id} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => open(item.document.fileId)} className="flex items-start gap-2 text-left">
                  <FileText className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-sm font-medium text-foreground underline-offset-2 hover:underline">{item.document.title}</span>
                    <span className="block text-xs text-muted-foreground">Added {formatDate(item.document.createdAt)}</span>
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${TONES[item.verificationStatus]}`}>{EVIDENCE_WORDS[item.verificationStatus] ?? item.verificationStatus}</span>
                  {can.attachEvidence && (
                    <button type="button" onClick={() => remove.mutate(item.id)} disabled={remove.isPending} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label={`Remove ${item.document.title}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {item.comment && <p className="text-xs text-foreground">Reviewer: {item.comment}</p>}
              {can.verifyEvidence && <VerifyControls item={item} />}
            </div>
          ))}
          {remove.error && <p className="text-sm text-red-500">{apiErrorMessage(remove.error, 'Could not remove this.')}</p>}
        </div>

        {can.attachEvidence && (line.direct ? <AttachForm line={line} officeId={report.contract.officeId} /> : <p className="text-sm text-muted-foreground">Save a result for this KPI first, then attach its evidence.</p>)}
      </DialogContent>
    </Dialog>
  );
};

export default EvidenceDialog;
