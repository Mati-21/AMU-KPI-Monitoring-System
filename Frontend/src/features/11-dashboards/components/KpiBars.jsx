import { useState } from 'react';

import { OUTCOMES, achievementOf, actualOf, measureText, percentText, weakestFirst } from '../lib/dashboardRules';
import BandLabel from './BandLabel';
import Panel, { Empty } from './Panel';

const SHOWN = 8;

/**
 * One KPI: how far its official result reaches, as a thin bar in its band's colour with the band named beside it.
 * Results without a percentage say why instead.
 */
const KpiRow = ({ line }) => {
  const { percent, band, isRunningTotal } = achievementOf(line);
  const actual = measureText(line.kpi, actualOf(line));
  const target = measureText(line.kpi, line.target);
  const fill = isRunningTotal ? 'var(--color-muted-foreground)' : band?.color ?? 'var(--color-muted-foreground)';

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(8rem,1fr)_auto]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground" title={line.kpi.name}>
          {line.kpi.name}
        </p>
        {(actual || target) && (
          <p className="text-xs text-muted-foreground">
            {actual ? `Result ${actual}` : 'No result yet'}
            {target ? ` · Target ${line.kpi.direction === 'LOWER_IS_BETTER' ? 'at most ' : ''}${target}` : ''}
          </p>
        )}
      </div>
      <div className="order-3 col-span-2 h-2 rounded-full bg-muted sm:order-none sm:col-span-1" aria-hidden="true">
        {percent !== null && <div className="h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(percent, 2))}%`, backgroundColor: fill }} />}
      </div>
      <div className="min-w-[9.5rem] text-right">
        {percent !== null ? (
          <>
            <p className="text-sm font-semibold text-foreground">{percentText(percent)}</p>
            {isRunningTotal ? <p className="text-xs text-muted-foreground">In progress, adds up to year end</p> : <BandLabel band={band} />}
          </>
        ) : (
          <p className="text-xs font-medium text-muted-foreground">{OUTCOMES[line.outcome]?.label ?? '-'}</p>
        )}
      </div>
    </li>
  );
};

/**
 * Every KPI of the contract, weakest first, so what needs attention is on top.
 */
const KpiBars = ({ kpis, title = 'KPIs, weakest first' }) => {
  const [showAll, setShowAll] = useState(false);
  const ordered = weakestFirst(kpis);
  const shown = showAll ? ordered : ordered.slice(0, SHOWN);

  return (
    <Panel
      title={title}
      description="Approved results against the target. A count that adds up through the year shows progress until the year end."
      action={
        ordered.length > SHOWN && (
          <button type="button" onClick={() => setShowAll(!showAll)} className="shrink-0 text-xs font-medium text-primary hover:underline">
            {showAll ? 'Show fewer' : `Show all ${ordered.length}`}
          </button>
        )
      }
    >
      {ordered.length === 0 ? <Empty>No KPIs on this contract.</Empty> : <ul className="divide-y divide-border">{shown.map((line) => <KpiRow key={line.assignmentId} line={line} />)}</ul>}
    </Panel>
  );
};

export default KpiBars;
