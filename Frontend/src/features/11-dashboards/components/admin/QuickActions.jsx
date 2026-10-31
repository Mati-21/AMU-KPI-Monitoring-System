import { Users, BarChart3, Palette, Shield, FolderTree } from "lucide-react";
import { useNavigate } from "react-router-dom";

const modules = [
  { icon: Users, label: "Total Users", desc: "Manage profiles & permissions", route: "/user-management", tab: "add" },
  { icon: BarChart3, label: "KPIs", desc: "Set and track objectives", route: "/kpi", tab: "addKpi" },
  { icon: Palette, label: "Themes", desc: "Manage Themes", route: "/kpi", tab: "addKpiCategory" },
  { icon: Shield, label: "Roles", desc: "Security & role restrictions", route: "/role-management", tab: "addRole" },
  { icon: FolderTree, label: "Categories", desc: "Organize functional groups", route: "/role-management", tab: "addCategory" },
];

const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
      <h3 className="text-base font-bold text-foreground mb-1">Module Quick Actions</h3>
      <p className="text-sm text-muted-foreground mb-4">Manage organizational modules instantly</p>
      <div className="grid grid-cols-5 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.label}
              className="bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-stat-icon flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground">{mod.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigate(mod.route)}
                  className="flex-1 text-[11px] px-3 py-1 rounded-md bg-success/10 text-success hover:bg-success hover:text-success-foreground transition-colors font-medium"
                >
                  Open List
                </button>
                <button
                  onClick={() => navigate(`${mod.route}?tab=${mod.tab}`)}
                  className="text-[11px] w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors font-bold"
                  title={`Add ${mod.label}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActions;
