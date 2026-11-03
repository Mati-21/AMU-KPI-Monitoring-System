import { useState } from 'react';
import { ChevronRight, Paperclip } from 'lucide-react';
import { Link } from 'react-router-dom';

import Button from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { formatEthiopianDate as formatDate } from '../../../shared/lib/ethiopianDate';
import { ConfirmDialog } from '../../02-offices/components/FormParts';
import { holderName, personName } from '../../05-contracts/lib/contractRules';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useSavePeriod } from '../hooks/useReports';
import { entryChanged, entryFromLine, entryPayload, isEntryComplete, reportStatusLabel, resultText as withUnitText } from '../lib/reportRules';
import { unitText } from '../lib/sheetRules';
import AllowLateDialog from './AllowLateDialog';
import DeadlineNote from './DeadlineNote';
import ResultInput from './ResultInput';
import ThemeRows from './ThemeRows';

const FIXED_COLUMNS = ['KPI', 'Unit', 'Weight', 'Baseline', 'Target'];
// A period's status under its name in the header, as plain coloured text
const STATUS_TEXT = {
  DRAFT: 'text-muted-foreground',
  SUBMITTED: 'text-blue-700 dark:text-blue-300',
  UNDER_REVIEW: 'text-blue-700 dark:text-blue-300',
  REVISION_REQUIRED: 'text-amber-700 dark:text-amber-400',
  REJECTED: 'text-red-600 dark:text-red-400',
  APPROVED: 'text-green-700 dark:text-green-400',
};
// The Unit column says the unit, so the numbers leave it out
const resultText = (kpi, row) => withUnitText(kpi, row, false);

/**
 * A KPI the office's people hold: their approved results added up, with each person's part.
 */
const StaffCell = ({ kpi, cell }) => (
  <div className="space-y-0.5">
    <p className="text-sm font-medium text-foreground">{cell.direct?.reportingStatus === 'REPORTED' ? resultText(kpi, cell.direct) : '-'}</p>
    <p className="text-xs text-muted-foreground">From staff, once approved</p>
    {cell.staff.map(({ person, result }) => (
      <p key={person.id} className="text-xs text-foreground">
        {personName(person)}: {result ? resultText(kpi, result) : 'not approved yet'}
      </p>
    ))}
  </div>
);

/**
 * A result already entered or calculated, as text. A period that has not started yet shows a dash.
 */
const shownResult = (row, period) => {
  const cell = row.cells[period.id];
  if (!period.can.hasStarted || !cell) return '-';
  if (cell.direct?.reportingStatus === 'NOT_REPORTED' && !cell.fromBelow) return 'Not reported';
  return resultText(row.kpi, cell.total ?? cell.direct);
};

/**
 * One reporting frequency of an office's year: a column per period, the open period's column typed in.
 * Results of the offices below fill in by themselves, and so do KPIs the office's people hold on their staff contracts;
 * only the rest of the office's own work is typed.
 */
