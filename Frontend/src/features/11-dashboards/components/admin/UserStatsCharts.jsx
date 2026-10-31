import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const UserStatsCharts = ({ activeUsersData = [], loginActivityData = [], statusData = [] }) => {
  const chartData = Array.isArray(activeUsersData) ? activeUsersData : [];
  const distribution = Array.isArray(statusData) ? statusData : [];
  const loginTrendData = Array.isArray(loginActivityData) ? loginActivityData : [];

  const totalStatusValue = distribution.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
      {/* Active Users Chart */}
      <div className="lg:col-span-1 bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground mb-1">Active Users Trend</h3>
          <p className="text-xs text-muted-foreground mb-6">Daily active users over the last 7 days</p>
        </div>
        <div className="h-48 min-h-48 flex items-center justify-center">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(215, 14%, 50%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 14%, 50%)' }} axisLine={false} tickLine={false} hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="value" stroke="hsl(213, 94%, 52%)" strokeWidth={3} dot={{ r: 4, fill: 'hsl(213, 94%, 52%)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-xs font-medium">
              No active user trend recorded yet
            </div>
          )}
        </div>
      </div>

      {/* User Login Activity */}
      <div className="lg:col-span-1 bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground mb-1">Login Activity</h3>
          <p className="text-xs text-muted-foreground mb-6">User engagement and peak usage times</p>
        </div>
        <div className="h-48 min-h-48 flex items-center justify-center">
          {loginTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={loginTrendData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(215, 14%, 50%)' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(262, 83%, 58%)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-xs font-medium">
              No login activity recorded yet
            </div>
          )}
        </div>
      </div>

      {/* Online vs Offline */}
      <div className="lg:col-span-1 bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col">
        <h3 className="text-base font-bold text-foreground mb-1">User Status</h3>
        <p className="text-xs text-muted-foreground mb-6">Real-time platform availability</p>
        <div className="flex-1 flex items-center justify-between">
          {distribution.length > 0 ? (
            <>
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution}
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3 pl-6">
                {distribution.map((s) => (
                  <div key={s.label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                      <span className="text-xs font-bold text-foreground">{s.value}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${totalStatusValue > 0 ? (s.value / totalStatusValue) * 100 : 0}%`,
                          backgroundColor: s.color 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="w-full text-center py-8 text-muted-foreground text-xs font-medium">
              No status distribution available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserStatsCharts;
