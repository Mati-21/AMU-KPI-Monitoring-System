import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { percentText, scoreColor } from '../lib/dashboardRules';
import Panel, { Empty } from './Panel';

const STATE_WORDS = { PENDING: 'Waiting for approval', RETURNED: 'Sent back', REJECTED: 'Rejected', APPROVED: 'Approved' };

const scoreOf = (row) => row.score?.officialScore ?? null;

// Weakest first by default so what needs action is on top; offices with no score yet always come last, never as 0
const arrange = (rows, weakestFirst) =>
  [...rows].sort((a, b) => {
    const pa = scoreOf(a);
    const pb = scoreOf(b);
    if ((pa === null) !== (pb === null)) return pa === null ? 1 : -1;
    const byScore = weakestFirst ? (pa ?? 0) - (pb ?? 0) : (pb ?? 0) - (pa ?? 0);
    return byScore || a.name.localeCompare(b.name);
  });

const metText = (summary) => (summary && summary.total > 0 ? `${summary.exceeding + summary.meeting} of ${summary.total} KPIs met` : null);

/**
 * One row: the name, a bar of the score out of 100 in the score's colour, the score, and what the office is waiting
 * on. An office without an approved score shows an empty bar and says why, rather than 0%.
 */
const Row = ({ row, onSelect }) => {
  const percent = scoreOf(row);
  const status = row.latestState ? STATE_WORDS[row.latestState] : 'Not reported yet';
  const content = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground" title={row.name}>
          {row.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{[row.detail, metText(row.summary)].filter(Boolean).join(' · ') || ' '}</p>
      </div>
      <div className="h-3 rounded-full bg-muted" aria-hidden="true">
        {percent !== null && <div className="h-3 rounded-full" style={{ width: `${Math.min(100, Math.max(percent, 2))}%`, backgroundColor: scoreColor(percent) }} />}
      </div>
      <div className="min-w-[8rem] text-right">
        {percent === null ? (
          <p className="text-xs text-muted-foreground">{status}</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">{percentText(percent)}</p>
            <p className="text-xs text-muted-foreground">{row.latestState && row.latestState !== 'APPROVED' ? status : row.score.isProvisional ? 'Provisional' : 'Final'}</p>
          </>
        )}
      </div>
      {onSelect && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
    </>
  );
  const grid = `grid w-full items-center gap-4 py-2.5 text-left ${onSelect ? 'grid-cols-[minmax(0,1.2fr)_minmax(6rem,1.4fr)_auto_auto]' : 'grid-cols-[minmax(0,1.2fr)_minmax(6rem,1.4fr)_auto]'}`;
  return onSelect ? (
    <button type="button" onClick={() => onSelect(row)} className={`${grid} rounded-md hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} aria-label={`Open ${row.name}`}>
      {content}
    </button>
  ) : (
    <div className={grid}>{content}</div>
  );
};

const LEGEND = [
  ['#ef4444', 'Below 30'],
  ['#f97316', '30 to 60'],
  ['#eab308', '60 to 85'],
  ['#10b981', '85 and above'],
];

/**
 * The office's own work and the offices directly below it, side by side as a horizontal bar chart of their official
 * scores. Scores are compared, never averaged: each contract is scored on its own weights.
 */
const OfficeBars = ({ rows, title = 'Performance by office', description, emptyText = 'Nothing to compare yet.', onSelect }) => {
  const [weakestFirst, setWeakestFirst] = useState(true);
  const ordered = arrange(rows, weakestFirst);

  return (
    <Panel
      title={title}
      description={description}
      action={
        rows.length > 1 && (
          <button type="button" onClick={() => setWeakestFirst(!weakestFirst)} className="shrink-0 text-xs font-medium text-primary hover:underline">
            {weakestFirst ? 'Weakest first' : 'Best first'}
          </button>
        )
      }
    >
      {ordered.length === 0 ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {ordered.map((row) => (
              <li key={row.key}>
                <Row row={row} onSelect={onSelect} />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3">
            {LEGEND.map(([color, text]) => (
              <span key={text} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                {text}
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
};

export default OfficeBars;
