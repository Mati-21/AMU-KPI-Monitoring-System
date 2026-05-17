import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { ChevronDown, Eye, PencilLine, Filter, Plus } from 'lucide-react';
import { api } from '../../api/axios';
import { useNotification } from '../../Context/NotificationContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../Components/UI/Tabs';
import PerformanceSubmitModal from '../../Components/KPI/PerformanceSubmitModal';
import PerformanceDetailModal from '../../Components/KPI/PerformanceDetailModal';
import permissionUtils from '../../lib/permissionUtils';
import { useRolesQuery } from '../../Hooks/Queries/useRoles';
import { 
  useKpisQuery, 
  useKpiTypesQuery, 
  useUserKpisQuery,
  useSubmitPerformanceMutation
} from '../../Hooks/Queries/useKpis';

import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../Config/queryKeys';

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric.toString();
};

const EMPTY_ARRAY = [];
const MINE_PARAMS = { scope: 'mine' };
const MINE_PARENT_PARAMS = { scope: 'mine', fromParent: true };

function AssignedKpisPage() {
  const queryClient = useQueryClient();
  const { notify } = useNotification();
  const authUser = useSelector((state) => state.auth?.user);
  const userPermissions = authUser?.permissions || [];
  const [themeFilter, setThemeFilter] = useState('All Themes');
  const [expandedThemes, setExpandedThemes] = useState({});
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [activeKpi, setActiveKpi] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [submissionInitialValues, setSubmissionInitialValues] = useState(null);
  // Removed activePerformanceTab and derived view logic

  // Queries
  const { data: roles = EMPTY_ARRAY, isLoading: loadingRoles, error: errorRoles } = useRolesQuery();
  const { data: kpis = EMPTY_ARRAY, isLoading: loadingKpis, error: errorKpis } = useKpisQuery();
  const { data: kpiTypes = EMPTY_ARRAY, isLoading: loadingTypes, error: errorTypes } = useKpiTypesQuery();
  const { data: allAssignments = EMPTY_ARRAY, isLoading: loadingAll, error: errorAll } = useUserKpisQuery(MINE_PARAMS);
  const { data: fromParentAssignments = EMPTY_ARRAY, isLoading: loadingParent, error: errorParent } = useUserKpisQuery(MINE_PARENT_PARAMS);
  const { data: sentAssignments = EMPTY_ARRAY, isLoading: loadingSent, error: errorSent } = useUserKpisQuery({ scope: 'sent' });

  const queryLoading = loadingRoles || loadingKpis || loadingTypes || loadingAll || loadingParent || loadingSent;
  const queryError = errorRoles || errorKpis || errorTypes || errorAll || errorParent || errorSent;

  // Mutations
  const submitPerformanceMutation = useSubmitPerformanceMutation();

  const canCascadeKpis = useMemo(
    () =>
      permissionUtils.hasPermission(userPermissions, [
        permissionUtils.permissionKey('create', 'KPI Allocation'),
        permissionUtils.permissionKey('view', 'KPI Allocation'),
      ]),
    [userPermissions]
  );

  const { allocatedThemes, loading, error } = useMemo(() => {
    const currentRoleId = String(authUser?.roleId || authUser?.RoleId || authUser?.currentRole?.Id || authUser?.currentRole?.RoleId || '');
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

    // This logic runs during render, so it shouldn't call state setters directly
    // but the original code did it in useEffect. We'll handle showPerformanceTabs separately or keep it as is.
    
    const assignmentById = new Map();
    [...allAssignments, ...fromParentAssignments].forEach((assignment) => {
      if (!assignment?.Id) return;
      if (!assignmentById.has(assignment.Id)) {
        assignmentById.set(assignment.Id, assignment);
      }
    });

    const combinedAssignments = [...assignmentById.values()];
    const fromParentAssignmentIds = new Set(fromParentAssignments.map((assignment) => assignment.Id));

    // Identify KPIs that have been delegated (sent to others)
    const currentUserId = String(authUser?.Id || authUser?.id || '');
    const delegatedKpiKeys = new Set(
      sentAssignments
        .filter((a) => String(a.UserId) !== currentUserId)
        .map((a) => String(a.KPIId))
    );

    const assignments = combinedAssignments.filter((assignment) => {
      // Delegation Logic: If the user has assigned this same KPI to a child role,
      // remove it from their own performance page (hand-off).
      if (delegatedKpiKeys.has(String(assignment.KPIId))) {
        return false;
      }

      return true;
    });

    const isDerivedView = false; // Forced to false after removal of tab

    const typeById = new Map(kpiTypes.map((type) => [type.Id, type]));
    const kpiById = new Map(kpis.map((kpi) => [kpi.Id, kpi]));
    const groupedThemes = new Map();

    assignments.forEach((assignment) => {
      const kpiRecord = kpiById.get(assignment.KPIId);
      if (!kpiRecord) return;

      const targetValue = assignment.AssignedTarget ?? kpiRecord.Target;

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

      const themeName = theme?.KPIName || 'Uncategorized Theme';
      const subThemeName = subTheme?.KPIName || 'Uncategorized Sub-Theme';

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
        name: (assignment.Name || assignment.Remark || leaf?.KPIName || kpiRecord.KPIType?.KPIName || '—').trim(),
        baseline: formatValue(assignment.Baseline ?? kpiRecord.Baseline),
        target: formatValue(targetValue),
        theme: themeName,
        subTheme: subThemeName,
        unit: kpiRecord.Unit?.Code || kpiRecord.Unit?.Name || '—',
        remark: assignment.Remark || kpiRecord.Description || '—',
        evidenceRequired: Boolean(kpiRecord.IsEvedenceRequired || kpiRecord.IsEvidenceRequired),
        q1: quarterValues.q1,
        q2: quarterValues.q2,
        q3: quarterValues.q3,
        q4: quarterValues.q4,
        quarterlyResults: quarterlyResults,
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

    return { 
      allocatedThemes: normalized, 
      loading: queryLoading, 
      error: queryError?.response?.data?.message || queryError?.message || '' 
    };
  }, [authUser, roles, kpis, kpiTypes, allAssignments, fromParentAssignments, sentAssignments, canCascadeKpis, queryLoading, queryError]);

  useEffect(() => {
    const handleDataChange = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('amu:report-data-changed', handleDataChange);
      window.addEventListener('storage', (event) => {
        if (event.key === 'amu:report-data-changed') {
          handleDataChange();
        }
      });
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('amu:report-data-changed', handleDataChange);
      }
    };
  }, [queryClient]);

  useEffect(() => {
    // showPerformanceTabs logic removed
  }, [authUser, roles]);

  useEffect(() => {
    if (allocatedThemes.length > 0 && Object.keys(expandedThemes).length === 0) {
      setExpandedThemes(
        allocatedThemes.reduce(
          (accumulator, item) => ({
            ...accumulator,
            [item.theme]: true,
          }),
          {}
        )
      );
    }
  }, [allocatedThemes]);

  const countThemeKpis = (themeBlock) => themeBlock.subThemes.reduce((sum, subTheme) => sum + subTheme.kpis.length, 0);

  const themeOptions = useMemo(() => ['All Themes', 'Evidence Based', ...allocatedThemes.map((item) => item.theme)], [allocatedThemes]);

  const visibleThemes = useMemo(() => {
    if (themeFilter === 'All Themes') return allocatedThemes;
    
    if (themeFilter === 'Evidence Based') {
      return allocatedThemes.map(themeBlock => ({
        ...themeBlock,
        subThemes: themeBlock.subThemes.map(subTheme => ({
          ...subTheme,
          kpis: subTheme.kpis.filter(kpi => kpi.evidenceRequired)
        })).filter(subTheme => subTheme.kpis.length > 0)
      })).filter(themeBlock => themeBlock.subThemes.length > 0);
    }
    
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
              Track KPI execution across themes and sub-themes by quarter
            </p>
          </div>
        </div>

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
      </div>

      {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 flex-1 space-y-4 overflow-y-scroll pr-2" style={{ scrollbarGutter: 'stable' }}>
        {loading ? <p className="text-sm text-muted-foreground">Loading allocated KPIs...</p> : null}

        {!loading && visibleThemes.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No KPI is active for performance tracking.
          </div>
        ) : null}

        {visibleThemes.map((themeBlock) => {
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
                                  <th className="border-l border-border px-4 py-3 text-right font-semibold">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {subTheme.kpis.map((kpi) => (
                                    <tr key={kpi.id} className="border-b border-border text-sm text-foreground last:border-b-0">
                                      <td className="px-4 py-4 align-top font-medium leading-6 whitespace-normal wrap-break-word">
                                        <div className="flex flex-col gap-1">
                                          {kpi.name}
                                          {(() => {
                                            const qValues = [kpi.q1, kpi.q2, kpi.q3, kpi.q4].map((v) => {
                                              const num = parseFloat(v);
                                              return isNaN(num) ? 0 : num;
                                            });
                                            const total = qValues.reduce((sum, v) => sum + v, 0);
                                            const target = parseFloat(kpi.target);
                                            const baseline = parseFloat(kpi.baseline);
                                            const goal = target - (isNaN(baseline) ? 0 : baseline);

                                            if (!isNaN(target) && goal > 0 && total >= goal) {
                                              return (
                                                <span className="inline-flex w-fit items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 uppercase tracking-wider">
                                                  Achieved
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      </td>
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
                                         onClick={() => {
                                           setActiveKpi(kpi);
                                           setDetailModalOpen(true);
                                         }}
                                         className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50"
                                         title="View Performance Detail"
                                         aria-label={`View ${kpi.name} performance detail`}
                                       >
                                         <Eye className="h-4 w-4" />
                                       </button>
                                       <button
                                         type="button"
                                         onClick={() => {
                                           setActiveKpi(kpi);
                                           setSubmissionInitialValues({
                                             quarter: '',
                                             result: '',
                                             remark: '',
                                           });
                                           setSubmissionModalOpen(true);
                                         }}
                                         className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50"
                                         title="Add Performance"
                                         aria-label={`Add ${kpi.name} performance`}
                                       >
                                         <Plus className="h-4 w-4" />
                                       </button>
                                       <button
                                         type="button"
                                         onClick={() => {
                                           const latest = Array.isArray(kpi.quarterlyResults) && kpi.quarterlyResults.length > 0
                                             ? [...kpi.quarterlyResults].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]
                                             : null;
                                           setActiveKpi(kpi);
                                           setSubmissionInitialValues({
                                             quarter: latest?.quarter || '',
                                             result: latest?.result || '',
                                             remark: latest?.remark || '',
                                           });
                                           setSubmissionModalOpen(true);
                                         }}
                                         className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-300 text-green-600 hover:bg-green-50"
                                         title="Edit Latest Performance"
                                         aria-label={`Edit ${kpi.name} performance`}
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
        initialValues={submissionInitialValues || {
          title: activeKpi?.name || '',
          quarter: '',
          result: '',
          remark: '',
        }}
        saving={submitPerformanceMutation.isPending}
        onSubmit={async ({ quarter, result, remark, file }) => {
          if (!activeKpi) return;

          // Sequential validation: Ensure previous quarter exists unless editing current
          const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
          const qIdx = QUARTERS.indexOf(quarter);
          if (qIdx > 0) {
            const prevQ = QUARTERS[qIdx - 1];
            const results = Array.isArray(activeKpi.quarterlyResults) ? activeKpi.quarterlyResults : [];
            const hasPrev = results.some((r) => String(r.quarter || '').toUpperCase() === prevQ);
            const hasCurrent = results.some((r) => String(r.quarter || '').toUpperCase() === quarter.toUpperCase());

            if (!hasPrev && !hasCurrent) {
              notify(`Submission blocked: Please submit ${prevQ} performance before ${quarter}.`, 'error');
              return;
            }
          }

          const payload = new FormData();
          payload.append('KPIId', activeKpi.kpiId);
          payload.append('UserKPIId', activeKpi.id);
          payload.append('KPIResult', result);
          payload.append('Quarter', quarter);
          payload.append('Description', remark || activeKpi.name || '');

          if (file) {
            payload.append('EvidenceFile', file);
          }

          submitPerformanceMutation.mutate(payload, {
            onSuccess: () => {
              notify('Performance submitted successfully.', 'success');
              setSubmissionModalOpen(false);
              setActiveKpi(null);
            },
            onError: (err) => {
              notify(err?.response?.data?.message || 'Failed to submit performance.', 'error');
            }
          });
        }}
      />
      <PerformanceDetailModal
        open={detailModalOpen}
        onOpenChange={(open) => {
          setDetailModalOpen(open);
          if (!open) {
            setActiveKpi(null);
          }
        }}
        kpi={activeKpi}
      />
    </div>
  );
}

export default AssignedKpisPage;
