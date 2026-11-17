import { ClipboardList, Gauge, Share2, Target, TrendingDown } from 'lucide-react';

import { OUTCOMES, bandFor, percentText, scoreColor } from '../lib/dashboardRules';
import BandLabel from './BandLabel';

const TONES = {
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  red: 'bg-red-500/15 text-red-600 dark:text-red-400',
  neutral: 'bg-primary/15 text-primary',
};

const Card = ({ label, icon, tone, value, note, children }) => (
  <div className="flex flex-col rounded-lg border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
        {icon}
      </span>
    </div>
    <p className="mt-2 text-3xl font-semibold leading-none text-foreground">{value}</p>
    {note && <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>}
    {children && <div className="mt-auto pt-4">{children}</div>}
  </div>
);

// A thin bar showing how much of the whole a count takes up
const ShareBar = ({ part, total, color }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
    <div className="h-full rounded-full" style={{ width: `${total > 0 ? Math.min(100, (part / total) * 100) : 0}%`, backgroundColor: color }} />
  </div>
);

const Legend = ({ color, text }) => (
  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
    {text}
  </span>
);

const GREEN = '#10b981';
const RED = '#ef4444';
const BLUE = '#3b82f6';
const VIOLET = '#8b5cf6';

/**
 * The head's headline figures for one office: what it was given, what it passed on, how many KPIs reached their
 * target and how many did not, and the office score. Met target counts KPIs above and on target; a KPI still adding
 * up, waiting for approval or not yet reported is in neither count.
 */
const OfficeCards = ({ score, summary, bands, kpis = [] }) => {
  const percent = score?.officialScore ?? null;
  const band = bandFor(percent, bands);
  const { total } = summary;
  const met = summary.exceeding + summary.meeting;
  const open = Math.max(0, total - met - summary.below);
  // What the KPIs in neither count are waiting on, only the states that have any
  const waitingText = [
    [summary.inProgress, 'in progress'],
    [summary.pending, 'waiting for approval'],
    [summary.returned + summary.rejected, 'sent back'],
    [summary.notReported, 'not reported'],
    [summary.notCalculable, 'without a score'],
  ]
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(' · ');
  // The names behind that text, shown when the pointer rests on it
  const namesText = ['IN_PROGRESS', 'PENDING', 'RETURNED', 'REJECTED', 'NOT_REPORTED', 'NOT_CALCULABLE']
    .map((outcome) => [OUTCOMES[outcome].label, kpis.filter((kpi) => kpi.outcome === outcome).map((kpi) => kpi.kpi.name)])
    .filter(([, names]) => names.length > 0)
    .map(([label, names]) => `${label}: ${names.join(', ')}`)
    .join('\n');
  const percentOf = (part) => (total > 0 ? `${Math.round((part / total) * 100)}% of assigned` : 'Nothing assigned yet');

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Card label="KPIs assigned" icon={<ClipboardList className="h-[18px] w-[18px]" aria-hidden="true" />} tone="blue" value={total} note="Accepted on the contract">
        {total > 0 && (
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div style={{ width: `${(met / total) * 100}%`, backgroundColor: GREEN }} />
            <div style={{ width: `${(summary.below / total) * 100}%`, backgroundColor: RED }} />
          </div>
        )}
        {total > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
            <Legend color={GREEN} text={`${met} met`} />
            <Legend color={RED} text={`${summary.below} below`} />
            <Legend color="#94a3b8" text={`${open} other`} />
          </div>
        )}
      </Card>

      <Card label="Shared with offices below" icon={<Share2 className="h-[18px] w-[18px]" aria-hidden="true" />} tone="violet" value={summary.sharedBelow} note={`of ${total} assigned`}>
        <ShareBar part={summary.sharedBelow} total={total} color={VIOLET} />
        <p className="mt-2 text-[11px] text-muted-foreground">{total - summary.sharedBelow} kept by this office</p>
      </Card>

      <Card label="Met the target" icon={<Target className="h-[18px] w-[18px]" aria-hidden="true" />} tone="green" value={met} note={percentOf(met)}>
        <ShareBar part={met} total={total} color={GREEN} />
        <p className="mt-2 text-[11px] text-muted-foreground">
          {summary.exceeding} above · {summary.meeting} on target
        </p>
      </Card>

      <Card label="Below the target" icon={<TrendingDown className="h-[18px] w-[18px]" aria-hidden="true" />} tone="red" value={summary.below} note={percentOf(summary.below)}>
        <ShareBar part={summary.below} total={total} color={RED} />
        <p className="mt-2 cursor-help text-[11px] text-muted-foreground" title={namesText || undefined}>{waitingText || 'Every KPI has a result'}</p>
      </Card>

      <Card
        label="Office score"
        icon={<Gauge className="h-[18px] w-[18px]" aria-hidden="true" />}
        tone="neutral"
        value={percent === null ? '-' : percentText(percent)}
        note={percent === null ? 'No approved results yet' : `${score.isProvisional ? 'Provisional' : 'Final'}${score.reportingPeriod ? (score.reportingPeriod.isYearEnd ? ', whole year' : `, as of ${score.reportingPeriod.name}`) : ''}`}
      >
        <ShareBar part={percent ?? 0} total={100} color={scoreColor(percent)} />
        <div className="mt-2 flex items-center justify-between gap-2">
          {band ? <BandLabel band={{ ...band, color: scoreColor(percent) }} /> : <span className="text-[11px] text-muted-foreground">Waiting for a result</span>}
          {score && score.totalWeight > 0 && score.reportedWeight < score.totalWeight && (
            <span className="text-[11px] text-muted-foreground">
              {score.reportedWeight} of {score.totalWeight} weight
            </span>
          )}
        </div>
      </Card>
    </div>
  );
};

export default OfficeCards;
