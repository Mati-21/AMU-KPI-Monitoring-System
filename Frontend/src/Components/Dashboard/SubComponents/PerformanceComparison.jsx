import { Card, CardContent } from '../../UI/Card';
import { Badge } from '../../UI/Badge';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

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

const PerformanceComparison = ({ subUnits }) => {
  if (!Array.isArray(subUnits) || subUnits.length === 0) return null;

  return (
    <div>
      <h2 className="text-base font-semibold mb-3">Performance Comparison</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {subUnits.map((u) => (
          <Card
            key={u.name}
            className={`border-t-4 ${
              u.color === 'primary'
                ? 'border-t-primary'
                : u.color === 'green'
                ? 'border-t-emerald-500'
                : u.color === 'red'
                ? 'border-t-red-500'
                : u.color === 'blue'
                ? 'border-t-blue-500'
                : u.color === 'purple'
                ? 'border-t-purple-500'
                : 'border-t-amber-500'
            }`}
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
  );
};

export default PerformanceComparison;
