import { useEffect, useMemo, useState } from 'react';

import { Input } from '../../../Components/UI/Input';
import CustomSelect from '../../../Components/UI/CustomSelect';
import Button from '../../../Components/UI/Button';
import { api } from '../../../api/axios';
import { useNotification } from '../../../Context/NotificationContext';

const SELECT_THEME_OPTION = 'Select Parent Theme';

function RegisterCategory({ setActiveTab, onSaved }) {
  const [themeForm, setThemeForm] = useState({
    name: '',
    description: '',
  });
  const [subThemeForm, setSubThemeForm] = useState({
    name: '',
    description: '',
    parentTheme: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kpiTypes, setKpiTypes] = useState([]);
  const { notify } = useNotification();

  useEffect(() => {
    let mounted = true;

    const loadKpiTypes = async () => {
      setLoading(true);
      try {
        const response = await api.get('/kpi-types', { params: { t: Date.now() } });
        if (!mounted) return;
        setKpiTypes(response.data?.data || []);
      } catch (loadErr) {
        if (!mounted) return;
        setError(loadErr?.response?.data?.message || 'Failed to load themes from database.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadKpiTypes();
    return () => {
      mounted = false;
    };
  }, []);

  const themeOptions = useMemo(() => kpiTypes.filter((type) => !type.ParentKPIID), [kpiTypes]);
  const parentOptions = useMemo(() => [SELECT_THEME_OPTION, ...themeOptions.map((type) => type.KPIName)], [themeOptions]);

  const saveTheme = async () => {
    setError('');

    if (!themeForm.name.trim()) {
      setError('Theme name is required.');
      return;
    }

    setSaving(true);

    try {
      await api.post('/kpi-types', {
        KPIName: themeForm.name.trim(),
        ParentKPIID: null,
        Description: themeForm.description?.trim() || null,
      });

      notify(`Theme "${themeForm.name}" saved successfully.`, 'success');
      onSaved?.();
      setThemeForm({ name: '', description: '' });

      const refreshed = await api.get('/kpi-types', { params: { t: Date.now() } });
      setKpiTypes(refreshed.data?.data || []);
    } catch (saveErr) {
      const message = saveErr?.response?.data?.message || 'Failed to save theme.';
      setError(message);
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveSubTheme = async () => {
    setError('');

    if (!subThemeForm.name.trim()) {
      setError('Sub-theme name is required.');
      return;
    }

    if (!subThemeForm.parentTheme) {
      setError('Parent theme is required for sub-theme.');
      return;
    }

    const parentMatch = themeOptions.find((type) => type.KPIName === subThemeForm.parentTheme);
    if (!parentMatch?.Id) {
      setError('Please select a valid parent theme.');
      return;
    }

    setSaving(true);

    try {
      await api.post('/kpi-types', {
        KPIName: subThemeForm.name.trim(),
        ParentKPIID: parentMatch.Id,
        Description: subThemeForm.description?.trim() || null,
      });

      notify(`Sub-theme "${subThemeForm.name}" saved successfully.`, 'success');
      onSaved?.();
      setSubThemeForm({ name: '', description: '', parentTheme: '' });

      const refreshed = await api.get('/kpi-types', { params: { t: Date.now() } });
      setKpiTypes(refreshed.data?.data || []);
    } catch (saveErr) {
      const message = saveErr?.response?.data?.message || 'Failed to save sub-theme.';
      setError(message);
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-card border border-border rounded-xl p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">Create Theme</h2>

          <div className="space-y-4">
            <Input
              placeholder="Theme Name"
              value={themeForm.name}
              onChange={(e) => setThemeForm({ ...themeForm, name: e.target.value })}
              className="h-11"
            />

            <Input
              placeholder="Enter Description"
              value={themeForm.description}
              onChange={(e) => setThemeForm({ ...themeForm, description: e.target.value })}
              className="h-11"
            />

            <div className="flex gap-3 pt-2">
              <Button onClick={saveTheme} disabled={saving || loading} className="bg-primary hover:bg-primary/90">
                {saving ? 'Saving...' : 'Save Theme'}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">Create Sub-Theme</h2>

          <div className="space-y-4">
            <Input
              placeholder="Sub-Theme Name"
              value={subThemeForm.name}
              onChange={(e) => setSubThemeForm({ ...subThemeForm, name: e.target.value })}
              className="h-11"
            />

            <Input
              placeholder="Enter Description"
              value={subThemeForm.description}
              onChange={(e) => setSubThemeForm({ ...subThemeForm, description: e.target.value })}
              className="h-11"
            />

            <CustomSelect
              options={parentOptions}
              value={subThemeForm.parentTheme || SELECT_THEME_OPTION}
              placeholder={loading ? 'Loading themes...' : 'Parent Theme'}
              onChange={(value) =>
                setSubThemeForm({
                  ...subThemeForm,
                  parentTheme: value === SELECT_THEME_OPTION ? '' : value,
                })
              }
            />

            <div className="flex gap-3 pt-2">
              <Button onClick={saveSubTheme} disabled={saving || loading} className="bg-primary hover:bg-primary/90">
                {saving ? 'Saving...' : 'Save Sub-Theme'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setActiveTab('list')}
          className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
        >
          Back to List
        </Button>
      </div>
    </section>
  );
}

export default RegisterCategory;
