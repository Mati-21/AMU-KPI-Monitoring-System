import { ChevronRight } from 'lucide-react';

import { bandFor, percentText } from '../lib/dashboardRules';
import BandLabel from './BandLabel';
import Panel, { Empty } from './Panel';

const STATE_WORDS = { PENDING: 'latest waiting for approval', RETURNED: 'latest sent back', REJECTED: 'latest rejected', APPROVED: 'latest approved' };

/**
 * Offices or people side by side by their official score, best first. Scores are compared, never averaged: each
 * contract is scored on its own weights. Without a score yet, a row says so instead of showing zero.
 * compact stacks each row for a narrow column: name and score on one line, the bar under them.
 */
const CompactRow = ({ row, percent, band }) => (
  <div className="py-2.5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
        {row.detail && <p className="text-xs text-muted-foreground">{row.detail}</p>}
      </div>
      <div className="shrink-0 text-right">
        {percent === null ? <p className="text-xs text-muted-foreground">No approved score yet</p> : <p className="text-sm font-semibold text-foreground">{percentText(percent)}</p>}
      </div>
    </div>
    {percent !== null && (
      <div className="mt-1.5 flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-muted" aria-hidden="true">
          <div className="h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(percent, 2))}%`, backgroundColor: band?.color }} />
        </div>
        <BandLabel band={band} className="shrink-0" />
      </div>
    )}
  </div>
);

const CompareBars = ({ title, description, rows, bands, emptyText, onSelect, compact = false }) => (
  <Panel title={title} description={description}>
    {rows.length === 0 ? (
      <Empty>{emptyText}</Empty>
    ) : (
      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const percent = row.score?.officialScore ?? null;
          const band = bandFor(percent, bands);
          if (compact) {
            return (
              <li key={row.key}>
                <CompactRow row={row} percent={percent} band={band} />
              </li>
            );
          }
          const content = (
            <>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[row.detail, row.latestState && STATE_WORDS[row.latestState], row.score?.isProvisional ? 'provisional' : null].filter(Boolean).join(' · ') || ' '}
                </p>
              </div>
              <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                {percent !== null && <div className="h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(percent, 2))}%`, backgroundColor: band?.color }} />}
              </div>
              <div className="min-w-[8.5rem] text-right">
                {percent === null ? (
                  <p className="text-xs text-muted-foreground">No approved score yet</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">{percentText(percent)}</p>
                    <BandLabel band={band} />
                  </>
                )}
              </div>
              {onSelect && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            </>
          );
          const grid = `grid w-full items-center gap-4 py-2.5 text-left ${onSelect ? 'grid-cols-[minmax(0,1.2fr)_minmax(6rem,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1.2fr)_minmax(6rem,1fr)_auto]'}`;
          return (
            <li key={row.key}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(row)} className={`${grid} rounded-md hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} aria-label={`Open ${row.name}`}>
                  {content}
                </button>
              ) : (
                <div className={grid}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </Panel>
);

export default CompareBars;
