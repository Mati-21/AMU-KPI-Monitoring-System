import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { MONTHS, toEthiopian } from '../../../../shared/lib/ethiopianDate';
import { useSystemUsage } from '../../hooks/useDashboards';

// The system dashboard's own colours: blue for people, purple for logins, green and slate for online and offline
const BLUE = '#3b82f6';
const PURPLE = '#8b5cf6';
const GREEN = '#22c55e';
const SLATE = '#64748b';
const AXIS_TICK = { fill: 'var(--color-muted-foreground)', fontSize: 11 };

const RANGES = [
  { value: 'today', label: 'Today', span: 'today, hour by hour' },
  { value: '7d', label: '7 days', span: 'over the last 7 days' },
  { value: '30d', label: '30 days', span: 'over the last 30 days' },
];

/**
 * What a slot is called on the axis: an hour today, a weekday over a week, an Ethiopian date over a month.
 */
const slotLabel = (slot, range) => {
  if (slot.hour !== undefined) return `${String(slot.hour).padStart(2, '0')}:00`;
  if (range === '7d') return slot.weekday;
  const date = toEthiopian(slot.date);
  return date ? `${MONTHS[date.month - 1].slice(0, 3)} ${date.day}` : slot.date;
};

const Card = ({ title, description, action, children }) => (
  <section aria-label={title} className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
    <h3 className="text-base font-bold text-foreground">{title}</h3>
    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    {action && <div className="mt-3">{action}</div>}
    <div className="mt-4 flex-1">{children}</div>
  </section>
);

/**
 * A value axis in four even steps of 1, 2 or 5 times a power of ten, so the ticks read cleanly: 0 2 4 6 8.
 */
const evenTicks = (max) => {
  const raw = Math.max(1, Math.ceil(max / 4));
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= raw);
  return [0, step, step * 2, step * 3, step * 4];
};

const RangeTabs = ({ value, onChange, label }) => (
  <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5" role="tablist" aria-label={label}>
    {RANGES.map((range) => (
      <button
        key={range.value}
        type="button"
        role="tab"
        aria-selected={range.value === value}
        onClick={() => onChange(range.value)}
        className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${range.value === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
      >
        {range.label}
      </button>
    ))}
  </div>
);

const SlotTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold">{label}</p>
      <p>
        {value} {value === 1 ? unit : `${unit}s`}
      </p>
    </div>
  );
};

/**
 * One usage measure over a chosen range, as a line (people) or a filled area (logins). The range is chosen on the
 * card itself; today shows each hour, so the busy hours stand out.
 */
const UsageChart = ({ title, field, unit, describe, kind, color }) => {
  const [range, setRange] = useState('today');
  const { data, isLoading, error } = useSystemUsage(range);
  const span = RANGES.find((item) => item.value === range).span;
  const points = (data?.slots ?? []).map((slot) => ({ label: slotLabel(slot, range), value: slot[field] }));
  // Thirty labels do not fit; every few are shown
  const interval = range === '30d' ? 4 : range === 'today' ? 2 : 0;
  const ticks = evenTicks(Math.max(0, ...points.map((point) => point.value)));

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--color-border)" strokeWidth={1} />
      <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={interval} />
      <YAxis allowDecimals={false} domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
      <Tooltip content={<SlotTooltip unit={unit} />} cursor={{ stroke: 'var(--color-border)' }} />
    </>
  );

  return (
    <Card title={title} description={`${describe}, ${span}`} action={<RangeTabs value={range} onChange={setRange} label={`${title} range`} />}>
      <div className="h-48" aria-hidden="true">
        {error ? (
          <p className="text-xs text-muted-foreground">Could not load this chart.</p>
        ) : isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {kind === 'area' ? (
              <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`${field}Fill`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                {axes}
                <Area type="linear" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${field}Fill)`} isAnimationActive={false} />
              </AreaChart>
            ) : (
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                {axes}
                <Line type="linear" dataKey="value" stroke={color} strokeWidth={2} dot={range === '30d' ? false : { r: 4, fill: color, stroke: 'var(--color-card)', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      {/* A caption is drawn outside its table's box, so the whole table sits in a hidden wrapper */}
      <div className="sr-only">
        <table>
          <caption>{`${title}, ${span}`}</caption>
          <tbody>
            {points.map((point) => (
              <tr key={point.label}>
                <th scope="row">{point.label}</th>
                <td>{point.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

/**
 * Active accounts online now against the rest.
 */
const StatusCard = ({ status }) => {
  const total = status.online + status.offline;
  const split = [
    { label: 'Online', value: status.online, color: GREEN },
    { label: 'Offline', value: status.offline, color: SLATE },
  ];
  return (
    <Card title="User Status" description="Active accounts with the app open right now. Updates live.">
      <div className="flex items-center gap-6">
        <div className="h-32 w-32 shrink-0" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={split} dataKey="value" nameKey="label" innerRadius={34} outerRadius={52} paddingAngle={status.online > 0 ? 4 : 0} stroke="var(--color-card)" strokeWidth={2} isAnimationActive={false}>
                {split.map((part) => (
                  <Cell key={part.label} fill={part.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-3">
          {split.map((part) => (
            <div key={part.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: part.color }} aria-hidden="true" />
                  {part.label}
                </span>
                <span className="text-xs font-bold text-foreground">{part.value}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${total > 0 ? (part.value / total) * 100 : 0}%`, backgroundColor: part.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

/**
 * How the system is used: people logging in, logins, and who is online now.
 */
const UsageCharts = ({ status }) => (
  <div className="grid gap-6 lg:grid-cols-3">
    <UsageChart title="Active Users Trend" field="activeUsers" unit="person" describe="People who logged in" kind="line" color={BLUE} />
    <UsageChart title="Login Activity" field="logins" unit="login" describe="Successful logins" kind="area" color={PURPLE} />
    <StatusCard status={status} />
  </div>
);

export default UsageCharts;
