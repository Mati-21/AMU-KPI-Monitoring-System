import { Card, CardContent, CardHeader, CardTitle } from '../../UI/Card';
import { Progress } from '../../UI/progress';

const PerformersAndGaps = ({ topPerformers, achievementGap }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Performers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.isArray(topPerformers) && topPerformers.length > 0 ? (
            topPerformers.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                  }`}
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
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No top performers data available</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Target vs Achievement Gap</CardTitle>
          <p className="text-[10px] text-muted-foreground">Comparison between set benchmarks and realized outcomes</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.isArray(achievementGap) && achievementGap.length > 0 ? (
            <>
              {achievementGap.map((g) => (
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
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No achievement gap data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformersAndGaps;
