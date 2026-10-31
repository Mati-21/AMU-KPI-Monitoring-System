import React, { useState } from 'react';

const ActivityLog = ({ 
  title = 'Recent System Activity', 
  actionLabel = 'Download Log', 
  actionVariant = 'outline', 
  activities = [], 
  onViewAll,
  initialCount = 5,
  allowExpand = false
}) => {
  const [visibleCount, setVisibleCount] = useState(initialCount);

  // Sync visibleCount with initialCount when the prop changes (e.g., after data loads)
  React.useEffect(() => {
    setVisibleCount(initialCount);
  }, [initialCount]);

  const displayActivities = Array.isArray(activities) ? activities.slice(0, visibleCount) : [];

  const handleShowMore = () => {
    setVisibleCount(prev => prev + 3);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">Real-time log of administrative changes</p>
        </div>
        <div className="flex gap-2">
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-sm px-4 py-2 rounded-lg font-medium border border-border text-foreground hover:bg-muted transition-colors"
            >
              View Detail
            </button>
          )}
          <button
            className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
              actionVariant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'border border-border text-foreground hover:bg-muted'
            }`}
          >
            {actionLabel}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {displayActivities.length > 0 ? (
          <table className="w-full text-sm bg-transparent text-card-foreground">
            <thead>
              <tr className="bg-secondary/50 text-left">
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin User</th>
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Performed</th>
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayActivities.map((a, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/50 transition-colors">
                  <td className="py-2.5 px-4">
                    <div>
                      <p className="font-medium text-foreground text-xs">{a.user}</p>
                      <p className="text-[11px] text-muted-foreground">{a.action}</p>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground">{a.description}</td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground">{a.time}</td>
                  <td className="py-2.5 px-4">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-xs font-medium text-muted-foreground">
            No activity logs recorded yet
          </div>
        )}

        {allowExpand && activities.length > 0 && (
          <div className="border-t border-border bg-muted/20">
            {visibleCount < activities.length ? (
              <button
                onClick={handleShowMore}
                className="w-full py-3 text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-2"
              >
                Show More
              </button>
            ) : (
              <div className="py-3 flex justify-center border-t border-border bg-muted/10">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  End of available logs
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
