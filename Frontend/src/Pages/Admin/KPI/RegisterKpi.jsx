import { useEffect, useMemo, useState } from 'react';

import { Input } from '../../../Components/UI/Input';
import CustomSelect from '../../../Components/UI/CustomSelect';
import Button from '../../../Components/UI/Button';
import { api } from '../../../api/axios';
import { useNotification } from '../../../Context/NotificationContext';

const NO_THEME_OPTION = 'Select Theme';
const NO_SUB_THEME_OPTION = 'Select Sub-Theme';

const parseNumericInput = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/,/g, '').replace(/%/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

function RegisterKpi({ setActiveTab, onSaved }) {
  const [kpiForm, setKpiForm] = useState({
    kpiName: '',
    themeId: '',
    subThemeId: '',
    unit: '',
    weight: '',
    baseline: '',
    target: '',
    description: '',
    remark: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kpiTypes, setKpiTypes] = useState([]);
  const [units, setUnits] = useState([]);
  const { notify } = useNotification();

  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      setLoading(true);
      setError('');

      try {
        const [typesRes, unitsRes] = await Promise.all([api.get('/kpi-types'), api.get('/units')]);
        if (!mounted) return;
        setKpiTypes(typesRes.data?.data || []);
        setUnits(unitsRes.data?.data || []);
      } catch (loadErr) {
        if (!mounted) return;
        setError(loadErr?.response?.data?.message || 'Failed to load themes and units from database.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const typeById = useMemo(() => new Map(kpiTypes.map((type) => [type.Id, type])), [kpiTypes]);

  const rootThemes = useMemo(() => kpiTypes.filter((type) => !type.ParentKPIID), [kpiTypes]);

  const subThemeOptions = useMemo(() => kpiTypes.filter((type) => type.ParentKPIID === kpiForm.themeId), [kpiTypes, kpiForm.themeId]);

  const unitOptions = useMemo(() => units.map((unit) => `${unit.Name} (${unit.Code})`), [units]);

  const getThemePath = (themeId) => typeById.get(themeId)?.KPIName || '';

  const getSubThemePath = (subThemeId) => {
    const subTheme = typeById.get(subThemeId);
    if (!subTheme) return '';
    const theme = subTheme.ParentKPIID ? typeById.get(subTheme.ParentKPIID) : null;
    return theme ? `${theme.KPIName} / ${subTheme.KPIName}` : subTheme.KPIName;
  };

  const handleSave = async () => {
    setError('');

    if (!kpiForm.kpiName.trim() || !kpiForm.themeId || !kpiForm.subThemeId || !kpiForm.unit || !kpiForm.weight || !kpiForm.target) {
      setError('KPI name, theme, sub-theme, unit, weight, and target are required.');
      return;
    }

    const parsedWeight = parseNumericInput(kpiForm.weight);
    const parsedBaseline = parseNumericInput(kpiForm.baseline);
    const parsedTarget = parseNumericInput(kpiForm.target);

    if (parsedWeight === null || parsedTarget === null) {
      setError('Weight and target must be valid numbers (for example: 25 or 90.6).');
      return;
    }

    if (parsedWeight < 0 || parsedWeight > 100) {
      setError('Weight must be between 0 and 100.');
      return;
    }

    setSaving(true);

    try {
      const unit = units.find((item) => `${item.Name} (${item.Code})` === kpiForm.unit);
      const subThemeType = typeById.get(kpiForm.subThemeId);
      if (!unit?.Id) {
        setError('Please select a valid KPI unit.');
        return;
      }

      if (!subThemeType?.Id) {
        setError('Please select a valid sub-theme.');
        return;
      }

      const trimmedKpiName = kpiForm.kpiName.trim();
      const existingType = kpiTypes.find(
        (type) => type.ParentKPIID === subThemeType.Id && normalizeName(type.KPIName) === normalizeName(trimmedKpiName)
      );

      let kpiTypeId = existingType?.Id;

      if (!kpiTypeId) {
        try {
          const createdTypeRes = await api.post('/kpi-types', {
            KPIName: trimmedKpiName,
            ParentKPIID: subThemeType.Id,
            Description: kpiForm.description?.trim() || null,
          });
          kpiTypeId = createdTypeRes.data?.data?.Id;
        } catch (typeErr) {
          if (typeErr?.response?.status !== 409) {
            throw typeErr;
          }

          const typeRes = await api.get('/kpi-types');
          const latestTypes = typeRes.data?.data || [];
          setKpiTypes(latestTypes);
          const duplicateType = latestTypes.find(
            (type) => type.ParentKPIID === subThemeType.Id && normalizeName(type.KPIName) === normalizeName(trimmedKpiName)
          );

          if (!duplicateType?.Id) {
            throw typeErr;
          }

          kpiTypeId = duplicateType.Id;
        }
      }

      if (!kpiTypeId) {
        setError('Unable to resolve KPI category. Please try again.');
        return;
      }

      await api.post('/kpis', {
        KPITypeId: kpiTypeId,
        UnitId: unit.Id,
        Weight: parsedWeight,
        Baseline: parsedBaseline,
        Target: parsedTarget,
        Description: kpiForm.description?.trim() || null,
        Remark: kpiForm.remark?.trim() || null,
        IsEvedenceRequired: false,
      });

      notify(`KPI "${kpiForm.kpiName}" saved successfully.`, 'success');
      onSaved?.();
      setKpiForm({
        kpiName: '',
        themeId: '',
        subThemeId: '',
        unit: '',
        weight: '',
        baseline: '',
        target: '',
        description: '',
        remark: '',
      });
      setActiveTab('list');
    } catch (saveErr) {
      const message = saveErr?.response?.data?.message || 'Failed to save KPI.';
      setError(message);
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-8 max-w-2xl">
        <h2 className="text-xl font-semibold text-foreground mb-6">Add KPI</h2>

        {error ? <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            placeholder="KPI Name"
            value={kpiForm.kpiName}
            onChange={(e) => setKpiForm({ ...kpiForm, kpiName: e.target.value })}
            className="h-11"
          />

          <CustomSelect
            placeholder={loading ? 'Loading themes...' : NO_THEME_OPTION}
            value={kpiForm.themeId ? getThemePath(kpiForm.themeId) : ''}
            onChange={(value) => {
              const selectedTheme = rootThemes.find((theme) => theme.KPIName === value);
              setKpiForm({ ...kpiForm, themeId: selectedTheme?.Id || '', subThemeId: '' });
            }}
            options={rootThemes.map((theme) => theme.KPIName)}
          />

          <CustomSelect
            placeholder={loading ? 'Loading sub-themes...' : NO_SUB_THEME_OPTION}
            value={kpiForm.subThemeId ? getSubThemePath(kpiForm.subThemeId) : ''}
            onChange={(value) => {
              const selectedSubTheme = subThemeOptions.find((subTheme) => subTheme.KPIName === value);
              setKpiForm({ ...kpiForm, subThemeId: selectedSubTheme?.Id || '' });
            }}
            options={subThemeOptions.map((subTheme) => subTheme.KPIName)}
          />

          <CustomSelect
            placeholder={loading ? 'Loading units...' : 'KPI Unit'}
            value={kpiForm.unit}
            onChange={(value) => setKpiForm({ ...kpiForm, unit: value })}
            options={unitOptions}
          />

          <Input placeholder="Weight" value={kpiForm.weight} onChange={(e) => setKpiForm({ ...kpiForm, weight: e.target.value })} className="h-11" />
          <Input
            placeholder="Baseline"
            value={kpiForm.baseline}
            onChange={(e) => setKpiForm({ ...kpiForm, baseline: e.target.value })}
            className="h-11"
          />
          <Input placeholder="Target" value={kpiForm.target} onChange={(e) => setKpiForm({ ...kpiForm, target: e.target.value })} className="h-11" />
          <Input
            placeholder="Enter Description"
            value={kpiForm.description}
            onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
            className="h-11 md:col-span-2"
          />
          <Input
            placeholder="Remark"
            value={kpiForm.remark}
            onChange={(e) => setKpiForm({ ...kpiForm, remark: e.target.value })}
            className="h-11 md:col-span-2"
          />
        </div>

        <div className="flex gap-3 pt-6">
          <Button onClick={handleSave} disabled={saving || loading} className="bg-primary hover:bg-primary/90">
            {saving ? 'Saving...' : 'Save'}
          </Button>

          <Button
            onClick={() => {
              setKpiForm({
                kpiName: '',
                themeId: '',
                subThemeId: '',
                unit: '',
                weight: '',
                baseline: '',
                target: '',
                description: '',
                remark: '',
              });
              setActiveTab('list');
            }}
            className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
          >
            Cancel
          </Button>
        </div>
      </div>
    </section>
  );
}

export default RegisterKpi;
