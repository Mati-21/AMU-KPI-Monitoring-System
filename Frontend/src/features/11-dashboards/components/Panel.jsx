/**
 * A titled card that holds one part of the dashboard.
 */
const Panel = ({ title, description, action, className = '', children }) => (
  <section aria-label={title} className={`flex flex-col rounded-lg border border-border bg-card ${className}`}>
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
    <div className="flex-1 p-4">{children}</div>
  </section>
);

export const Empty = ({ children }) => <p className="text-sm text-muted-foreground">{children}</p>;

export default Panel;
