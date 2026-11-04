import CompareBars from '../components/CompareBars';
import KpiBars from '../components/KpiBars';
import ScoreSummary from '../components/ScoreSummary';
import ScoreTrend from '../components/ScoreTrend';

/**
 * The whole university: the top office's contract, whose KPIs gather every office's approved results, then every
 * office compared within its level. Offices of different levels are never ranked against each other.
 */
const UniversityView = ({ dashboard, onSelectOffice }) => (
  <div className="space-y-5">
    <div>
      <h2 className="text-lg font-semibold text-foreground">The whole university</h2>
      <p className="text-sm text-muted-foreground">{dashboard.office.name}&apos;s contract, made up from every office&apos;s approved results.</p>
    </div>

    <ScoreSummary score={dashboard.score} summary={dashboard.summary} bands={dashboard.bands} scoreLabel="University score" />

    <div className="grid gap-5 lg:grid-cols-2">
      <ScoreTrend trend={dashboard.trend} bands={dashboard.bands} />
      <KpiBars kpis={dashboard.kpis} />
    </div>

    {dashboard.byOfficeType.map((group) => (
      <CompareBars
        key={group.officeType.id}
        title={`${group.officeType.name} offices`}
        description="Best score first, within this level. Open one to see its dashboard."
        rows={group.offices.map((row) => ({ key: row.office.id, id: row.office.id, name: row.office.name, score: row.score, latestState: row.latestReport?.state }))}
        bands={dashboard.bands}
        emptyText="No offices at this level."
        onSelect={(row) => onSelectOffice(row.id)}
      />
    ))}
  </div>
);

export default UniversityView;
