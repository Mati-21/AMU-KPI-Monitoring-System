import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import Button from '../../../shared/components/ui/Button';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { ConfirmDialog } from '../../02-offices/components/FormParts';
import { holderName, isStaffContract } from '../../05-contracts/lib/contractRules';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import AllowLateDialog from '../components/AllowLateDialog';
import EvidenceDialog from '../components/EvidenceDialog';
import ReportSummary from '../components/ReportSummary';
import ResultsTable from '../components/ResultsTable';
import { ReopenDialog, ReviewDialog } from '../components/ReviewDialog';
import { useReport, useReportStep, useSaveResults } from '../hooks/useReports';
import { entryChanged, entryFromLine, entryPayload, isEntryComplete } from '../lib/reportRules';

const DECIDED = { APPROVED: 'Report approved.', REVISION_REQUIRED: 'Sent back for revision.', REJECTED: 'Report rejected.' };

/**
 * One office's report for one period: its results are entered and submitted here, and the office above reviews it.
 */
const ReportPage = () => {
  const { reportId } = useParams();
  const { notify } = useNotification();
  const { data: report, isLoading, error } = useReport(reportId);
  const save = useSaveResults();
  const step = useReportStep();
  // Only what was changed since the last save; everything else comes from the report itself
  const [edits, setEdits] = useState({});
  const [dialog, setDialog] = useState(null);
  const [evidenceFor, setEvidenceFor] = useState(null);

  if (isLoading) return <p className="p-6 text-sm text-foreground">Loading...</p>;
  if (error) return <p className="p-6 text-sm text-red-500">{apiErrorMessage(error, 'Could not load this report.')}</p>;

  const { can } = report;
  const direct = report.lines.filter((line) => line.isDirectEntry);
  const entries = Object.fromEntries(report.lines.map((line) => [line.assignmentId, edits[line.assignmentId] ?? entryFromLine(line)]));
  const changed = direct.filter((line) => entryChanged(line, entries[line.assignmentId]));
  const unfinished = changed.filter((line) => !isEntryComplete(line.kpi, entries[line.assignmentId]));
  const closeDialog = () => {
    step.reset();
    setDialog(null);
  };

  // Saves what changed. Resolves to true when there was nothing to save or it saved.
  const saveChanges = () =>
    new Promise((resolve) => {
      if (changed.length === 0) return resolve(true);
      if (unfinished.length > 0) {
        notify(`Complete or clear: ${unfinished.map((line) => line.kpi.name).join(', ')}`, 'error');
        return resolve(false);
      }
      save.mutate(
        { id: report.id, values: changed.map((line) => entryPayload(line, entries[line.assignmentId])) },
        {
          onSuccess: () => {
            setEdits({});
            resolve(true);
          },
          onError: (failure) => {
            notify(apiErrorMessage(failure, 'Could not save the results.'), 'error');
            resolve(false);
          },
        }
      );
    });

  const saveOnly = async () => {
    if (await saveChanges()) notify('Results saved.', 'success');
  };
  const submit = async () => {
    if (!(await saveChanges())) return closeDialog();
    step.mutate({ id: report.id, step: 'submit' }, { onSuccess: () => { notify('Report submitted.', 'success'); closeDialog(); } });
  };
  const startReview = () => step.mutate({ id: report.id, step: 'start-review' }, { onSuccess: () => notify('Marked as under review.', 'success'), onError: (failure) => notify(apiErrorMessage(failure, 'Could not do this.'), 'error') });

  const evidenceLine = evidenceFor && report.lines.find((line) => line.assignmentId === evidenceFor);

  // Back to where it was sent from: the person's own contract, the office's performance, or the approvals
  const yearId = report.reportingPeriod.fiscalYear.id;
  const backLink =
    report.side === 'BELOW'
      ? { to: `/approvals?year=${yearId}`, label: 'Back to Approve KPI' }
      : isStaffContract(report.contract)
        ? { to: `/my-contract?year=${yearId}`, label: 'Back to My Contract' }
        : { to: `/performance?year=${yearId}&office=${report.contract.officeId}`, label: 'Back to Performance' };

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link to={backLink.to} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              {backLink.label}
            </Link>
            <h1 className="text-2xl font-bold text-foreground">{report.reportingPeriod.name} Results</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {can.edit && (
              <Button type="button" variant="outline" disabled={save.isPending || changed.length === 0} onClick={saveOnly}>
                {save.isPending ? 'Saving...' : 'Save Results'}
              </Button>
            )}
            {can.submit && (
              <Button type="button" onClick={() => setDialog('submit')}>
                Submit Report
              </Button>
            )}
            {can.review && report.status === 'SUBMITTED' && (
              <Button type="button" variant="outline" disabled={step.isPending} onClick={startReview}>
                Start Review
              </Button>
            )}
            {can.review && (
              <Button type="button" onClick={() => setDialog('review')}>
                Review
              </Button>
            )}
            {can.allowLate && can.deadline.isLocked && (
              <Button type="button" variant="outline" onClick={() => setDialog('allowLate')}>
                Allow Late Submission
              </Button>
            )}
            {can.reopen && (
              <Button type="button" variant="outline" onClick={() => setDialog('reopen')}>
                Reopen
              </Button>
            )}
          </div>
        </div>

        <ReportSummary report={report} />
        {can.edit && changed.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-400">{changed.length} unsaved change(s).</p>}
        <ResultsTable report={report} entries={entries} editable={can.edit} onChange={(assignmentId, entry) => setEdits({ ...edits, [assignmentId]: entry })} onEvidence={(line) => setEvidenceFor(line.assignmentId)} />

        <ConfirmDialog
          open={dialog === 'submit'}
          onClose={closeDialog}
          title="Submit Report"
          description={`Send this report to ${report.contract.assigningOffice?.name ?? 'review'}? It cannot be changed while it is reviewed. Results left empty are recorded as not reported.`}
          onConfirm={submit}
          error={step.error}
          pending={step.isPending || save.isPending}
          confirmLabel="Submit"
          confirmVariant="default"
        />
        {dialog === 'review' && <ReviewDialog report={report} mutation={step} onClose={closeDialog} onDone={(decision) => { notify(DECIDED[decision], 'success'); closeDialog(); }} />}
        {dialog === 'reopen' && <ReopenDialog report={report} mutation={step} onClose={closeDialog} onDone={() => { notify('Report reopened.', 'success'); closeDialog(); }} />}
        {dialog === 'allowLate' && <AllowLateDialog contractId={report.contract.id} officeName={holderName(report.contract)} period={report.reportingPeriod} onClose={closeDialog} />}
        {evidenceLine && <EvidenceDialog report={report} line={evidenceLine} onClose={() => setEvidenceFor(null)} />}
      </main>
    </div>
  );
};

export default ReportPage;
