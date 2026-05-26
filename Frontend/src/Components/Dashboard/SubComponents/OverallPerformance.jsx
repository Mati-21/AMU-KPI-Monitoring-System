import { Card, CardContent, CardHeader, CardTitle } from '../../UI/Card';

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

const OverallPerformance = ({ stats }) => {
  if (!Array.isArray(stats) || stats.length === 0) return null;

  return (
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
          {stats.map((s) => (
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
  );
};

export default OverallPerformance;
