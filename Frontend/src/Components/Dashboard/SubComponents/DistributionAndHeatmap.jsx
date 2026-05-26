import { Card, CardContent, CardHeader, CardTitle } from '../../UI/Card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const heatColor = (v) => {
  if (v >= 25) return 'bg-emerald-100 text-emerald-800'; // Very Good (Green)
  if (v >= 20) return 'bg-yellow-100 text-yellow-800'; // Good (Yellow)
  if (v >= 15) return 'bg-amber-100 text-amber-800'; // Enough (Amber)
  if (v >= 10) return 'bg-orange-100 text-orange-800'; // Needs Improvement (Orange)
  return 'bg-red-100 text-red-800'; // Critical (Red)
};

const DistributionAndHeatmap = ({ statusDistribution, heatmap }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">KPI Status Distribution</CardTitle>
          <p className="text-[10px] text-muted-foreground">Overall aggregate status of all strategic objectives</p>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          {Array.isArray(statusDistribution) && statusDistribution.length > 0 ? (
            <>
              <div className="w-[160px] h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" innerRadius={40} outerRadius={70} strokeWidth={0}>
                      {statusDistribution.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 text-xs flex-1">
                {statusDistribution.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-foreground">{d.name}</span>
                    <span className="font-bold text-foreground ml-auto">{d.value}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No status distribution data available</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Quarterly Performance Heatmap</CardTitle>
          <p className="text-[10px] text-muted-foreground">Achievement rates across organizational pillars</p>
        </CardHeader>
        <CardContent>
          {Array.isArray(heatmap) && heatmap.length > 0 ? (
            <>
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
                  {heatmap.map((h) => (
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
              <div className="flex flex-wrap gap-4 mt-3 text-[10px] text-muted-foreground justify-center">
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
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No heatmap data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DistributionAndHeatmap;
