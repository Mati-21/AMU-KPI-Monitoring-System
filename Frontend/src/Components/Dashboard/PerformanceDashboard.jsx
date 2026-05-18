import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../UI/Card';
import { Progress } from '../UI/progress';
import { Badge } from '../UI/Badge';
import CustomSelect from '../UI/CustomSelect';
import Button from '../UI/Button';
import { FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { exportElementToPdf } from '../../lib/exportPdf';
import { useNotification } from '../../Context/NotificationContext';

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

const ringMap = {
  primary: 'ring-primary text-primary',
  green: 'ring-emerald-500 text-emerald-600',
  blue: 'ring-blue-500 text-blue-600',
  red: 'ring-red-500 text-red-600',
  amber: 'ring-amber-500 text-amber-600',
  purple: 'ring-purple-500 text-purple-600',
  indigo: 'ring-indigo-500 text-indigo-600',
};

const ringBorderMap = {
  primary: 'border-primary',
  green: 'border-emerald-500',
  blue: 'border-blue-500',
  red: 'border-red-500',
  amber: 'border-amber-500',
  purple: 'border-purple-500',
  indigo: 'border-indigo-500',
};

const progressBgMap = {
  primary: 'bg-primary',
  green: 'bg-emerald-500',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  indigo: 'bg-indigo-500',
};

const MiniDonut = ({ achieved, inProgress, delayed }) => {
  const total = achieved + inProgress + delayed;
  const pct = total ? Math.round((achieved / total) * 100) : 0;
  const data = [
    { value: achieved, color: 'hsl(142 71% 45%)' },
    { value: inProgress, color: 'hsl(45 93% 47%)' },
    { value: delayed, color: 'hsl(0 84% 60%)' },
  ];

  return (
    <div className="relative w-16 h-16 ">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={20} outerRadius={30} strokeWidth={0}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{pct}%</span>
    </div>
  );
};

const heatColor = (v) => {
  if (v >= 25) return 'bg-emerald-100 text-emerald-800'; // Very Good (Green)
  if (v >= 20) return 'bg-yellow-100 text-yellow-800'; // Good (Yellow)
  if (v >= 15) return 'bg-amber-100 text-amber-800'; // Enough (Amber)
  if (v >= 10) return 'bg-orange-100 text-orange-800'; // Needs Improvement (Orange)
  return 'bg-red-100 text-red-800'; // Critical (Red)
};

const PerformanceDashboard = ({
  config,
  derivedKpiId = '__ALL__',
  onDerivedKpiChange,
  focusedRoleId = '__ALL__',
  onRoleChange,
  selectedCycleYear,
  onYearChange,
}) => {
  const [quarter, setQuarter] = useState('All Quarters');
  const comparisonTitlePrefix = config.comparisonTitlePrefix || config.subUnitLabel || 'Sub Unit';
  const dashboardRef = useRef(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const { notify } = useNotification();

  const yearlyTrendData = config.kpiTrends && config.kpiTrends.length ? config.kpiTrends : config.yearlyTrend || [];

  const inferredSeriesKeys =
    yearlyTrendData && yearlyTrendData.length ? Object.keys(yearlyTrendData[0]).filter((k) => !['year', 'score', 'anySubmitted'].includes(k)) : [];

  const seriesKeys = config.kpiNames && config.kpiNames.length ? config.kpiNames : inferredSeriesKeys;

  const getStatusColor = (value, isSubmitted) => {
    if (!isSubmitted) return '#e2e8f0'; // Gray for unsubmitted
    if (value >= 25) return '#10b981'; // Emerald-500 (Very Good)
    if (value >= 20) return '#eab308'; // Yellow-500 (Good)
    if (value >= 15) return '#f59e0b'; // Amber-500 (Enough)
    if (value >= 10) return '#f97316'; // Orange-500 (Needs Improvement)
    return '#ef4444'; // Red-500 (Critical)
  };

  return (
    <div ref={dashboardRef} className="space-y-6 overflow-y-scroll p-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        </div>

        <div className="w-full">
          <div className="flex items-center justify-end w-full">
            <div className="flex flex-wrap items-center justify-end gap-2 w-full pb-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs shrink-0"
                disabled={isExportingPdf}
                onClick={async () => {
                  if (!dashboardRef.current || isExportingPdf) return;
                  setIsExportingPdf(true);
                  try {
                    await exportElementToPdf({
                      element: dashboardRef.current,
                      filename: config?.title || 'dashboard',
                    });
                    notify('Print dialog opened. Choose "Save as PDF" to download.', 'success');
                  } catch (e) {
                    console.error('PDF export failed', e);
                    notify(e?.message || 'PDF export failed. Please allow popups/print dialog and try again.', 'error');
                  } finally {
                    setIsExportingPdf(false);
                  }
                }}
              >
                <FileText className="w-3.5 h-3.5" /> {isExportingPdf ? 'Generating...' : 'PDF'}
              </Button>

              {Array.isArray(config.childRoleOptions) && config.childRoleOptions.length > 0 && typeof onRoleChange === 'function' ? (
                <div className="w-56 text-xs shrink-0">
                  <CustomSelect
                    options={[{ label: `All ${config.subUnitLabel || 'Units'}`, value: '__ALL__' }, ...config.childRoleOptions]}
                    value={focusedRoleId}
                    onChange={onRoleChange}
                    placeholder={`Select ${config.subUnitLabel || 'Unit'}`}
                  />
                </div>
              ) : (
                Array.isArray(config.derivedKpiOptions) &&
                config.derivedKpiOptions.length > 0 &&
                typeof onDerivedKpiChange === 'function' && (
                  <div className="w-56 text-xs shrink-0">
                    <CustomSelect
                      options={[{ label: 'Total Performance (All KPIs)', value: '__ALL__' }, ...config.derivedKpiOptions]}
                      value={derivedKpiId}
                      onChange={onDerivedKpiChange}
                      placeholder="Total Performance (All KPIs)"
                    />
                  </div>
                )
              )}

              <div className="w-40 text-xs shrink-0">
                <CustomSelect options={config.yearOptions || []} value={selectedCycleYear || ''} onChange={onYearChange} placeholder="Select year" />
              </div>

              <div className="w-40 text-xs shrink-0">
                <CustomSelect options={['All Quarters', 'Q1', 'Q2', 'Q3', 'Q4']} value={quarter} onChange={setQuarter} placeholder="All Quarters" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base">Overall Performance Overview</CardTitle>
              <p className="text-xs text-muted-foreground max-w-2xl">
                A clean snapshot of the dashboard’s most important KPIs, shown with a ring-style metric display.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {config.stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm transition hover:border-primary/80 hover:shadow-md"
              >
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{s.label}</p>

                <div className="mt-3 flex items-center justify-center">
                  <div className="relative h-20 w-20">
                    <div className={`absolute inset-0 rounded-full border-4 ${ringBorderMap[s.color] || 'border-primary'} border-opacity-20`} />
                    <div className="absolute inset-2 rounded-full bg-card shadow-inner" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-2xl font-bold text-foreground">{s.value}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {s.subtitle && <p className="mt-3 text-center text-sm text-muted-foreground">{s.subtitle}</p>}

                {s.progress !== undefined && (
                  <div className="mt-5">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`${progressBgMap[s.color] || 'bg-primary'} h-full`} style={{ width: `${s.progress}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Progress</span>
                      <span>{s.progress}%</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-base font-semibold mb-3">Performance Comparison</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {config.subUnits.map((u) => (
            <Card
              key={u.name}
              className={`border-t-4 ${u.color === 'primary' ? 'border-t-primary' : u.color === 'green' ? 'border-t-emerald-500' : u.color === 'red' ? 'border-t-red-500' : u.color === 'blue' ? 'border-t-blue-500' : u.color === 'purple' ? 'border-t-purple-500' : 'border-t-amber-500'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground truncate" title={u.name}>
                      {u.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Performance Health Check</p>
                  </div>
                  <div className="shrink-0">
                    <MiniDonut achieved={u.achieved} inProgress={u.inProgress} delayed={u.delayed} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total KPIs</p>
                    <p className="text-xl font-bold text-foreground">{u.totalKpis}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trend</p>
                    <Badge variant={u.trend === 'Improving' ? 'default' : u.trend === 'Stable' ? 'secondary' : 'destructive'} className="text-[10px]">
                      {u.trend}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {u.achieved} Achieved
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {u.inProgress} In Progress
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {u.delayed} Delayed
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quarterly Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={config.isDistributable === false ? config.quarterlyComparison || [] : config.quarterlyData || []} barGap={2}>
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
                      {config.quarterlyData.map((entry, index) => (
                        <Cell key={`cell-q1-${index}`} fill={getStatusColor(entry.q1, entry.q1Submitted)} />
                      ))}
                    </Bar>
                    <Bar dataKey="q2" name="Quarter 2" radius={[3, 3, 0, 0]}>
                      {config.quarterlyData.map((entry, index) => (
                        <Cell key={`cell-q2-${index}`} fill={getStatusColor(entry.q2, entry.q2Submitted)} />
                      ))}
                    </Bar>
                    <Bar dataKey="q3" name="Quarter 3" radius={[3, 3, 0, 0]}>
                      {config.quarterlyData.map((entry, index) => (
                        <Cell key={`cell-q3-${index}`} fill={getStatusColor(entry.q3, entry.q3Submitted)} />
                      ))}
                    </Bar>
                    <Bar dataKey="q4" name="Quarter 4" radius={[3, 3, 0, 0]}>
                      {config.quarterlyData.map((entry, index) => (
                        <Cell key={`cell-q4-${index}`} fill={getStatusColor(entry.q4, entry.q4Submitted)} />
                      ))}
                    </Bar>
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Yearly Performance Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
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
                  // Fallback to average series when KPI-specific series are not present
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
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">KPI Status Distribution</CardTitle>
            <p className="text-[10px] text-muted-foreground">Overall aggregate status of all strategic objectives</p>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="w-[160px] h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={config.statusDistribution} dataKey="value" innerRadius={40} outerRadius={70} strokeWidth={0}>
                    {config.statusDistribution.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-xs">
              {config.statusDistribution.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-foreground">{d.name}</span>
                  <span className="font-bold text-foreground ml-auto">{d.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quarterly Performance Heatmap</CardTitle>
            <p className="text-[10px] text-muted-foreground">Achievement rates across organizational pillars</p>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">Pillar</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Q1</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Q2</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Q3</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Q4</th>
                </tr>
              </thead>
              <tbody>
                {config.heatmap.map((h) => (
                  <tr key={h.pillar} className="border-b border-border/50">
                    <td className="py-2 font-medium text-foreground">{h.pillar}</td>
                    {[h.q1, h.q2, h.q3, h.q4].map((v, i) => (
                      <td key={i} className="text-center py-2">
                        <span className={`inline-block px-3 py-1 rounded-md font-semibold ${heatColor(v)}`}>{v}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground justify-center">
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded bg-emerald-100" />
                Very Good (25+)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded bg-yellow-100" />
                Good (20-25)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded bg-amber-100" />
                Enough (15-20)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded bg-orange-100" />
                Needs Improvement (10-15)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded bg-red-100" />
                Critical (&lt;10)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Performers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.topPerformers.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.unit}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{p.score}%</p>
                  <Progress value={p.score} className="h-1 w-16" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Target vs Achievement Gap</CardTitle>
            <p className="text-[10px] text-muted-foreground">Comparison between set benchmarks and realized outcomes</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.achievementGap.map((g) => (
              <div key={g.name} className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">{g.name}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 bg-primary/20 rounded-full" style={{ width: `${g.target}%` }} />
                    <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${g.actual}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{g.actual}%</span>
                </div>
              </div>
            ))}
            <div className="flex gap-4 text-[10px] text-muted-foreground justify-center pt-1">
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded bg-primary/20" />
                Target Benchmark
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded bg-primary" />
                Actual Performance
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-[10px] text-muted-foreground border-t border-border pt-4 space-y-1">
        <p>© 2024 University Strategic Performance Management System</p>
        <div className="flex justify-center gap-4">
          <span>Data Integrity Policy</span>
          <span>Methodology</span>
          <span>Contact Strategy Office</span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
