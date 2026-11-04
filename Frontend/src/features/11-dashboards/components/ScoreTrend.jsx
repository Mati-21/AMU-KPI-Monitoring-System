import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { bandFor, defaultFrequencyId, percentText, trendByFrequency } from '../lib/dashboardRules';
import BandLabel from './BandLabel';
import Panel, { Empty } from './Panel';

const AXIS_TICK = { fill: 'var(--color-muted-foreground)', fontSize: 12 };

const TrendTooltip = ({ active, payload, bands }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold">{point.name}</p>
      <p className="mt-0.5 text-sm font-semibold">{percentText(point.score)}</p>
      <BandLabel band={bandFor(point.score, bands)} className="mt-1" />
      <p className="mt-1 text-muted-foreground">{point.state === 'APPROVED' ? (point.isProvisional ? 'Approved, provisional' : 'Approved') : 'Not approved yet'}</p>
    </div>
  );
};

/**
 * The score after each period of one reporting frequency. A period's score covers only the KPIs reported in it, so
 * frequencies are shown one at a time, never mixed on one line.
 */
const ScoreTrend = ({ trend, bands, title = 'Score through the year' }) => {
  const groups = trendByFrequency(trend);
  const [chosen, setChosen] = useState(null);
  const group = groups.find((item) => item.frequency.id === chosen) ?? groups.find((item) => item.frequency.id === defaultFrequencyId(groups));
  const data = (group?.points ?? []).map((point) => ({ name: point.reportingPeriod.name, score: point.officialScore, state: point.state, isProvisional: point.isProvisional }));
  const top = Math.max(100, ...data.map((point) => point.score ?? 0));

  const tabs =
    groups.length > 1 ? (
      <div className="flex gap-1" role="tablist" aria-label="Reporting frequency">
        {groups.map((item) => (
          <button
            key={item.frequency.id}
            type="button"
            role="tab"
            aria-selected={item.frequency.id === group?.frequency.id}
            onClick={() => setChosen(item.frequency.id)}
            className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${item.frequency.id === group?.frequency.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            {item.frequency.name}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <Panel title={title} description={group ? `${group.frequency.name} periods. Each covers the KPIs reported in it; counts that add up through the year rise towards the year end.` : undefined} action={tabs}>
      {!group ? (
        <Empty>The trend appears once two periods of the same kind have a score.</Empty>
      ) : (
        <>
          <div className="h-56" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeWidth={1} />
                <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                <YAxis domain={[0, top]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<TrendTooltip bands={bands} />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
                <Line
                  type="linear"
                  dataKey="score"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={{ r: 4, fill: 'var(--color-primary)', stroke: 'var(--color-card)', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: 'var(--color-primary)', stroke: 'var(--color-card)', strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>{`${group.frequency.name} scores`}</caption>
            <tbody>
              {data.map((point) => (
                <tr key={point.name}>
                  <th scope="row">{point.name}</th>
                  <td>{percentText(point.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
};

export default ScoreTrend;
