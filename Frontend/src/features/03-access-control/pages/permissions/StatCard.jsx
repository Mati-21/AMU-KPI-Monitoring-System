function StatCard({ totalRoles = 0, systemModules = 0, activePermissions = 0, restrictedPermissions = 0 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[
        { label: 'Total Roles', value: String(totalRoles), color: 'bg-primary/10 text-primary' },
        { label: 'System Modules', value: String(systemModules), color: 'bg-accent text-accent-foreground' },
        { label: 'Active Permissions', value: String(activePermissions), color: 'bg-primary/10 text-primary' },
        { label: 'Restricted', value: String(restrictedPermissions), color: 'bg-destructive/10 text-destructive' },
      ].map((stat) => (
        <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <p className={`text-2xl font-bold mt-1 ${stat.color.split(' ')[1]}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

export default StatCard;

