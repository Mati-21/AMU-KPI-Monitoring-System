import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../Components/UI/Badge';
import { Search, Eye, Edit } from 'lucide-react';
import { Input } from '../../Components/UI/Input';
import CustomSelect from '../../Components/UI/CustomSelect';
import { Card, CardContent } from '../../Components/UI/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../Components/UI/Table';
import { ScrollArea } from '../../Components/UI/scroll-area';
import { api } from '../../api/axios';
import { useKpisQuery, useKpiTypesQuery, useCycleYearsQuery, useUnitsQuery } from '../../Hooks/Queries/useKpis';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../Components/UI/dialog';
import { useNotification } from '../../Context/NotificationContext';

const ALL_THEMES_OPTION = 'All Themes';
const ALL_SUB_THEMES_OPTION = 'All Sub-Themes';

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric.toString();
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

const RegisteredKpis = () => {
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState(ALL_THEMES_OPTION);
  const [subThemeFilter, setSubThemeFilter] = useState(ALL_SUB_THEMES_OPTION);
  const [lifecycleFilter, setLifecycleFilter] = useState('active'); // 'active', 'archived', 'all'

  // View and Edit states
  const [viewingKpi, setViewingKpi] = useState(null);
  const [editingKpi, setEditingKpi] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    kpiTypeId: '',
    kpi: '',
    baseline: '',
    target: '',
    weight: '',
    unitId: '',
    isEvidenceRequired: false,
    description: '',
  });

  const { notify } = useNotification();

  // Queries
  const { data: kpis = [], isLoading: loadingKpis, error: kpiError, refetch: refetchKpis } = useKpisQuery({ includeArchived: 'true' });
  const { data: kpiTypes = [], isLoading: loadingTypes, error: typeError } = useKpiTypesQuery();
  const { data: cycleYearsData } = useCycleYearsQuery();
  const { data: units = [] } = useUnitsQuery();

  const loading = loadingKpis || loadingTypes;
  const error = kpiError?.response?.data?.message || typeError?.response?.data?.message || '';

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

  const activeCycleYear = useMemo(() => {
    if (cycleYearsData?.activeCycleYear) return cycleYearsData.activeCycleYear;
    const years = kpis.flatMap((k) => (k.KPIYearPlans || []).map((p) => Number(p.CycleYear))).filter(Boolean);
    return years.length > 0 ? String(Math.max(...years)) : '';
  }, [cycleYearsData, kpis]);

  const registeredKpis = useMemo(() => {
    const rows = [];
    kpis.forEach((kpi) => {
      const leaf = typeById.get(kpi.KPITypeId);
      const subTheme = leaf?.ParentKPIID ? typeById.get(leaf.ParentKPIID) : null;
      const theme = subTheme?.ParentKPIID ? typeById.get(subTheme.ParentKPIID) : null;
      const subThemeCode = subTheme?.Id ? buildCode(subTheme.Id) : '';
      const sequentialRank = (() => {
        if (!subTheme?.Id) return null;
        const siblings = kpis
          .filter((item) => {
            const itemLeaf = typeById.get(item.KPITypeId);
            return String(itemLeaf?.ParentKPIID || '') === String(subTheme.Id);
          })
          .sort((left, right) => {
            const leftTime = new Date(left.CreatedAt || 0).getTime();
            const rightTime = new Date(right.CreatedAt || 0).getTime();
            if (leftTime !== rightTime) return leftTime - rightTime;
            return String(left.Id || '').localeCompare(String(right.Id || ''));
          });

        return siblings.findIndex((item) => item.Id === kpi.Id) + 1;
      })();

      const no = subThemeCode && sequentialRank ? `${subThemeCode}.${sequentialRank}` : buildCode(kpi.KPITypeId);

      const plans = kpi.KPIYearPlans && kpi.KPIYearPlans.length > 0
        ? kpi.KPIYearPlans
        : [{ CycleYear: activeCycleYear || new Date().getFullYear().toString(), Baseline: kpi.DefaultBaseline || 0, Target: kpi.Target || 0, FinalPerformance: null, Status: 'ACTIVE' }];

      plans.forEach((plan) => {
        rows.push({
          id: `${kpi.Id}-${plan.CycleYear}`,
          kpiId: kpi.Id,
          kpiTypeId: kpi.KPITypeId,
          no: no,
          kpi: leaf?.KPIName || kpi.KPIType?.KPIName || '—',
          lifecycleType: kpi.LifecycleType,
          cycleYear: plan.CycleYear,
          baseline: plan.Baseline,
          target: plan.Target,
          finalPerformance: plan.FinalPerformance,
          status: plan.Status,
          theme: theme?.KPIName || '—',
          subTheme: subTheme?.KPIName || '—',
          unitId: kpi.UnitId,
          unit: kpi.Unit?.Code || kpi.Unit?.Name || '—',
          weight: formatValue(kpi.Weight),
          remark: kpi.Remark || kpi.Description || '—',
          isEvidenceRequired: kpi.IsEvedenceRequired || false,
          description: kpi.Description || '',
        });
      });
    });

    return rows
      .filter((row) => row.no && !row.no.includes('NaN'))
      .sort((left, right) => {
        const yearDiff = String(right.cycleYear).localeCompare(String(left.cycleYear));
        if (yearDiff !== 0) return yearDiff;
        return compareCodes(left.no, right.no);
      });
  }, [kpis, typeById, childrenByParent, activeCycleYear]);

  const themes = useMemo(() => [...new Set(registeredKpis.map((item) => item.theme).filter((theme) => theme && theme !== '—'))], [registeredKpis]);

  const subThemes = useMemo(
    () => [
      ...new Set(
        registeredKpis
          .filter((item) => themeFilter === ALL_THEMES_OPTION || item.theme === themeFilter)
          .map((item) => item.subTheme)
          .filter((subTheme) => subTheme && subTheme !== '—')
      ),
    ],
    [registeredKpis, themeFilter]
  );

  useEffect(() => {
    if (subThemeFilter !== ALL_SUB_THEMES_OPTION && !subThemes.includes(subThemeFilter)) {
      setSubThemeFilter(ALL_SUB_THEMES_OPTION);
    }
  }, [subThemeFilter, subThemes]);

  const filteredKpis = useMemo(() => {
    return registeredKpis.filter((k) => {
      const matchesSearch = k.kpi.toLowerCase().includes(search.toLowerCase()) || k.no.includes(search);
      const matchesTheme = themeFilter === ALL_THEMES_OPTION || k.theme === themeFilter;
      const matchesSubTheme = subThemeFilter === ALL_SUB_THEMES_OPTION || k.subTheme === subThemeFilter;
      return matchesSearch && matchesTheme && matchesSubTheme;
    });
  }, [registeredKpis, search, themeFilter, subThemeFilter]);

  const finalFilteredKpis = useMemo(() => {
    return filteredKpis.filter((k) => {
      if (lifecycleFilter === 'active') {
        return String(k.cycleYear) === String(activeCycleYear);
      }
      if (lifecycleFilter === 'archived') {
        return activeCycleYear ? Number(k.cycleYear) < Number(activeCycleYear) : false;
      }
      return true; // 'all'
    });
  }, [filteredKpis, lifecycleFilter, activeCycleYear]);

  const openKpiEditor = (row) => {
    setEditForm({
      id: row.kpiId,
      kpiTypeId: row.kpiTypeId,
      kpi: row.kpi,
      baseline: row.baseline === null || row.baseline === undefined ? '' : row.baseline,
      target: row.target === null || row.target === undefined ? '' : row.target,
      weight: row.weight === null || row.weight === undefined || row.weight === '—' ? '' : row.weight,
      unitId: row.unitId || '',
      isEvidenceRequired: row.isEvidenceRequired || false,
      description: row.description || '',
    });
    setEditingKpi(row);
  };

  const saveKpiEdit = async () => {
    if (!editForm.id || !editForm.unitId) {
      notify('Unit is required.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/kpis/${editForm.id}`, {
        KPITypeId: editForm.kpiTypeId,
        UnitId: editForm.unitId,
        Weight: editForm.weight === '' ? 0 : Number(editForm.weight),
        Baseline: editForm.baseline === '' ? null : Number(editForm.baseline),
        Target: editForm.target === '' ? 0 : Number(editForm.target),
        Description: editForm.description?.trim() || null,
        IsEvedenceRequired: editForm.isEvidenceRequired,
      });

      notify('KPI updated successfully.', 'success');
      setEditingKpi(null);
      await refetchKpis();
    } catch (saveErr) {
      notify(saveErr?.response?.data?.message || 'Failed to update KPI.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Registered KPIs</h1>
        <p className="text-sm text-muted-foreground">View all KPIs registered by admin</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        {/* Segmented Filter Control */}
        <div className="flex bg-muted/40 p-1 rounded-lg border border-border w-fit">
          <button
            onClick={() => setLifecycleFilter('active')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
              lifecycleFilter === 'active'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setLifecycleFilter('archived')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
              lifecycleFilter === 'archived'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Archived
          </button>
          <button
            onClick={() => setLifecycleFilter('all')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
              lifecycleFilter === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            All
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search KPIs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto sm:min-w-110">
            <CustomSelect
              placeholder={ALL_THEMES_OPTION}
              value={themeFilter}
              onChange={(selectedTheme) => {
                setThemeFilter(selectedTheme);
                setSubThemeFilter(ALL_SUB_THEMES_OPTION);
              }}
              options={[ALL_THEMES_OPTION, ...themes]}
            />
            <CustomSelect
              placeholder={ALL_SUB_THEMES_OPTION}
              value={subThemeFilter}
              onChange={setSubThemeFilter}
              options={[ALL_SUB_THEMES_OPTION, ...subThemes]}
            />
          </div>
        </div>
      </div>

      <Card className="border border-border shadow-sm overflow-hidden rounded-lg">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className={lifecycleFilter === 'active' ? "min-w-270" : "min-w-240"}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 border-b border-border">
                    <TableHead className="w-16 text-center font-bold text-foreground">No.</TableHead>
                    <TableHead className="w-80 font-bold text-foreground">KPI Name</TableHead>
                    <TableHead className="w-32 text-center font-bold text-foreground">Type</TableHead>
                    <TableHead className="w-28 text-center font-bold text-foreground">Cycle Year</TableHead>
                    <TableHead className="w-28 text-center font-bold text-foreground">Baseline</TableHead>
                    <TableHead className="w-28 text-center font-bold text-foreground">Target</TableHead>
                    <TableHead className="w-36 text-center font-bold text-foreground">Final Performance</TableHead>
                    <TableHead className="w-32 text-center font-bold text-foreground">Status</TableHead>
                    {lifecycleFilter === 'active' && (
                      <TableHead className="w-32 text-center font-bold text-foreground">Action</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalFilteredKpis.map((row, index) => {
                    const formattedBaseline = Number(row.baseline).toFixed(2);
                    const formattedTarget = Number(row.target).toFixed(2);
                    const formattedPerformance = row.finalPerformance !== null && row.finalPerformance !== undefined
                      ? Number(row.finalPerformance).toFixed(2)
                      : 'Pending';

                    const isPending = formattedPerformance === 'Pending';

                    // Type badges
                    let typeBadgeClass = '';
                    let typeLabel = '';
                    if (row.lifecycleType === 'RECURRING') {
                      typeBadgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
                      typeLabel = 'Recursive';
                    } else if (row.lifecycleType === 'PROGRESSIVE') {
                      typeBadgeClass = 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
                      typeLabel = 'Progressive';
                    } else {
                      typeBadgeClass = 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
                      typeLabel = 'One-Time';
                    }

                    // Status style
                    let statusStyle = '';
                    if (row.status === 'ACTIVE') {
                      statusStyle = 'text-emerald-600 font-bold text-xs tracking-wider';
                    } else {
                      statusStyle = 'text-slate-500 font-bold text-xs tracking-wider';
                    }

                    return (
                      <TableRow key={row.id} className="hover:bg-muted/10 border-b border-border/50">
                        <TableCell className="h-12 text-center text-sm font-medium text-muted-foreground/80">{index + 1}</TableCell>
                        <TableCell className="h-12 text-sm font-semibold text-foreground/90 py-3">{row.kpi}</TableCell>
                        <TableCell className="h-12 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${typeBadgeClass}`}>
                            {typeLabel}
                          </span>
                        </TableCell>
                        <TableCell className="h-12 text-center text-sm font-medium text-foreground/75">{row.cycleYear}</TableCell>
                        <TableCell className="h-12 text-center text-sm font-medium text-foreground/75">{formattedBaseline}</TableCell>
                        <TableCell className="h-12 text-center text-sm font-medium text-foreground/75">{formattedTarget}</TableCell>
                        <TableCell className="h-12 text-center">
                          <span className={`text-sm font-semibold ${isPending ? 'text-muted-foreground/50 italic' : 'text-foreground/80'}`}>
                            {formattedPerformance}
                          </span>
                        </TableCell>
                        <TableCell className="h-12 text-center">
                          <span className={statusStyle}>
                            {row.status}
                          </span>
                        </TableCell>
                        {lifecycleFilter === 'active' && (
                          <TableCell className="h-12 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setViewingKpi(row)}
                                className="rounded p-1 hover:bg-muted text-foreground transition-colors"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openKpiEditor(row)}
                                className="rounded p-1 hover:bg-muted text-primary transition-colors"
                                title="Edit KPI"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}

                  {finalFilteredKpis.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={lifecycleFilter === 'active' ? 9 : 8} className="text-center py-12 text-muted-foreground text-sm font-medium">
                        No registered KPIs match your criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>{loading ? 'Loading registered KPIs...' : `Showing ${finalFilteredKpis.length} of ${registeredKpis.length} KPIs`}</span>
        <Badge variant="secondary">{themes.length} Themes</Badge>
      </div>

      {/* View Details Dialog */}
      <Dialog open={!!viewingKpi} onOpenChange={(open) => !open && setViewingKpi(null)}>
        <DialogContent className="max-w-md md:max-w-lg p-6 bg-card text-card-foreground rounded-lg border border-border shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">KPI Details</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Detailed overview of the selected KPI plan.</DialogDescription>
          </DialogHeader>

          {viewingKpi && (
            <div className="space-y-4 my-4">
              <div className="flex flex-col gap-1 border-b border-border/50 pb-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">KPI Name</span>
                <span className="text-sm font-semibold text-foreground">{viewingKpi.kpi}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-border/50 pb-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Theme</span>
                  <span className="text-xs font-semibold text-foreground/90">{viewingKpi.theme}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Sub-Theme</span>
                  <span className="text-xs font-semibold text-foreground/90">{viewingKpi.subTheme}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-b border-border/50 pb-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Type</span>
                  <span className="text-xs font-semibold text-foreground/90 capitalize">{viewingKpi.lifecycleType?.toLowerCase()}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Cycle Year</span>
                  <span className="text-xs font-semibold text-foreground/90">{viewingKpi.cycleYear}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Status</span>
                  <span className="text-xs font-bold text-emerald-600 tracking-wide uppercase">{viewingKpi.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 border-b border-border/50 pb-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Baseline</span>
                  <span className="text-xs font-semibold text-foreground/90">{Number(viewingKpi.baseline).toFixed(2)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Target</span>
                  <span className="text-xs font-semibold text-foreground/90">{Number(viewingKpi.target).toFixed(2)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Weight</span>
                  <span className="text-xs font-semibold text-foreground/90">{viewingKpi.weight}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Unit</span>
                  <span className="text-xs font-semibold text-foreground/90">{viewingKpi.unit}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-border/50 pb-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Evidence Required</span>
                  <span className="text-xs font-semibold text-foreground/90">
                    {viewingKpi.isEvidenceRequired ? 'Yes (Mandatory)' : 'No'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Final Performance</span>
                  <span className="text-xs font-semibold text-foreground/90">
                    {viewingKpi.finalPerformance !== null && viewingKpi.finalPerformance !== undefined
                      ? Number(viewingKpi.finalPerformance).toFixed(2)
                      : 'Pending'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 pt-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Description</span>
                <span className="text-xs font-medium text-foreground/80 leading-relaxed max-h-24 overflow-y-auto">
                  {viewingKpi.description || viewingKpi.remark || 'No description available for this KPI.'}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 flex justify-end">
            <button
              onClick={() => setViewingKpi(null)}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-muted hover:bg-muted/80 text-foreground transition-all duration-200"
            >
              Close Details
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit KPI Dialog */}
      <Dialog open={!!editingKpi} onOpenChange={(open) => !open && !saving && setEditingKpi(null)}>
        <DialogContent className="max-w-md md:max-w-lg p-6 bg-card text-card-foreground rounded-lg border border-border shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Edit Active KPI</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify active year plan baseline, target, and other KPI attributes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">KPI Name</label>
              <Input
                value={editForm.kpi}
                disabled
                className="bg-muted/50 cursor-not-allowed opacity-80"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Baseline</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={editForm.baseline}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, baseline: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Target</label>
                <Input
                  type="number"
                  placeholder="100.00"
                  value={editForm.target}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, target: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Weight</label>
                <Input
                  type="number"
                  placeholder="Weight (0 - 100)"
                  value={editForm.weight}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, weight: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Unit</label>
                <select
                  value={editForm.unitId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, unitId: e.target.value }))}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Unit</option>
                  {units.map((unit) => (
                    <option key={unit.Id} value={unit.Id}>
                      {unit.Code || unit.Name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                id="evidenceRequired"
                checked={editForm.isEvidenceRequired}
                onChange={(e) => setEditForm((prev) => ({ ...prev, isEvidenceRequired: e.target.checked }))}
                className="h-4 w-4 rounded border-border bg-background text-primary accent-primary"
              />
              <label htmlFor="evidenceRequired" className="text-xs font-semibold text-foreground/80 cursor-pointer">
                Action / Evidence Required for Submission
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="KPI Description..."
                rows={3}
                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setEditingKpi(null)}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-muted hover:bg-muted/80 text-foreground transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={saveKpiEdit}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-200 flex items-center gap-1.5"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegisteredKpis;
