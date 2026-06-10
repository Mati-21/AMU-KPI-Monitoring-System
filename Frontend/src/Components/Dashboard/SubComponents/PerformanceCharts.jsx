import { Card, CardContent, CardHeader, CardTitle } from '../../UI/Card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts';

const COLORS_CHART = [
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-destructive)',
  'var(--sidebar-primary)',
  '#2563eb', // blue
  '#16a34a', // green
  '#d97706', // amber
  '#9333ea', // purple
  '#e11d48', // rose
  '#0891b2', // cyan
  '#4f46e5', // indigo
];

const getStatusColor = (value, isSubmitted) => {
  if (!isSubmitted) return '#e2e8f0'; // Gray for unsubmitted
  if (value >= 25) return '#10b981'; // Emerald-500 (Very Good)
  if (value >= 20) return '#eab308'; // Yellow-500 (Good)
  if (value >= 15) return '#f59e0b'; // Amber-500 (Enough)
  if (value >= 10) return '#f97316'; // Orange-500 (Needs Improvement)
  return '#ef4444'; // Red-500 (Critical)
};

const PerformanceCharts = ({ config }) => {
  if (!config) return null;

  const yearlyTrendData = config.kpiTrends && config.kpiTrends.length ? config.kpiTrends : config.yearlyTrend || [];

  const inferredSeriesKeys =
    yearlyTrendData && yearlyTrendData.length
      ? Object.keys(yearlyTrendData[0]).filter((k) => !['year', 'score', 'anySubmitted'].includes(k))
      : [];

  const seriesKeys = config.kpiNames && config.kpiNames.length ? config.kpiNames : inferredSeriesKeys;

  const barData = config.isDistributable === false
    ? config.quarterlyComparison || []
    : config.quarterlyData || [];

  const hasBarData = barData.length > 0;
  const hasTrendData = yearlyTrendData.length > 0 && (seriesKeys.length > 0 || yearlyTrendData.some((d) => d.score !== undefined));

  const NoDataPlaceholder = ({ label }) => (
    <div className="h-[260px] flex items-center justify-center text-center">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">Submit KPI results to see data here</p>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Quarterly Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          {hasBarData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 30]} tickFormatter={(v) => `${v}`} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(value) => [`${Number(value).toFixed(1)} Points`, undefined]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />

                {config.isDistributable === false ? (
                  <Bar dataKey="score" name="Average Performance" radius={[3, 3, 0, 0]}>
                    {(config.quarterlyComparison || []).map((entry, index) => (
                      <Cell key={`cell-score-${index}`} fill={getStatusColor(entry.score, entry.submitted)} />
                    ))}
                  </Bar>
                ) : (
                  <>
                    <Bar dataKey="q1" name="Quarter 1" radius={[3, 3, 0, 0]}>
                      {(config.quarterlyData || []).map((entry, index) => (
                        <Cell key={`cell-q1-${index}`} fill={getStatusColor(entry.q1, entry.q1Submitted)} />
                      ))}
                    </Bar>
                    <Bar dataKey="q2" name="Quarter 2" radius={[3, 3, 0, 0]}>
                      {(config.quarterlyData || []).map((entry, index) => (
                        <Cell key={`cell-q2-${index}`} fill={getStatusColor(entry.q2, entry.q2Submitted)} />
                      ))}
                    </Bar>
                    <Bar dataKey="q3" name="Quarter 3" radius={[3, 3, 0, 0]}>
                      {(config.quarterlyData || []).map((entry, index) => (
                        <Cell key={`cell-q3-${index}`} fill={getStatusColor(entry.q3, entry.q3Submitted)} />
                      ))}
                    </Bar>
                    <Bar dataKey="q4" name="Quarter 4" radius={[3, 3, 0, 0]}>
                      {(config.quarterlyData || []).map((entry, index) => (
                        <Cell key={`cell-q4-${index}`} fill={getStatusColor(entry.q4, entry.q4Submitted)} />
                      ))}
                    </Bar>
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoDataPlaceholder label="No quarterly performance data yet" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Yearly Performance Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          {hasTrendData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis
                  domain={[0, (dataMax) => Math.max(100, Math.ceil((Number(dataMax) || 0) / 10) * 10)]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(value) => [`${Number(value).toFixed(1)}%`, undefined]} />
                {seriesKeys.length > 0 && <Legend iconSize={10} wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />}
                {seriesKeys.length > 0 ? (
                  seriesKeys.map((name, i) => (
                    <Line
                      key={name}
                      type="linear"
                      dataKey={name}
                      stroke={COLORS_CHART[i % COLORS_CHART.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      connectNulls
                    />
                  ))
                ) : (
                  <Line
                    type="linear"
                    dataKey="score"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <NoDataPlaceholder label="No yearly trend data yet" />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceCharts;
