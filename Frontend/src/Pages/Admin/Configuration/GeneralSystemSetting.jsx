import { Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { useState, useRef } from 'react';
import { Input } from '../../../Components/UI/Input';
import { Label } from '../../../Components/UI/Label';
import { Switch } from '../../../Components/UI/Switch';
import { api, BASE_URL } from '../../../api/axios';
import { useNotification } from '../../../Context/NotificationContext';
import { getFileUrl } from '../../../lib/utils';

function GeneralSystemSetting({ maintenanceMode, settings, setSettings, setMaintenanceMode, systemOnline, setSystemOnline }) {
  const { notify } = useNotification();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      notify('Please upload an image file', 'error');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      notify('Logo must be less than 2MB', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    setUploadingLogo(true);
    try {
      const response = await api.post('/settings/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setSettings((prev) => ({
          ...prev,
          system_logo: response.data.logoPath,
        }));
        notify('Logo uploaded successfully', 'success');
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      notify('Failed to upload logo', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const logoUrl = getFileUrl(settings.system_logo);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 ">
      {/* General System Settings */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-lg font-semibold text-foreground">General System Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">System Display Name</Label>
              <Input
                placeholder="AMU KPI Monitoring System"
                value={settings.displayName || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    displayName: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Organization Name</Label>
              <Input 
                placeholder="ArbaMinch University" 
                value={settings.orgName || ''} 
                onChange={(e) => setSettings({ ...settings, orgName: e.target.value })} 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date Format Preference</Label>
              <Input
                placeholder="MM/DD/YYYY"
                value={settings.dateFormat || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dateFormat: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">System Version</Label>
              <Input value={settings.systemVersion || 'v1.0.0'} readOnly className="bg-muted/50" />
            </div>
          </div>
        </div>

        {/* Upload Logo */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Upload Logo</h2>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleLogoUpload} 
            className="hidden" 
            accept="image/*"
          />
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors cursor-pointer group relative overflow-hidden"
          >
            {uploadingLogo ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : logoUrl ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-48 h-24 relative rounded-lg border border-border bg-white flex items-center justify-center p-2 shadow-inner">
                  <img src={logoUrl} alt="System Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-sm text-primary font-semibold group-hover:underline">Click to change logo</p>
                  <p className="text-xs text-muted-foreground">SVG, PNG, JPG (MAX. 2MB)</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-sm text-muted-foreground font-medium group-hover:text-foreground transition-colors">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">SVG, PNG, JPG, GIF (MAX. 800×400px, 2MB)</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* System Accessibility */}
      <div className="space-y-4">
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">System Accessibility</span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">All user actions will be disabled.</p>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">System Online</p>
                <p className="text-xs text-muted-foreground">The Portal is fully accessible.</p>
              </div>
              <Switch checked={systemOnline} onCheckedChange={setSystemOnline} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GeneralSystemSetting;
