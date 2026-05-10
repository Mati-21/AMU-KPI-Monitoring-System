import { useState } from "react";

import GeneralSystemSetting from "./GeneralSystemSetting";
import KpiSystemConfiguration from "./KpiSystemConfiguration";
import GradingScale from "./GradingScale";
import PageTitle from "./PageTitle";
import CycleManagement from "./CycleManagement";
import Footer from "./Footer";





const defaultTiers = [
  { id: "1", label: "Excellent", color: "#22c55e", min: 90, max: 100 },
  { id: "2", label: "Good", color: "#3b82f6", min: 90, max: 100 },
  { id: "3", label: "Average", color: "#eab308", min: 90, max: 100 },
  { id: "4", label: "Poor", color: "#ef4444", min: 90, max: 100 },
];

const Configuration = () => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [systemOnline, setSystemOnline] = useState(true);
  const [tiers, setTiers] = useState(defaultTiers);

  const [settings, setSettings] = useState({
    displayName: "",
    orgName: "",
    dateFormat: "MM/DD/YYYY",
    systemVersion: "v1.0.0 (Stable Build)",
    kpiWeightValidation: "Strict (100% Cumulative)",
    maxKpisPerUser: "",
    evidenceFileSize: "",
    periodFrequency: "",
    kpiDeadline: "14-12-54",
  });

  return (
    <div className="flex  bg-background overflow-y-auto">
      <div className="flex-1 flex flex-col ">
        <main className="flex-1 p-6 overflow-y-auto ">
          <div className=" space-y-8 animate-fade-in">
            {/* Page Title */}
            <PageTitle />

            {/* Cycle Management (Root Role Only) */}
            <CycleManagement />

            {/* General System Setting */}
            <GeneralSystemSetting
              maintenanceMode={maintenanceMode}
              setMaintenanceMode={setMaintenanceMode}
              systemOnline={systemOnline}
              setSystemOnline={setSystemOnline}
              settings={settings}
              setSettings={setSettings}
            />

            {/* KPI System Configuration */}
            <KpiSystemConfiguration
              setSettings={setSettings}
              settings={settings}
            />

            {/* Grading Scale & Deadlines */}
            <GradingScale
              setTiers={setTiers}
              tiers={tiers}
              setSettings={setSettings}
              settings={settings}
            />

            {/* Footer */}
            <Footer />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Configuration;
