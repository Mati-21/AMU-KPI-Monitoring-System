import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { apiErrorMessage } from '../../../../../shared/lib/apiError';
import { useInView } from '../../../../../shared/hooks/useInView';
import { GREEN } from '../../../lib/monitoringFormat';

/**
 * The small pieces every monitoring section is built from, so the sections read as the same page.
 */

const AXIS_TICK = { fill: 'var(--color-muted-foreground)', fontSize: 11 };

export const Panel = ({ title, description, action, className = '', children }) => (
  <section aria-label={title} className={`flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
    <div className="mt-4 flex-1">{children}</div>
  </section>
);

/**
 * A figure with its name, and a line under it for the context that makes it readable.
 */
export const Stat = ({ label, value, hint, color }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-xl font-bold text-foreground" style={color ? { color } : undefined}>
      {value}
    </p>
    {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

/**
 * A bar that fills with a figure. The colour comes from the caller, so one meter can mean "full is bad" or not.
 */
export const Meter = ({ value, color = GREEN, label }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
  </div>
);

export const Notice = ({ children }) => <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">{children}</p>;

export const DataState = ({ isLoading, error, data, children }) => {
  if (error && !data) return <p className="text-sm text-red-600 dark:text-red-400">{apiErrorMessage(error, 'Could not load this section.')}</p>;
  if (!data || isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  return children;
};

export const RangeTabs = ({ ranges, value, onChange, label }) => (
  <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5" role="tablist" aria-label={label}>
    {ranges.map((range) => (
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

export const Table = ({ columns, rows, empty, rowKey }) =>
  rows.length === 0 ? (
    <Notice>{empty}</Notice>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {columns.map((column) => (
              <th key={column.header} className={`py-2 pr-3 font-medium ${column.align === 'right' ? 'text-right' : ''}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column) => (
                <td key={column.header} className={`py-2 pr-3 align-top text-foreground ${column.align === 'right' ? 'text-right tabular-nums' : ''} ${column.className ?? ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

const ChartTooltip = ({ active, payload, label, series, format }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold">{label}</p>
      {payload.map((entry) => {
        const definition = series.find((item) => item.key === entry.dataKey);
        return (
          <p key={entry.dataKey} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: definition?.color }} aria-hidden="true" />
            {definition?.label}: {format ? format(entry.value) : entry.value}
          </p>
        );
      })}
    </div>
  );
};

/**
 * One or more measures over time. Reads from a list of points, each with the label shown under it.
 * kind: line (default), area, or bar. max pins the top of the scale (100 for a percentage).
 */
export const TrendChart = ({ data, series, kind = 'line', max, format, height = 180 }) => {
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--color-border)" />
      <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={32} />
      <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={38} domain={max ? [0, max] : [0, 'auto']} allowDecimals={false} tickFormatter={format} />
      <Tooltip content={<ChartTooltip series={series} format={format} />} cursor={{ stroke: 'var(--color-border)' }} />
    </>
  );
  const Chart = kind === 'area' ? AreaChart : kind === 'bar' ? BarChart : LineChart;

  return (
    <>
      <div style={{ height }} aria-hidden="true">
        {data.length < 2 && kind !== 'bar' ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Collecting data...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              {axes}
              {series.map((item) =>
                kind === 'area' ? (
                  <Area key={item.key} type="monotone" dataKey={item.key} stroke={item.color} fill={item.color} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                ) : kind === 'bar' ? (
                  <Bar key={item.key} dataKey={item.key} fill={item.color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                ) : (
                  <Line key={item.key} type="monotone" dataKey={item.key} stroke={item.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                )
              )}
            </Chart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {series.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
      {/* The numbers behind the picture, for anyone who cannot see it */}
      <table className="sr-only">
        <caption>{series.map((item) => item.label).join(', ')}</caption>
        <tbody>
          {data.slice(-24).map((point, index) => (
            <tr key={`${point.label}-${index}`}>
              <th scope="row">{point.label}</th>
              {series.map((item) => (
                <td key={item.key}>{point[item.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

/**
 * A section of the page. It starts loading when it is first scrolled to and refreshes only while it is on screen;
 * `view` is handed to the section's data hooks.
 */
export const LazySection = ({ id, title, children }) => {
  const { ref, inView, seen } = useInView();
  return (
    <section id={id} ref={ref} aria-label={title} className="scroll-mt-16 space-y-4" style={seen ? undefined : { minHeight: 240 }}>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {seen ? children({ enabled: true, live: inView }) : <p className="text-sm text-muted-foreground">Loads when you scroll here.</p>}
    </section>
  );
};
