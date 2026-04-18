import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { month: 'Jan', value: 25 },
  { month: 'Feb', value: 35 },
  { month: 'Mar', value: 30 },
  { month: 'Apr', value: 50 },
  { month: 'May', value: 55 },
  { month: 'Jun', value: 70 },
  { month: 'Jul', value: 85 },
];

const statusData = [
  { label: 'Completed', value: 85, color: 'hsl(213, 94%, 52%)' },
  { label: 'Pending', value: 60, color: 'hsl(213, 94%, 68%)' },
  { label: 'Overdue', value: 25, color: 'hsl(213, 94%, 80%)' },
  { label: 'Draft', value: 15, color: 'hsl(213, 94%, 88%)' },
];

const KpiChart = () => {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <h3 className="text-base font-bold text-foreground mb-1">KPI Performance Trend</h3>
      <div className="mt-4 flex min-w-0 gap-8">
        {/* Chart */}
        <div className="h-64 min-h-64 min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(215, 14%, 50%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(215, 14%, 50%)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(0, 0%, 100%)',
                  border: '1px solid hsl(214, 20%, 90%)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(213, 94%, 52%)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: 'hsl(213, 94%, 52%)' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status bars */}
        <div className="w-48 space-y-3 flex flex-col justify-center">
          {statusData.map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <div className="h-5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KpiChart;
