import { useEffect, useMemo, useState } from 'react';
import { Edit, Trash2, Eye, Target } from 'lucide-react';

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '../../../Components/UI/Table';
import { Input } from '../../../Components/UI/Input';
import SearchInput from '../../../Components/UI/SearchInput';
import Button from '../../../Components/UI/Button';
import Checkbox from '../../../Components/UI/Checkbox';
import { Badge } from '../../../Components/UI/Badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../Components/UI/dialog';
import { api } from '../../../api/axios';
import { useNotification } from '../../../Context/NotificationContext';

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric.toString();
};

const emptyEditKpi = {
  id: '',
  kpiTypeId: '',
  kpiName: '',
  themeId: '',
  subThemeId: '',
  unitId: '',
  weight: '',
  baseline: '',
  target: '',
  remark: '',
  description: '',
  isEvidenceRequired: false,
};

const emptyEditTheme = {
  id: '',
  name: '',
  description: '',
};

const emptyEditSubTheme = {
  id: '',
  name: '',
  description: '',
  themeId: '',
};

const emptyEditUnit = {
  id: '',
  name: '',
  code: '',
  description: '',
};

function KpiList({ refreshKey }) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [kpis, setKpis] = useState([]);
  const [kpiTypes, setKpiTypes] = useState([]);
  const [units, setUnits] = useState([]);
  const [saving, setSaving] = useState(false);

  const [editingKpi, setEditingKpi] = useState(false);
  const [editingTheme, setEditingTheme] = useState(false);
  const [editingSubTheme, setEditingSubTheme] = useState(false);
  const [editingUnit, setEditingUnit] = useState(false);

  const [deletingKpi, setDeletingKpi] = useState(null);
  const [deletingTheme, setDeletingTheme] = useState(null);
  const [deletingSubTheme, setDeletingSubTheme] = useState(null);
  const [deletingUnit, setDeletingUnit] = useState(null);
  const [viewingKpi, setViewingKpi] = useState(null);

  const [editKpiForm, setEditKpiForm] = useState(emptyEditKpi);
  const [editThemeForm, setEditThemeForm] = useState(emptyEditTheme);
  const [editSubThemeForm, setEditSubThemeForm] = useState(emptyEditSubTheme);
  const [editUnitForm, setEditUnitForm] = useState(emptyEditUnit);

  const itemsPerPage = 10;
  const { notify } = useNotification();

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [kpiRes, typeRes, unitRes] = await Promise.all([
        api.get('/kpis', { params: { t: Date.now() } }),
        api.get('/kpi-types'),
        api.get('/units'),
      ]);
      setKpis(kpiRes.data?.data || []);
      setKpiTypes(typeRes.data?.data || []);
      setUnits(unitRes.data?.data || []);
    } catch (loadErr) {
      setError(loadErr?.response?.data?.message || 'Failed to load KPI data from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const typeById = useMemo(() => new Map(kpiTypes.map((type) => [type.Id, type])), [kpiTypes]);
  const childrenByParent = useMemo(() => {
    const map = new Map();
    kpiTypes.forEach((type) => {
      const key = type.ParentKPIID || '__root__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(type);
    });

    map.forEach((items, key) => {
      items.sort((a, b) => {
        const leftTime = new Date(a.CreatedAt || 0).getTime();
        const rightTime = new Date(b.CreatedAt || 0).getTime();
        if (leftTime !== rightTime) return leftTime - rightTime;
        return String(a.Id || '').localeCompare(String(b.Id || ''));
      });
      map.set(key, items);
    });

    return map;
  }, [kpiTypes]);

  const kpiTypeIdSet = useMemo(() => new Set(kpis.map((kpi) => kpi.KPITypeId)), [kpis]);

  const themes = useMemo(() => kpiTypes.filter((type) => !type.ParentKPIID && !kpiTypeIdSet.has(type.Id)), [kpiTypes, kpiTypeIdSet]);

  const subThemes = useMemo(
    () => kpiTypes.filter((type) => type.ParentKPIID && !kpiTypeIdSet.has(type.Id) && themes.some((theme) => theme.Id === type.ParentKPIID)),
    [kpiTypes, kpiTypeIdSet, themes]
  );

  const buildCode = (kpiTypeId) => {
    const lineage = [];
    let current = typeById.get(kpiTypeId);

    while (current) {
      lineage.unshift(current);
      current = current.ParentKPIID ? typeById.get(current.ParentKPIID) : null;
    }

    const parts = lineage.map((node) => {
      const siblings = childrenByParent.get(node.ParentKPIID || '__root__') || [];
      return siblings.findIndex((sibling) => sibling.Id === node.Id) + 1;
    });

    return parts.join('.');
  };

  const compareCodes = (leftCode, rightCode) => {
    const leftParts = String(leftCode || '')
      .split('.')
      .map((part) => Number(part));
    const rightParts = String(rightCode || '')
      .split('.')
      .map((part) => Number(part));

    const maxLength = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < maxLength; index += 1) {
      const leftPart = leftParts[index] || 0;
      const rightPart = rightParts[index] || 0;
      if (leftPart !== rightPart) return leftPart - rightPart;
    }

    return 0;
  };

  const kpiRankById = useMemo(() => {
    const bySubTheme = new Map();

    kpis.forEach((kpi) => {
      const leaf = typeById.get(kpi.KPITypeId);
      const subThemeId = leaf?.ParentKPIID;
      if (!subThemeId) return;

      if (!bySubTheme.has(subThemeId)) bySubTheme.set(subThemeId, []);
      bySubTheme.get(subThemeId).push(kpi);
    });

    const rankMap = new Map();

    bySubTheme.forEach((items) => {
      items
        .sort((left, right) => {
          const leftTime = new Date(left.CreatedAt || 0).getTime();
          const rightTime = new Date(right.CreatedAt || 0).getTime();
          if (leftTime !== rightTime) return leftTime - rightTime;
          return String(left.Id || '').localeCompare(String(right.Id || ''));
        })
        .forEach((item, index) => {
          rankMap.set(item.Id, index + 1);
        });
    });

    return rankMap;
  }, [kpis, typeById]);

  const kpiRows = useMemo(() => {
    return kpis
      .map((kpi) => {
        const leaf = typeById.get(kpi.KPITypeId);
        const subTheme = leaf?.ParentKPIID ? typeById.get(leaf.ParentKPIID) : null;
        const theme = subTheme?.ParentKPIID ? typeById.get(subTheme.ParentKPIID) : null;
        const subThemeCode = subTheme?.Id ? buildCode(subTheme.Id) : '';
        const sequentialRank = kpiRankById.get(kpi.Id);
        const kpiCode = subThemeCode && sequentialRank ? `${subThemeCode}.${sequentialRank}` : buildCode(kpi.KPITypeId);

        return {
          id: kpi.Id,
          kpiTypeId: kpi.KPITypeId,
          no: kpiCode,
          kpiName: leaf?.KPIName || kpi.KPIType?.KPIName || '—',
          themeId: theme?.Id || '',
          theme: theme?.KPIName || '—',
          subThemeId: subTheme?.Id || '',
          subTheme: subTheme?.KPIName || '—',
          unitId: kpi.UnitId,
          unit: kpi.Unit?.Code || kpi.Unit?.Name || '—',
          weight: formatValue(kpi.Weight),
          baseline: formatValue(kpi.Baseline),
          target: formatValue(kpi.Target),
          description: kpi.Description || '',
          isEvidenceRequired: kpi.IsEvedenceRequired || false,
        };
      })
      .sort((left, right) => compareCodes(left.no, right.no));
  }, [kpis, typeById, childrenByParent, kpiRankById]);

  const unitRows = useMemo(
    () =>
      units.map((unit) => ({
        id: unit.Id,
        name: unit.Name,
        code: unit.Code,
        description: unit.Description || '—',
      })),
    [units]
  );

  const filteredKpis = useMemo(() => {
    const term = search.toLowerCase();
    return kpiRows.filter((row) => `${row.no} ${row.kpiName} ${row.theme} ${row.subTheme} ${row.unit} ${row.remark}`.toLowerCase().includes(term));
  }, [kpiRows, search]);

  const filteredThemes = useMemo(() => {
    const term = search.toLowerCase();
    return themes
      .map((row) => ({
        ...row,
        no: buildCode(row.Id),
      }))
      .filter((row) => `${row.no} ${row.KPIName} ${row.Description || ''}`.toLowerCase().includes(term))
      .sort((left, right) => compareCodes(left.no, right.no));
  }, [themes, search]);

  const filteredSubThemes = useMemo(() => {
    const term = search.toLowerCase();
    return subThemes
      .map((row) => ({
        ...row,
        no: buildCode(row.Id),
      }))
      .filter((row) => {
        const parentName = typeById.get(row.ParentKPIID)?.KPIName || '';
        return `${row.no} ${row.KPIName} ${row.Description || ''} ${parentName}`.toLowerCase().includes(term);
      })
      .sort((left, right) => compareCodes(left.no, right.no));
  }, [subThemes, search, typeById]);

  const filteredUnits = useMemo(() => {
    const term = search.toLowerCase();
    return unitRows.filter((row) => `${row.name} ${row.code} ${row.description}`.toLowerCase().includes(term));
  }, [unitRows, search]);

  const paginatedKpis = filteredKpis.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, refreshKey]);

  const openKpiEditor = (row) => {
    setEditKpiForm({
      id: row.id,
      kpiTypeId: row.kpiTypeId,
      kpiName: row.kpiName,
      themeId: row.themeId,
      subThemeId: row.subThemeId,
      unitId: row.unitId,
      weight: row.weight === '—' ? '' : row.weight,
      baseline: row.baseline === '—' ? '' : row.baseline,
      target: row.target === '—' ? '' : row.target,
      remark: row.remark === '—' ? '' : row.remark,
      description: row.description,
      isEvidenceRequired: row.isEvidenceRequired,
    });
    setEditingKpi(true);
  };

  const openThemeEditor = (row) => {
    setEditThemeForm({
      id: row.Id,
      name: row.KPIName,
      description: row.Description || '',
    });
    setEditingTheme(true);
  };

  const openSubThemeEditor = (row) => {
    setEditSubThemeForm({
      id: row.Id,
      name: row.KPIName,
      description: row.Description || '',
      themeId: row.ParentKPIID,
    });
    setEditingSubTheme(true);
  };

  const openUnitEditor = (row) => {
    setEditUnitForm({
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description === '—' ? '' : row.description,
    });
    setEditingUnit(true);
  };

  const saveKpiEdit = async () => {
    if (!editKpiForm.id || !editKpiForm.kpiTypeId || !editKpiForm.kpiName.trim() || !editKpiForm.subThemeId || !editKpiForm.unitId) {
      notify('KPI Name, Sub-Theme and Unit are required.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/kpi-types/${editKpiForm.kpiTypeId}`, {
        KPIName: editKpiForm.kpiName.trim(),
        ParentKPIID: editKpiForm.subThemeId,
        Description: editKpiForm.description?.trim() || null,
      });

      await api.put(`/kpis/${editKpiForm.id}`, {
        KPITypeId: editKpiForm.kpiTypeId,
        UnitId: editKpiForm.unitId,
        Weight: Number(editKpiForm.weight || 0),
        Baseline: editKpiForm.baseline === '' ? null : Number(editKpiForm.baseline),
        Target: Number(editKpiForm.target || 0),
        Description: editKpiForm.description?.trim() || null,
        Remark: editKpiForm.remark?.trim() || null,
        IsEvedenceRequired: editKpiForm.isEvidenceRequired,
      });

      notify('KPI updated successfully.', 'success');
      setEditingKpi(false);
      await loadData();
    } catch (saveErr) {
      notify(saveErr?.response?.data?.message || 'Failed to update KPI.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveThemeEdit = async () => {
    if (!editThemeForm.id || !editThemeForm.name.trim()) {
      notify('Theme name is required.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/kpi-types/${editThemeForm.id}`, {
        KPIName: editThemeForm.name.trim(),
        ParentKPIID: null,
        Description: editThemeForm.description?.trim() || null,
      });
      notify('Theme updated successfully.', 'success');
      setEditingTheme(false);
      await loadData();
    } catch (saveErr) {
      notify(saveErr?.response?.data?.message || 'Failed to update theme.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveSubThemeEdit = async () => {
    if (!editSubThemeForm.id || !editSubThemeForm.name.trim() || !editSubThemeForm.themeId) {
      notify('Sub-Theme name and parent theme are required.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/kpi-types/${editSubThemeForm.id}`, {
        KPIName: editSubThemeForm.name.trim(),
        ParentKPIID: editSubThemeForm.themeId,
        Description: editSubThemeForm.description?.trim() || null,
      });
      notify('Sub-Theme updated successfully.', 'success');
      setEditingSubTheme(false);
      await loadData();
    } catch (saveErr) {
      notify(saveErr?.response?.data?.message || 'Failed to update sub-theme.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveUnitEdit = async () => {
    if (!editUnitForm.id || !editUnitForm.name.trim() || !editUnitForm.code.trim()) {
      notify('Unit name and code are required.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/units/${editUnitForm.id}`, {
        Name: editUnitForm.name.trim(),
        Code: editUnitForm.code.trim(),
        Description: editUnitForm.description?.trim() || null,
      });
      notify('Unit updated successfully.', 'success');
      setEditingUnit(false);
      await loadData();
    } catch (saveErr) {
      notify(saveErr?.response?.data?.message || 'Failed to update unit.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteKpi = async () => {
    if (!deletingKpi) return;

    setSaving(true);
    try {
      await api.delete(`/kpis/${deletingKpi.id}`);
      await api.delete(`/kpi-types/${deletingKpi.kpiTypeId}`);
      notify('KPI deleted successfully.', 'success');
      setDeletingKpi(null);
      await loadData();
    } catch (deleteErr) {
      notify(deleteErr?.response?.data?.message || 'Failed to delete KPI.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTheme = async () => {
    if (!deletingTheme) return;

    const hasSubThemes = subThemes.some((item) => item.ParentKPIID === deletingTheme.Id);
    if (hasSubThemes) {
      notify('Cannot delete theme with existing sub-themes. Delete sub-themes first.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await api.delete(`/kpi-types/${deletingTheme.Id}`);
      notify('Theme deleted successfully.', 'success');
      setDeletingTheme(null);
      await loadData();
    } catch (deleteErr) {
      notify(deleteErr?.response?.data?.message || 'Failed to delete theme.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteSubTheme = async () => {
    if (!deletingSubTheme) return;

    const hasKpis = kpiRows.some((row) => row.subThemeId === deletingSubTheme.Id);
    if (hasKpis) {
      notify('Cannot delete sub-theme with existing KPIs. Delete KPIs first.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await api.delete(`/kpi-types/${deletingSubTheme.Id}`);
      notify('Sub-Theme deleted successfully.', 'success');
      setDeletingSubTheme(null);
      await loadData();
    } catch (deleteErr) {
      notify(deleteErr?.response?.data?.message || 'Failed to delete sub-theme.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteUnit = async () => {
    if (!deletingUnit) return;

    setSaving(true);
    try {
      await api.delete(`/units/${deletingUnit.id}`);
      notify('Unit deleted successfully.', 'success');
      setDeletingUnit(null);
      await loadData();
    } catch (deleteErr) {
      notify(deleteErr?.response?.data?.message || 'Failed to delete unit.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const subThemeOptionsForEdit = subThemes.filter((row) => !editKpiForm.themeId || row.ParentKPIID === editKpiForm.themeId);

  return (
    <div className="flex flex-col gap-12">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            All KPIs <span className="text-muted-foreground">{filteredKpis.length}</span>
          </h2>

          <div className="flex items-center gap-3">
            <div className="w-80">
              <SearchInput onChange={setSearch} value={search} placeholder="Search KPI records..." />
            </div>

            <button className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-all duration-200 hover:bg-muted shadow-soft">
              <span>Filters</span>
            </button>
          </div>
        </div>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table className="min-w-300">
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>KPI</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Sub-Theme</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10}>Loading KPI records...</TableCell>
                </TableRow>
              ) : paginatedKpis.length ? (
                paginatedKpis.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.no}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{row.kpiName}</span>
                        {row.isEvidenceRequired && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 w-fit">
                            Evidence Required
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{row.theme}</TableCell>
                    <TableCell>{row.subTheme}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell>{row.weight}</TableCell>
                    <TableCell>{row.baseline}</TableCell>
                    <TableCell>{row.target}</TableCell>
                    <TableCell>{row.remark}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setViewingKpi(row)} className="rounded p-1 hover:bg-muted" title="View Details">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => openKpiEditor(row)} className="rounded p-1 hover:bg-muted" title="Edit KPI">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingKpi(row)}
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          title="Delete KPI"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10}>No KPI records found in the database.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination currentPage={currentPage} totalItems={filteredKpis.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Registered Themes</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table className="min-w-200">
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4}>Loading themes...</TableCell>
                </TableRow>
              ) : filteredThemes.length ? (
                filteredThemes.map((row) => (
                  <TableRow key={row.Id}>
                    <TableCell className="font-medium">{row.no}</TableCell>
                    <TableCell>{row.KPIName}</TableCell>
                    <TableCell>{row.Description || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openThemeEditor(row)} className="rounded p-1 hover:bg-muted" title="Edit Theme">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingTheme(row)}
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          title="Delete Theme"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4}>No themes found in the database.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Registered Sub-Themes</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table className="min-w-225">
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>Loading sub-themes...</TableCell>
                </TableRow>
              ) : filteredSubThemes.length ? (
                filteredSubThemes.map((row) => (
                  <TableRow key={row.Id}>
                    <TableCell className="font-medium">{row.no}</TableCell>
                    <TableCell>{row.KPIName}</TableCell>
                    <TableCell>{typeById.get(row.ParentKPIID)?.KPIName || '—'}</TableCell>
                    <TableCell>{row.Description || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openSubThemeEditor(row)} className="rounded p-1 hover:bg-muted" title="Edit Sub-Theme">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingSubTheme(row)}
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          title="Delete Sub-Theme"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5}>No sub-themes found in the database.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Registered Units</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table className="min-w-200">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4}>Loading units...</TableCell>
                </TableRow>
              ) : filteredUnits.length ? (
                filteredUnits.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openUnitEditor(row)} className="rounded p-1 hover:bg-muted" title="Edit Unit">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingUnit(row)}
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          title="Delete Unit"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4}>No units found in the database.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={editingKpi} onOpenChange={(open) => !open && !saving && setEditingKpi(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit KPI</DialogTitle>
            <DialogDescription>Update KPI details below.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              value={editKpiForm.kpiName}
              placeholder="KPI Name"
              onChange={(e) => setEditKpiForm((prev) => ({ ...prev, kpiName: e.target.value }))}
            />
            <select
              value={editKpiForm.themeId}
              onChange={(e) => setEditKpiForm((prev) => ({ ...prev, themeId: e.target.value, subThemeId: '' }))}
              className="h-10 rounded border border-border bg-background px-3 text-sm"
            >
              <option value="">Select Theme</option>
              {themes.map((theme) => (
                <option key={theme.Id} value={theme.Id}>
                  {theme.KPIName}
                </option>
              ))}
            </select>
            <select
              value={editKpiForm.subThemeId}
              onChange={(e) => setEditKpiForm((prev) => ({ ...prev, subThemeId: e.target.value }))}
              className="h-10 rounded border border-border bg-background px-3 text-sm"
            >
              <option value="">Select Sub-Theme</option>
              {subThemeOptionsForEdit.map((item) => (
                <option key={item.Id} value={item.Id}>
                  {item.KPIName}
                </option>
              ))}
            </select>
            <select
              value={editKpiForm.unitId}
              onChange={(e) => setEditKpiForm((prev) => ({ ...prev, unitId: e.target.value }))}
              className="h-10 rounded border border-border bg-background px-3 text-sm"
            >
              <option value="">Select Unit</option>
              {units.map((unit) => (
                <option key={unit.Id} value={unit.Id}>
                  {unit.Name} ({unit.Code})
                </option>
              ))}
            </select>
            <Input
              value={editKpiForm.weight}
              placeholder="Weight"
              onChange={(e) => setEditKpiForm((prev) => ({ ...prev, weight: e.target.value }))}
            />
            <Input
              value={editKpiForm.baseline}
              placeholder="Baseline"
              onChange={(e) => setEditKpiForm((prev) => ({ ...prev, baseline: e.target.value }))}
            />
            <Input
              value={editKpiForm.target}
              placeholder="Target"
              onChange={(e) => setEditKpiForm((prev) => ({ ...prev, target: e.target.value }))}
            />
            <Input
              value={editKpiForm.remark}
              placeholder="Remark"
              onChange={(e) => setEditKpiForm((prev) => ({ ...prev, remark: e.target.value }))}
              className="md:col-span-2"
            />
            <div className="flex items-center gap-3 py-1 px-1">
              <Checkbox
                id="editIsEvidenceRequired"
                checked={editKpiForm.isEvidenceRequired}
                onCheckedChange={(checked) => setEditKpiForm((prev) => ({ ...prev, isEvidenceRequired: !!checked }))}
              />
              <label htmlFor="editIsEvidenceRequired" className="text-sm font-medium text-foreground cursor-pointer select-none">
                Needs Evidence Verification
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingKpi(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveKpiEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingTheme} onOpenChange={(open) => !open && !saving && setEditingTheme(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Theme</DialogTitle>
            <DialogDescription>Update theme details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editThemeForm.name}
              placeholder="Theme Name"
              onChange={(e) => setEditThemeForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
              value={editThemeForm.description}
              placeholder="Description"
              onChange={(e) => setEditThemeForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTheme(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveThemeEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingSubTheme} onOpenChange={(open) => !open && !saving && setEditingSubTheme(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sub-Theme</DialogTitle>
            <DialogDescription>Update sub-theme details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editSubThemeForm.name}
              placeholder="Sub-Theme Name"
              onChange={(e) => setEditSubThemeForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <select
              value={editSubThemeForm.themeId}
              onChange={(e) => setEditSubThemeForm((prev) => ({ ...prev, themeId: e.target.value }))}
              className="h-10 w-full rounded border border-border bg-background px-3 text-sm"
            >
              <option value="">Select Theme</option>
              {themes.map((theme) => (
                <option key={theme.Id} value={theme.Id}>
                  {theme.KPIName}
                </option>
              ))}
            </select>
            <Input
              value={editSubThemeForm.description}
              placeholder="Description"
              onChange={(e) => setEditSubThemeForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubTheme(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveSubThemeEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingUnit} onOpenChange={(open) => !open && !saving && setEditingUnit(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Unit</DialogTitle>
            <DialogDescription>Update unit details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editUnitForm.name}
              placeholder="Unit Name"
              onChange={(e) => setEditUnitForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input value={editUnitForm.code} placeholder="Code" onChange={(e) => setEditUnitForm((prev) => ({ ...prev, code: e.target.value }))} />
            <Input
              value={editUnitForm.description}
              placeholder="Description"
              onChange={(e) => setEditUnitForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUnit(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveUnitEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingKpi)} onOpenChange={(open) => !open && !saving && setDeletingKpi(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete KPI</DialogTitle>
            <DialogDescription>Delete KPI "{deletingKpi?.kpiName}"? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingKpi(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteKpi} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingTheme)} onOpenChange={(open) => !open && !saving && setDeletingTheme(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Theme</DialogTitle>
            <DialogDescription>Delete theme "{deletingTheme?.KPIName}"? Delete sub-themes first if they exist.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTheme(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteTheme} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingSubTheme)} onOpenChange={(open) => !open && !saving && setDeletingSubTheme(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sub-Theme</DialogTitle>
            <DialogDescription>Delete sub-theme "{deletingSubTheme?.KPIName}"? Delete KPI rows under it first.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingSubTheme(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteSubTheme} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingUnit)} onOpenChange={(open) => !open && !saving && setDeletingUnit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Unit</DialogTitle>
            <DialogDescription>Delete unit "{deletingUnit?.name}"? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUnit(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteUnit} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewingKpi)} onOpenChange={(open) => !open && setViewingKpi(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-0 bg-slate-50 shadow-2xl rounded-[2rem] max-h-[85vh] flex flex-col">
          <div className="bg-white px-6 py-6 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                <Target className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold text-slate-900 leading-tight">
                  KPI Information
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 font-medium">
                  Review the full configuration and strategic metadata for this objective.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-6 overflow-y-auto flex-grow">
            {viewingKpi && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* KPI Name - Full Width */}
                <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">KPI Name</p>
                  <p className="text-base font-bold text-slate-900 leading-snug">{viewingKpi.kpiName}</p>
                </div>

                {/* Baseline & Target */}
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Baseline</p>
                  <p className="text-lg font-black text-slate-900">{viewingKpi.baseline}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Target</p>
                  <p className="text-lg font-black text-indigo-600">{viewingKpi.target}</p>
                </div>

                {/* Theme & Sub-Theme */}
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Theme</p>
                  <p className="text-sm font-bold text-slate-700">{viewingKpi.theme}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Sub-Theme</p>
                  <p className="text-sm font-bold text-slate-700">{viewingKpi.subTheme}</p>
                </div>

                {/* Unit & Weight */}
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Unit</p>
                  <p className="text-sm font-bold text-indigo-600">{viewingKpi.unit}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Weight</p>
                  <p className="text-sm font-bold text-slate-700">{viewingKpi.weight}%</p>
                </div>

                {/* Evidence Status & Remark */}
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Evidence Required</p>
                  <Badge className={viewingKpi.isEvidenceRequired ? "bg-indigo-100 text-indigo-700 border-0" : "bg-slate-100 text-slate-600 border-0"}>
                    {viewingKpi.isEvidenceRequired ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Remark</p>
                  <p className="text-sm font-medium text-slate-500 italic">{viewingKpi.remark || 'No remark provided'}</p>
                </div>

                {/* Description - Full Width */}
                {viewingKpi.description && (
                  <div className="md:col-span-2 bg-slate-100/50 rounded-2xl border border-slate-200/60 p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Detailed Description</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{viewingKpi.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white px-6 py-4 border-t border-slate-100 flex justify-end">
            <Button onClick={() => setViewingKpi(null)} className="rounded-xl px-8 bg-slate-900 hover:bg-slate-800">
              Close Detail
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default KpiList;
