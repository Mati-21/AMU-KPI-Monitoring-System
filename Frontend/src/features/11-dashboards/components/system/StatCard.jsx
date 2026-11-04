import { Plus } from 'lucide-react';

/**
 * One system count, with a shortcut to add another where there is one.
 */
const StatCard = ({ icon, label, value, addLabel, onAdd }) => {
  const Icon = icon;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
          <Icon className="h-6 w-6 text-blue-500 dark:text-blue-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-600 dark:bg-green-950/50 dark:text-green-400">
          Overall
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            title={addLabel}
            aria-label={addLabel}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

export default StatCard;
