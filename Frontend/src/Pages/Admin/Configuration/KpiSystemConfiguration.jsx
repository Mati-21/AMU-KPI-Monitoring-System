import { Label } from "../../../Components/UI/Label";
import { Settings2, FileText, Users, BarChart3 } from "lucide-react";

const SELECT_CLASS =
  "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer";

function KpiSystemConfiguration({ settings, setSettings }) {
  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Settings2 className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">KPI System Configuration</h2>
          <p className="text-xs text-muted-foreground">Governance &amp; constraints for KPI management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">

        {/* KPI Weight Validation */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <BarChart3 className="w-3.5 h-3.5" />
            KPI Weight Validation
          </Label>
          <select
            className={SELECT_CLASS}
            value={settings.kpiWeightValidation || "Strict (100% Cumulative)"}
            onChange={(e) => update("kpiWeightValidation", e.target.value)}
          >
            <option value="Strict (100% Cumulative)">Strict — Total must equal 100%</option>
            <option value="Loose">Loose — No total requirement</option>
          </select>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Controls whether KPI weights assigned to a user must sum to exactly 100%.
          </p>
        </div>

        {/* Max KPIs per User */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            Max KPIs per User
          </Label>
          <select
            className={SELECT_CLASS}
            value={settings.maxKpisPerUser || "10"}
            onChange={(e) => update("maxKpisPerUser", e.target.value)}
          >
            {[5, 6, 7, 8, 10, 12, 15, 20].map((n) => (
              <option key={n} value={String(n)}>
                {n} KPIs
              </option>
            ))}
            <option value="Unlimited">Unlimited</option>
          </select>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Recommended: 5–8 KPIs per user for optimal focus and accountability.
          </p>
        </div>

        {/* Evidence File Size Limit */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            Evidence File Size Limit
          </Label>
          <select
            className={SELECT_CLASS}
            value={settings.evidenceFileSize || "5MB"}
            onChange={(e) => update("evidenceFileSize", e.target.value)}
          >
            {["2MB", "5MB", "10MB", "15MB", "20MB"].map((s) => (
              <option key={s} value={s}>
                {s} per file
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Maximum size for each KPI supporting document upload.
          </p>
        </div>

        {/* Reporting Period Frequency */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Settings2 className="w-3.5 h-3.5" />
            Reporting Period Frequency
          </Label>
          <select
            className={SELECT_CLASS}
            value={settings.periodFrequency || "Quarterly"}
            onChange={(e) => update("periodFrequency", e.target.value)}
          >
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Semi-Annual">Semi-Annual</option>
            <option value="Annual">Annual</option>
          </select>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Determines the cadence of KPI result submissions and reporting cycles.
          </p>
        </div>

      </div>
    </div>
  );
}

export default KpiSystemConfiguration;