const PerformanceSection = ({ section, contract, onEvidence }) => {
  const { notify } = useNotification();
  const save = useSavePeriod();
  const [edits, setEdits] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [allowingLate, setAllowingLate] = useState(false);
  const open = section.periods.find((period) => period.id === section.openPeriodId);
  const canEnter = Boolean(open?.can.edit);

  const cellOf = (row) => (open ? row.cells[open.id] : null);
  const typesHere = (row) => canEnter && Boolean(cellOf(row)?.needsOwnFigure);
  const entryOf = (row) => edits[row.assignmentId] ?? entryFromLine({ direct: cellOf(row)?.direct });
  const changed = section.rows.filter((row) => typesHere(row) && entryChanged({ direct: cellOf(row)?.direct }, entryOf(row)));
  const unfinished = changed.filter((row) => !isEntryComplete(row.kpi, entryOf(row)));

  const send = (submit) => {
    if (unfinished.length > 0) {
      notify(`Complete or clear: ${unfinished.map((row) => row.kpi.name).join(', ')}`, 'error');
      setConfirming(false);
      return;
    }
    save.mutate(
      { contractId: contract.id, periodId: open.id, reportId: open.report?.id, values: changed.map((row) => entryPayload(row, entryOf(row))), submit },
      {
        onSuccess: () => {
          setEdits({});
          setConfirming(false);
          notify(submit ? `${open.name} submitted to ${contract.assigningOffice?.name ?? 'review'}.` : 'Results saved.', 'success');
        },
        onError: (failure) => {
          setConfirming(false);
          notify(apiErrorMessage(failure, 'Could not save the results.'), 'error');
        },
      }
    );
  };

  const latestNote = (row) => [...section.periods].reverse().map((period) => row.cells[period.id]?.direct?.note).find(Boolean) ?? '-';

  const openCell = (row) => {
    const cell = cellOf(row);
    if (cell?.fromStaff) return <StaffCell kpi={row.kpi} cell={cell} />;
    if (!typesHere(row)) {
      return (
        <div>
          <p className="text-sm text-foreground">{resultText(row.kpi, cell?.fromBelow ?? cell?.total)}</p>
          <p className="text-xs text-muted-foreground">From offices below</p>
        </div>
      );
    }
    const entry = entryOf(row);
    return (
      <div className="space-y-1">
        {row.hasOfficesBelow && <p className="text-xs text-muted-foreground">Own work{row.kept ? ` (kept ${row.kept})` : ''}</p>}
        <div className="flex items-center gap-1.5">
          <ResultInput kpi={row.kpi} entry={entry} onChange={(next) => setEdits({ ...edits, [row.assignmentId]: next })} label={`${open.name} result for ${row.kpi.name}`} />
          {cell?.valueId && open.can.attachEvidence && (
            <button type="button" onClick={() => onEvidence(row, open)} className="inline-flex items-center gap-0.5 rounded-md border border-border px-1.5 py-1 text-xs text-foreground hover:bg-muted" aria-label={`Evidence for ${row.kpi.name}`}>
              <Paperclip className="h-3.5 w-3.5" />
              {cell.evidence.length}
            </button>
          )}
        </div>
        {row.hasOfficesBelow && cell?.fromBelow && <p className="text-xs text-muted-foreground">+ {resultText(row.kpi, cell.fromBelow)} from offices below</p>}
      </div>
    );
  };

  const renderRow = (row) => (
    <TableRow key={row.assignmentId}>
      <TableCell className="min-w-48 max-w-[16rem] font-medium text-foreground">{row.kpi.name}</TableCell>
      <TableCell>{unitText(row.kpi)}</TableCell>
      <TableCell>{row.weight ?? '-'}</TableCell>
      <TableCell>{resultText(row.kpi, row.baseline)}</TableCell>
      <TableCell>{resultText(row.kpi, row.target)}</TableCell>
      {section.periods.map((period) => (
        <TableCell key={period.id} className={period.id === open?.id ? 'bg-muted/40' : ''}>
          {period.id === open?.id && canEnter ? openCell(row) : <span className={period.can.hasStarted ? 'text-foreground' : 'text-muted-foreground'}>{shownResult(row, period)}</span>}
        </TableCell>
      ))}
      <TableCell className="min-w-40">
        {typesHere(row) ? (
          <Input value={entryOf(row).note} onChange={(event) => setEdits({ ...edits, [row.assignmentId]: { ...entryOf(row), note: event.target.value } })} placeholder="Remark" aria-label={`Remark for ${row.kpi.name}`} className="h-8 text-xs" />
        ) : (
          <span className="text-xs text-foreground">{latestNote(row)}</span>
        )}
      </TableCell>
    </TableRow>
  );

  const columnCount = FIXED_COLUMNS.length + section.periods.length + 1;

  return (
    <section aria-label={`${section.frequency.name} Period`} className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{section.frequency.name} Period</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {open ? `${open.name} is open${open.submissionDeadline ? `, due ${formatDate(open.submissionDeadline)}` : ''}.` : 'No period is open for entry right now.'}
          </p>
          {open && <DeadlineNote period={open} deadline={open.can.deadline} report={open.report} />}
        </div>
        {(canEnter || open?.can.allowLate) && (
          <div className="flex flex-wrap items-center gap-2">
            {open.can.allowLate && open.can.deadline.isLocked && (
              <Button type="button" variant="outline" onClick={() => setAllowingLate(true)}>
                Allow Late Submission
              </Button>
            )}
            {changed.length > 0 && <span className="text-xs text-amber-700 dark:text-amber-400">{changed.length} unsaved</span>}
            {canEnter && (
              <Button type="button" variant="outline" disabled={save.isPending || changed.length === 0} onClick={() => send(false)}>
                Save
              </Button>
            )}
            {open.can.submit && (
              <Button type="button" disabled={save.isPending} onClick={() => setConfirming(true)}>
                Submit {open.name}
                {open.can.deadline.isLate ? ' (late)' : ''}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {FIXED_COLUMNS.map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
              {section.periods.map((period) => (
                <TableHead key={period.id} className={`min-w-24 ${period.id === open?.id ? 'bg-muted/40' : ''}`} title={`${formatDate(period.startDate)} - ${formatDate(period.endDate)}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1">
                    {period.report ? (
                      <Link to={`/reports/${period.report.id}`} title={`Open ${period.name}: results, evidence and review`} className="inline-flex items-center gap-0.5 font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                        {period.name}
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ) : (
                      <span>{period.name}</span>
                    )}
                    {period.report && <span className={`text-xs font-medium normal-case ${STATUS_TEXT[period.report.status] ?? 'text-muted-foreground'}`}>{reportStatusLabel(period.report.status)}</span>}
                    {period.report?.isLate && <span className="text-xs font-medium normal-case text-red-600 dark:text-red-400">Late</span>}
                  </div>
                </TableHead>
              ))}
              <TableHead>Remark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ThemeRows rows={section.rows} columns={columnCount} weightColumn={2} renderRow={renderRow} showTotals={false} />
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Submit ${open?.name ?? ''}`}
        description={`Send ${open?.name} to ${contract.assigningOffice?.name ?? 'review'}? It cannot be changed while it is reviewed. Results left empty are recorded as not reported.${open?.can.deadline.isLate ? ' It is past the deadline, so it will be marked late.' : ''}`}
        onConfirm={() => send(true)}
        pending={save.isPending}
        confirmLabel="Submit"
        confirmVariant="default"
      />
      {allowingLate && <AllowLateDialog contractId={contract.id} officeName={holderName(contract)} period={open} onClose={() => setAllowingLate(false)} />}
    </section>
  );
};

export default PerformanceSection;
