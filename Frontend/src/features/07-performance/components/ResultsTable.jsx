import { Paperclip } from 'lucide-react';

import { Input } from '../../../shared/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/components/ui/Table';
import { personName } from '../../05-contracts/lib/contractRules';
import { achievementOf, resultText } from '../lib/reportRules';
import ResultInput from './ResultInput';

const Achievement = ({ line }) => {
  const { percent, threshold, reason } = achievementOf(line);
  if (percent === null) return <span className="text-xs text-muted-foreground">{reason ?? '-'}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
      {threshold?.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: threshold.color }} aria-hidden="true" />}
      {percent}%{threshold && <span className="text-xs font-normal text-muted-foreground">{threshold.name}</span>}
    </span>
  );
};

/**
 * The office's own result for one line: typed in while the report is open, otherwise shown.
 * A KPI reported at another frequency adds up here by itself, and so does one the office's people hold.
 */
const ResultCell = ({ line, entry, editable, onChange }) => {
  if (line.fromStaff) {
    return (
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{line.direct.reportingStatus === 'REPORTED' ? resultText(line.kpi, line.direct) : '-'}</p>
        <p className="text-xs text-muted-foreground">Added up from staff results, once approved</p>
        {line.staff.map((part) => (
          <p key={part.assignmentId} className="text-xs text-foreground">
            {personName(part.person)}: {part.result ? resultText(line.kpi, part.result) : 'not approved yet'}
          </p>
        ))}
      </div>
    );
  }
  if (!line.isDirectEntry) {
    return <p className="text-sm text-foreground">{resultText(line.kpi, line.total)} <span className="block text-xs text-muted-foreground">Adds up from its own periods</span></p>;
  }
  if (!editable) {
    return (
      <div>
        <p className="text-sm font-medium text-foreground">{resultText(line.kpi, line.direct)}</p>
        {line.direct?.note && <p className="text-xs text-muted-foreground">{line.direct.note}</p>}
      </div>
    );
  }
  const notReported = entry.reportingStatus === 'NOT_REPORTED';
  return (
    <div className="space-y-1.5">
      {!notReported && <ResultInput kpi={line.kpi} entry={entry} onChange={onChange} label={`Result for ${line.kpi.name}`} />}
      <label className="flex items-center gap-1.5 text-xs text-foreground">
        <input type="checkbox" checked={notReported} onChange={(event) => onChange({ ...entry, reportingStatus: event.target.checked ? 'NOT_REPORTED' : 'REPORTED' })} />
        No result this period
      </label>
      <Input value={entry.note} onChange={(event) => onChange({ ...entry, note: event.target.value })} placeholder={notReported ? 'Why is there no result?' : 'Note (optional)'} aria-label={`Note for ${line.kpi.name}`} className="h-8 text-xs" />
    </div>
  );
};

/**
 * Every KPI of the report with its target, the result and how far it reaches.
 */
const ResultsTable = ({ report, entries, editable, onChange, onEvidence }) => (
  <div className="overflow-x-auto rounded-lg border border-border bg-card">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>KPI</TableHead>
          <TableHead>Weight</TableHead>
          <TableHead>Baseline</TableHead>
          <TableHead>Target</TableHead>
          <TableHead className="min-w-[16rem]">Result</TableHead>
          <TableHead>From Offices Below</TableHead>
          <TableHead>Achievement</TableHead>
          <TableHead>Evidence</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.lines.length === 0 && (
          <TableRow>
            <TableCell colSpan={8}>No KPIs are reported in this period.</TableCell>
          </TableRow>
        )}
        {report.lines.map((line) => {
          const fromBelow = line.offices.length > 0;
          const rejected = line.evidence.filter((item) => item.verificationStatus === 'REJECTED').length;
          return (
            <TableRow key={line.assignmentId}>
              <TableCell className="max-w-[16rem]">
                <p className="font-medium text-foreground">{line.kpi.name}</p>
              </TableCell>
              <TableCell>{line.weight ?? '-'}</TableCell>
              <TableCell>{resultText(line.kpi, line.baseline)}</TableCell>
              <TableCell>{resultText(line.kpi, line.target)}</TableCell>
              <TableCell>
                <ResultCell line={line} entry={entries[line.assignmentId]} editable={editable} onChange={(entry) => onChange(line.assignmentId, entry)} />
              </TableCell>
              <TableCell>
                {fromBelow ? (
                  <div className="space-y-0.5 text-xs text-foreground">
                    {line.offices.map((office) => (
                      <p key={office.assignmentId}>
                        {office.office.name}: {office.result ? resultText(line.kpi, office.result) : 'Not approved yet'}
                      </p>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <Achievement line={line} />
              </TableCell>
              <TableCell>
                {line.isDirectEntry && !line.fromStaff ? (
                  <button type="button" onClick={() => onEvidence(line)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted" aria-label={`Evidence for ${line.kpi.name}`}>
                    <Paperclip className="h-3.5 w-3.5" />
                    {line.evidence.length}
                    {rejected > 0 && <span className="text-red-600 dark:text-red-400">({rejected} rejected)</span>}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
);

export default ResultsTable;
