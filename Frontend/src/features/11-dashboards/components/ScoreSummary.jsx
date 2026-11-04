import { OUTCOMES, TILE_KEYS, bandFor, percentText } from '../lib/dashboardRules';
import BandLabel from './BandLabel';

/**
 * The headline: the official score with its band, and how many KPIs stand where. The score counts approved results
 * only; until the whole year is approved it is provisional.
 */
const ScoreSummary = ({ score, summary, bands, scoreLabel = 'Score' }) => {
  const percent = score?.officialScore ?? null;
  const band = bandFor(percent, bands);
  // Above, on and below target always show; the rest only when something is in them
  const tiles = TILE_KEYS.filter(([key], index) => index < 3 || summary[key] > 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1.3fr)_repeat(auto-fit,minmax(7.5rem,1fr))]">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">{scoreLabel}</p>
        {percent === null ? (
          <>
            <p className="mt-1 text-3xl font-semibold text-muted-foreground">-</p>
            <p className="mt-1 text-xs text-muted-foreground">No approved results yet</p>
          </>
        ) : (
          <>
            <p className="mt-1 text-5xl font-semibold tracking-tight text-foreground">{percentText(percent)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <BandLabel band={band} />
              <span className="text-xs text-muted-foreground">
                {score.isProvisional ? 'Provisional' : 'Final'}
                {score.reportingPeriod ? (score.reportingPeriod.isYearEnd ? ', for the whole year' : `, as of ${score.reportingPeriod.name}`) : ''}
              </span>
            </div>
            {score.totalWeight > 0 && score.reportedWeight < score.totalWeight && (
              <p className="mt-1 text-xs text-muted-foreground">
                Covers {score.reportedWeight} of {score.totalWeight} weight
              </p>
            )}
          </>
        )}
      </div>

      {tiles.map(([key, outcome]) => (
        <div key={key} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{OUTCOMES[outcome].tile}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{summary[key]}</p>
          <p className="text-xs text-muted-foreground">of {summary.total} KPIs</p>
        </div>
      ))}
    </div>
  );
};

export default ScoreSummary;
