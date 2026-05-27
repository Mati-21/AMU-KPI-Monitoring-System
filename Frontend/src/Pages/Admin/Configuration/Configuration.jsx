import { useState, useEffect } from "react";
import { api } from "../../../api/axios";
import GeneralSystemSetting from "./GeneralSystemSetting";
import KpiSystemConfiguration from "./KpiSystemConfiguration";
import PageTitle from "./PageTitle";
import CycleManagement from "./CycleManagement";
import Footer from "./Footer";
import { Save, Loader2 } from "lucide-react";
import { useDispatch } from "react-redux";
import { logout, setMaintenance, setSystemSettings } from "../../../Features/authSlice";
import { useNotification } from "../../../Context/NotificationContext";

const Configuration = () => {
  const dispatch = useDispatch();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [systemOnline, setSystemOnline] = useState(true);

  const [settings, setSettings] = useState({
    displayName: "AMU KPI Monitoring System",
    orgName: "ArbaMinch University",
    dateFormat: "MM/DD/YYYY",
    systemVersion: "v1.0.0 (Stable Build)",
    kpiWeightValidation: "Strict (100% Cumulative)",
    maxKpisPerUser: "10",
    evidenceFileSize: "5MB",
    periodFrequency: "Quarterly",
    kpiDeadline: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      if (response.data.success) {
        const data = response.data.data;
        setMaintenanceMode(data.maintenance_mode || false);
        setSystemOnline(data.system_online !== false);
        // Strip boolean toggle keys so they don't leak into the generic settings object
        const { maintenance_mode, system_online, ...rest } = data;
        setSettings(prev => ({
          ...prev,
          ...rest
        }));
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter out keys that are managed by dedicated state variables
      const excludeKeys = new Set(['maintenance_mode', 'system_online', 'system_logo']);
      const settingsToSave = [
        { key: 'maintenance_mode', value: maintenanceMode, type: 'boolean' },
        { key: 'system_online', value: systemOnline, type: 'boolean' },
        ...Object.entries(settings)
          .filter(([key]) => !excludeKeys.has(key))
          .map(([key, value]) => ({ key, value, type: 'string' }))
      ];

      await api.post('/settings', settingsToSave);
      
      // Update global state immediately
      dispatch(setMaintenance(maintenanceMode));
      dispatch(setSystemSettings({
        displayName: settings.displayName,
        orgName: settings.orgName,
        systemLogo: settings.system_logo || settings.systemLogo || null,
      }));
      
      notify("Configuration saved successfully!", "success");
    } catch (error) {
      console.error("Failed to save settings:", error);
      notify("Error saving settings. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex bg-background overflow-y-auto">
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
              <PageTitle />
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? "Saving..." : "Save Configuration"}</span>
              </button>
            </div>

            <CycleManagement />

            <GeneralSystemSetting
              maintenanceMode={maintenanceMode}
              setMaintenanceMode={setMaintenanceMode}
              systemOnline={systemOnline}
              setSystemOnline={setSystemOnline}
              settings={settings}
              setSettings={setSettings}
            />

            <KpiSystemConfiguration
              setSettings={setSettings}
              settings={settings}
            />

            <Footer />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Configuration;
