import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { ChevronDown, Eye, PencilLine, Filter, Plus } from 'lucide-react';
import { api } from '../../api/axios';
import { useNotification } from '../../Context/NotificationContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../Components/UI/Tabs';
import PerformanceSubmitModal from '../../Components/KPI/PerformanceSubmitModal';
import permissionUtils from '../../lib/permissionUtils';

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric.toString();
};

function AssignedKpisPage() {
  const { notify } = useNotification();
  const authUser = useSelector((state) => state.auth?.user);
  const userPermissions = authUser?.permissions || [];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [themeFilter, setThemeFilter] = useState('All Themes');
  const [allocatedThemes, setAllocatedThemes] = useState([]);
  const [expandedThemes, setExpandedThemes] = useState({});
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [savingSubmission, setSavingSubmission] = useState(false);
  const [activeKpi, setActiveKpi] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [activePerformanceTab, setActivePerformanceTab] = useState('original');
  const [showPerformanceTabs, setShowPerformanceTabs] = useState(false);
  const isDerivedView = activePerformanceTab === 'derived';

  const canCascadeKpis = useMemo(
    () =>
      permissionUtils.hasPermission(userPermissions, [
        permissionUtils.permissionKey('create', 'KPI Allocation'),
        permissionUtils.permissionKey('view', 'KPI Allocation'),
      ]),
    [userPermissions]
  );

  useEffect(() => {
    let mounted = true;

    const loadAllocatedKpis = async () => {
      setLoading(true);
      setError('');

      try {
        const [allMineRes, fromParentRes, kpiRes, kpiTypeRes, rolesRes] = await Promise.all([
          api.get('/user-kpis', {
            params: {
              scope: 'mine',
              t: Date.now(),
            },
          }),
          api.get('/user-kpis', {
            params: {
              scope: 'mine',
              fromParent: true,
              t: Date.now(),
            },
          }),
          api.get('/kpis', { params: { t: Date.now() } }),
          api.get('/kpi-types', { params: { t: Date.now() } }),
          api.get('/roles', { params: { t: Date.now() } }),
        ]);

        if (!mounted) return;

        const currentRoleId = String(authUser?.roleId || authUser?.RoleId || authUser?.currentRole?.Id || authUser?.currentRole?.RoleId || '');
        const roles = rolesRes.data?.data || [];
        const currentRole = roles.find((r) => String(r.Id || r.id || '').toLowerCase() === String(currentRoleId || '').toLowerCase());
        const hasExtraMeasures = Boolean(currentRole?.HasExtraMeasures ?? currentRole?.hasExtraMeasures ?? authUser?.hasExtraMeasures);
        const isDistributable = Boolean(currentRole?.IsDistributable ?? currentRole?.isDistributable ?? authUser?.isDistributable ?? canCascadeKpis ?? true);

        // Calculate lineage for extra measures
        let isDescendantOfExtraMeasureRole = false;
        let parentId = currentRole?.ParentRoleId;
        while (parentId) {
          const parent = roles.find((r) => String(r.Id) === String(parentId));
          if (parent?.HasExtraMeasures) {
            isDescendantOfExtraMeasureRole = true;
            break;
          }
          parentId = parent?.ParentRoleId;
        }

        setShowPerformanceTabs(hasExtraMeasures);
        if (!hasExtraMeasures) {
          setActivePerformanceTab(isDescendantOfExtraMeasureRole ? 'derived' : 'original');
        }

        const allAssignments = allMineRes.data?.data || [];
        const fromParentAssignments = fromParentRes.data?.data || [];
        const assignmentById = new Map();

        [...allAssignments, ...fromParentAssignments].forEach((assignment) => {
          if (!assignment?.Id) return;
          if (!assignmentById.has(assignment.Id)) {
            assignmentById.set(assignment.Id, assignment);
          }
        });

        const combinedAssignments = [...assignmentById.values()];
        const fromParentAssignmentIds = new Set(fromParentAssignments.map((assignment) => assignment.Id));

        const assignments = combinedAssignments.filter((assignment) => {
          const remark = String(assignment?.Remark || assignment?.KPI?.Remark || '').trim();
          const isDerived = remark.length > 0 && remark.toLowerCase() !== 'null';

          // Derived KPIs are hidden from performance tracking if the role is distributable,
          // unless they are explicitly marked for inclusion in the current office.
          if (isDerived && isDistributable && !Boolean(assignment?.IncludeCurrentOffice)) {
            return false;
          }

          if (!showPerformanceTabs) {
            return true;
          }

          if (activePerformanceTab === 'derived') {
            return isDerived;
          }

          // In the tabbed view, original tab should strictly show only non-derived KPIs.
          return !isDerived;
        });
        const kpis = kpiRes.data?.data || [];
        const kpiTypes = kpiTypeRes.data?.data || [];

        const typeById = new Map(kpiTypes.map((type) => [type.Id, type]));
        const kpiById = new Map(kpis.map((kpi) => [kpi.Id, kpi]));
        const groupedThemes = new Map();

        assignments.forEach((assignment) => {
          const kpiRecord = kpiById.get(assignment.KPIId);
          if (!kpiRecord) return;

          const isFromParent = fromParentAssignmentIds.has(assignment.Id);
          const remark = String(assignment?.Remark || assignment?.KPI?.Remark || '').trim();
          const isDerived = remark.length > 0 && remark.toLowerCase() !== 'null';

          const quarterlyResults = Array.isArray(assignment.quarterlyResults) ? assignment.quarterlyResults : [];
          const quarterValues = quarterlyResults.reduce(
            (accumulator, result) => {
              const quarterKey = String(result.quarter || '').toUpperCase();
              if (quarterKey === 'Q1' && accumulator.q1 === '-') accumulator.q1 = result.result || '-';
              if (quarterKey === 'Q2' && accumulator.q2 === '-') accumulator.q2 = result.result || '-';
              if (quarterKey === 'Q3' && accumulator.q3 === '-') accumulator.q3 = result.result || '-';
              if (quarterKey === 'Q4' && accumulator.q4 === '-') accumulator.q4 = result.result || '-';
              return accumulator;
            },
            { q1: assignment.q1 || '-', q2: assignment.q2 || '-', q3: assignment.q3 || '-', q4: assignment.q4 || '-' }
          );

          const leaf = typeById.get(kpiRecord.KPITypeId);
          const subTheme = leaf?.ParentKPIID ? typeById.get(leaf.ParentKPIID) : null;
          const theme = subTheme?.ParentKPIID ? typeById.get(subTheme.ParentKPIID) : null;

          // For derived KPI performance view, we intentionally avoid Theme/Sub-theme grouping in the UI.
          // We still store them on each KPI row, but group everything under one bucket for simplicity.
          const themeName = isDerivedView ? 'Drived KPI' : theme?.KPIName || 'Uncategorized Theme';
          const subThemeName = isDerivedView ? 'Drived KPI' : subTheme?.KPIName || 'Uncategorized Sub-Theme';

          if (!groupedThemes.has(themeName)) {
            groupedThemes.set(themeName, new Map());
          }

          const subThemeMap = groupedThemes.get(themeName);
          if (!subThemeMap.has(subThemeName)) {
            subThemeMap.set(subThemeName, []);
          }

          subThemeMap.get(subThemeName).push({
            id: assignment.Id,
            kpiId: kpiRecord.Id,
            name: (assignment.Remark || leaf?.KPIName || kpiRecord.KPIType?.KPIName || '—').trim(),
            baseline: formatValue(assignment.Baseline ?? kpiRecord.Baseline),
            target: formatValue(kpiRecord.Target),
            theme: themeName,
            subTheme: subThemeName,
            isDerived,
            unit: kpiRecord.Unit?.Code || kpiRecord.Unit?.Name || '—',
            remark: assignment.Remark || kpiRecord.Description || '—',
            evidenceRequired: Boolean(kpiRecord.IsEvedenceRequired || kpiRecord.IsEvidenceRequired),
            q1: quarterValues.q1,
            q2: quarterValues.q2,
            q3: quarterValues.q3,
            q4: quarterValues.q4,
          });
        });

        const normalized = Array.from(groupedThemes.entries())
          .sort(([leftTheme], [rightTheme]) => leftTheme.localeCompare(rightTheme))
          .map(([theme, subThemeMap]) => ({
            theme,
            subThemes: Array.from(subThemeMap.entries())
              .sort(([leftSubTheme], [rightSubTheme]) => leftSubTheme.localeCompare(rightSubTheme))
              .map(([name, kpisList]) => ({
                name,
                kpis: kpisList,
              })),
          }));

        setAllocatedThemes(normalized);
        setExpandedThemes(
          normalized.reduce(
            (accumulator, item) => ({
              ...accumulator,
              [item.theme]: true,
            }),
            {}
          )
        );
      } catch (loadErr) {
        if (!mounted) return;
        setError(loadErr?.response?.data?.message || 'Failed to load allocated KPIs.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAllocatedKpis();

    return () => {
      mounted = false;
    };
  }, [authUser?.id, canCascadeKpis, refreshToken, activePerformanceTab]);

  const countThemeKpis = (themeBlock) => themeBlock.subThemes.reduce((sum, subTheme) => sum + subTheme.kpis.length, 0);

  const themeOptions = useMemo(() => ['All Themes', ...allocatedThemes.map((item) => item.theme)], [allocatedThemes]);

  const visibleThemes = useMemo(() => {
    if (themeFilter === 'All Themes') return allocatedThemes;
    return allocatedThemes.filter((item) => item.theme === themeFilter);
  }, [allocatedThemes, themeFilter]);

  const toggleTheme = (themeName) => {
    setExpandedThemes((previous) => ({
      ...previous,
      [themeName]: !previous[themeName],
    }));
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-5 md:p-6">
      <div className="mb-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between shrink-0">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Performance</h1>
            <p className="text-sm text-muted-foreground">
              {isDerivedView ? 'Track Drived KPI execution by quarter' : 'Track KPI execution across themes and sub-themes by quarter'}
            </p>
          </div>

          {showPerformanceTabs && (
            <Tabs value={activePerformanceTab} onValueChange={setActivePerformanceTab}>
              <TabsList>
                <TabsTrigger value="original">Original Kpi</TabsTrigger>
                <TabsTrigger value="derived">Drived Kpi</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {!isDerivedView ? (
          <div className="flex items-center gap-2 pb-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filter by</span>
            <select
              value={themeFilter}
              onChange={(event) => setThemeFilter(event.target.value)}
              className="min-w-44 rounded-md border border-border px-3 py-1.5 text-sm text-foreground focus:outline-none"
            >
              {themeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 flex-1 space-y-4 overflow-y-scroll pr-2" style={{ scrollbarGutter: 'stable' }}>
        {loading ? <p className="text-sm text-muted-foreground">Loading allocated KPIs...</p> : null}

        {!loading && visibleThemes.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No KPI is active for performance tracking.
          </div>
        ) : null}

        {isDerivedView
          ? (() => {
              const derivedKpis = allocatedThemes.flatMap((themeBlock) => themeBlock.subThemes.flatMap((subTheme) => subTheme.kpis));
              if (!loading && derivedKpis.length === 0) return null;

              return (
                <section className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex w-full items-center justify-between border-b border-border bg-accent/50 px-4 py-3 text-left">
                    <h2 className="text-base font-semibold text-foreground md:text-lg">Drived KPI</h2>
                    <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {derivedKpis.length} KPIs
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-235 table-fixed border-collapse" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '26%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '12%' }} />
                      </colgroup>
                      <thead className="bg-background">
                        <tr className="border-y border-border text-left text-sm text-foreground">
                          <th className="px-4 py-3 font-semibold">KPI</th>
                          <th className="px-4 py-3 text-center font-semibold">Unit</th>
                          <th className="px-4 py-3 text-center font-semibold">Baseline</th>
                          <th className="px-4 py-3 text-center font-semibold">Target</th>
                          <th className="border-l border-border bg-primary/5 px-4 py-3 text-center font-semibold">Q1</th>
                          <th className="border-l border-border bg-primary/5 px-4 py-3 text-center font-semibold">Q2</th>
                          <th className="border-l border-border bg-primary/5 px-4 py-3 text-center font-semibold">Q3</th>
                          <th className="border-l border-border bg-primary/5 px-4 py-3 text-center font-semibold">Q4</th>
                          <th className="border-l border-border px-4 py-3 text-right font-semibold">Action Button</th>
                        </tr>
                      </thead>
                      <tbody>
                        {derivedKpis.map((kpi) => (
                          <tr key={kpi.id} className="border-b border-border text-sm text-foreground last:border-b-0">
                            <td className="px-4 py-4 align-top font-medium leading-6 whitespace-normal wrap-break-word">{kpi.name}</td>
                            <td className="px-4 py-4 align-top text-center whitespace-nowrap">{kpi.unit}</td>
                            <td className="px-4 py-4 align-top text-center whitespace-nowrap">{kpi.baseline}</td>
                            <td className="px-4 py-4 align-top text-center whitespace-nowrap">{kpi.target}</td>
                            <td className="border-l border-border bg-primary/5 px-4 py-4 align-top text-center whitespace-nowrap">{kpi.q1}</td>
                            <td className="border-l border-border bg-primary/5 px-4 py-4 align-top text-center whitespace-nowrap">{kpi.q2}</td>
                            <td className="border-l border-border bg-primary/5 px-4 py-4 align-top text-center whitespace-nowrap">{kpi.q3}</td>
                            <td className="border-l border-border bg-primary/5 px-4 py-4 align-top text-center whitespace-nowrap">{kpi.q4}</td>
                            <td className="border-l border-border px-4 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-purple-300 text-purple-600 hover:bg-purple-50"
                                  aria-label={`View ${kpi.name}`}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveKpi(kpi);
                                    setSubmissionModalOpen(true);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-300 text-green-600 hover:bg-green-50"
                                  aria-label={`Edit ${kpi.name}`}
                                >
                                  <PencilLine className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })()
          : visibleThemes.map((themeBlock) => {
              const isExpanded = Boolean(expandedThemes[themeBlock.theme]);
              const totalKpis = countThemeKpis(themeBlock);

              return (
                <section key={themeBlock.theme} className="overflow-hidden rounded-xl border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => toggleTheme(themeBlock.theme)}
                    className="flex w-full items-center justify-between border-b border-border bg-accent/50 px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`h-4 w-4 text-primary transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                      <h2 className="text-base font-semibold text-foreground md:text-lg">Theme: {themeBlock.theme}</h2>
                    </div>
                    <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">{totalKpis} KPIs</span>
                  </button>

                  {isExpanded && (
                    <div>
                      {themeBlock.subThemes.map((subTheme) => (
                        <div key={subTheme.name} className="border-b border-border last:border-b-0">
                          <div className="bg-muted/20 px-4 py-3 text-sm font-medium text-muted-foreground md:text-base">
                            Sub-theme: {subTheme.name}
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full min-w-235 table-fixed border-collapse" style={{ tableLayout: 'fixed' }}>
                              <colgroup>
                                <col style={{ width: '26%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '12%' }} />
                              </colgroup>
                              <thead className="bg-background">
                                <tr className="border-y border-border text-left text-sm text-foreground">
                                  <th className="px-4 py-3 font-semibold">KPI</th>
                                  <th className="px-4 py-3 text-center font-semibold">Unit</th>
                                  <th className="px-4 py-3 text-center font-semibold">Baseline</th>
                                  <th className="px-4 py-3 text-center font-semibold">Target</th>
                                  <th className="border-l border-border bg-primary/5 px-4 py-3 text-center font-semibold">Q1</th>
                                  <th className="border-l border-border bg-primary/5 px-4 py-3 text-center font-semibold">Q2</th>
                                  <th className="border-l border-border bg-primary/5 px-4 py-3 text-center font-semibold">Q3</th>
                                  <th className="border-l border-border bg-primary/5 px-4 py-3 text-center font-semibold">Q4</th>
                                  <th className="border-l border-border px-4 py-3 text-right font-semibold">Action Button</th>
                                </tr>
                              </thead>
                              <tbody>
                                {subTheme.kpis.map((kpi) => (
                                  <tr key={kpi.id} className="border-b border-border text-sm text-foreground last:border-b-0">
                                    <td className="px-4 py-4 align-top font-medium leading-6 whitespace-normal wrap-break-word">{kpi.name}</td>
                                    <td className="px-4 py-4 align-top text-center whitespace-nowrap">{kpi.unit}</td>
                                    <td className="px-4 py-4 align-top text-center whitespace-nowrap">{kpi.baseline}</td>
                                    <td className="px-4 py-4 align-top text-center whitespace-nowrap">{kpi.target}</td>
                                    <td className="border-l border-border bg-primary/5 px-4 py-4 align-top text-center whitespace-nowrap">
                                      {kpi.q1}
                                    </td>
                                    <td className="border-l border-border bg-primary/5 px-4 py-4 align-top text-center whitespace-nowrap">
                                      {kpi.q2}
                                    </td>
                                    <td className="border-l border-border bg-primary/5 px-4 py-4 align-top text-center whitespace-nowrap">
                                      {kpi.q3}
                                    </td>
                                    <td className="border-l border-border bg-primary/5 px-4 py-4 align-top text-center whitespace-nowrap">
                                      {kpi.q4}
                                    </td>
                                    <td className="border-l border-border px-4 py-4">
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          type="button"
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-purple-300 text-purple-600 hover:bg-purple-50"
                                          aria-label={`View ${kpi.name}`}
                                        >
                                          <Plus className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveKpi(kpi);
                                            setSubmissionModalOpen(true);
                                          }}
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-300 text-green-600 hover:bg-green-50"
                                          aria-label={`Edit ${kpi.name}`}
                                        >
                                          <PencilLine className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
      </div>

      <PerformanceSubmitModal
        open={submissionModalOpen}
        onOpenChange={(open) => {
          setSubmissionModalOpen(open);
          if (!open) {
            setActiveKpi(null);
          }
        }}
        kpi={activeKpi}
        initialValues={{
          title: activeKpi?.name || '',
          quarter: '',
          result: '',
          remark: '',
        }}
        saving={savingSubmission}
        onSubmit={async ({ quarter, result, remark, file }) => {
          if (!activeKpi) return;

          try {
            setSavingSubmission(true);

            const payload = new FormData();
            payload.append('KPIId', activeKpi.kpiId);
            payload.append('KPIResult', result);
            payload.append('Quarter', quarter);
            payload.append('Description', remark || activeKpi.name || '');

            if (file) {
              payload.append('EvidenceFile', file);
            }

            await api.post('/user-kpi-results', payload);

            setRefreshToken((previous) => previous + 1);

            notify('Performance submitted successfully.', 'success');
            setSubmissionModalOpen(false);
            setActiveKpi(null);
          } catch (submitErr) {
            notify(submitErr?.response?.data?.message || 'Failed to submit performance.', 'error');
          } finally {
            setSavingSubmission(false);
          }
        }}
      />
    </div>
  );
}

export default AssignedKpisPage;
