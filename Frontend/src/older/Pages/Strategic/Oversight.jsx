import { Building2 } from 'lucide-react';
import { Card, CardContent } from '../../Components/UI/Card';
import { Progress } from '../../Components/UI/progress';

const institutions = [
  { name: 'Institute of Technology', score: 82, kpis: 45, status: 'On Track' },
  { name: 'College of Natural Sciences', score: 76, kpis: 38, status: 'On Track' },
  { name: 'College of Social Sciences', score: 69, kpis: 32, status: 'Needs Attention' },
  { name: 'College of Medicine', score: 88, kpis: 41, status: 'Excellent' },
  { name: 'College of Agriculture', score: 71, kpis: 29, status: 'On Track' },
];

const Oversight = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Institution Overview</h1>
        <p className="text-sm text-muted-foreground">Monitor performance across all institutions</p>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {institutions.map((inst) => (
          <Card key={inst.name} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-5">
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-primary" />
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{inst.name}</p>

                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      inst.status === 'Excellent'
                        ? 'bg-emerald-100 text-emerald-700'
                        : inst.status === 'Needs Attention'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-accent text-primary'
                    }`}
                  >
                    {inst.status}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <Progress value={inst.score} className="h-2 flex-1" />
                  <span className="text-sm font-medium text-foreground w-12 text-right">{inst.score}%</span>
                </div>

                <p className="text-xs text-muted-foreground">{inst.kpis} Active KPIs</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Oversight;
