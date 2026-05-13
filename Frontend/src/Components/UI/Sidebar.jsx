import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  Users,
  UserCog,
  Shield,
  Settings,
  Bell,
  GraduationCap,
  ChevronRight,
  MessageSquare,
} from "lucide-react";

// Navigation Data
const navGroups = [
  {
    title: "System Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, active: true, path: "/dashboard" },
      { label: "Contact Messages", icon: MessageSquare, path: "/contact-messages" }
    ],
  },
  {
    title: "KPI Management",
    items: [{ label: "KPI", icon: Target, path: "/kpi" }],
  },
  {
    title: "User & Access Management",
    items: [
      { label: "Role Management", icon: Shield, path: "/role-management" },
      { label: "User Management", icon: Users, path: "/user-management" },
      { label: "Permission", icon: UserCog, path: "/permission" },
    ],
  },
  {
    title: "System Configuration",
    items: [
      { label: "Configuration", icon: Settings, path: "/configuration" },
      { label: "Alert and Notification", icon: Bell, path: "/alert-notification" },
      { label: "System Logs", icon: GraduationCap, path: "/system-logs" }
    ],
  },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeItem = navGroups.flatMap(g => g.items).find(i => i.path === location.pathname)?.label || "Dashboard";

  return (
    <div className="w-72 h-screen bg-[var(--sidebar-background)] border-r border-[var(--sidebar-border)] flex flex-col shrink-0 overflow-y-auto">
      {/* Logo */}
      <div className="p-6 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--sidebar-foreground)] leading-tight">
              ArbaMinch University
            </h2>
            <p className="text-xs text-[var(--sidebar-muted)]">AMU KPI SYSTEM</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sidebar-muted)] px-3 mb-2">
              {group.title}
            </p>
 
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = activeItem === item.label;

                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                      ${
                        isActive
                          ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] shadow-md shadow-black/20"
                          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] active:scale-[0.98]"
                      }`}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon
                        className={`w-4 h-4 ${
                          isActive
                            ? "text-[var(--sidebar-primary-foreground)]"
                            : "text-[var(--sidebar-foreground)] group-hover:text-[var(--sidebar-accent-foreground)]"
                        }`}
                      />
                      {item.label}
                    </span>

                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-opacity ${
                        isActive
                          ? "opacity-80"
                          : "opacity-0 group-hover:opacity-40"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
