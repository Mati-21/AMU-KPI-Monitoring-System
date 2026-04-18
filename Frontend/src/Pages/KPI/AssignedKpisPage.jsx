import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { ChevronDown, Eye, PencilLine, Filter } from 'lucide-react';
import { api } from '../../api/axios';

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric.toString();
};

function AssignedKpisPage() {
  const authUser = useSelector((state) => state.auth?.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [themeFilter, setThemeFilter] = useState('All Themes');
  const [allocatedThemes, setAllocatedThemes] = useState([]);
  const [expandedThemes, setExpandedThemes] = useState({});

  useEffect(() => {
    let mounted = true;

    const loadAllocatedKpis = async () => {
      setLoading(true);
      setError('');

      try {
        const [userKpiRes, kpiRes, kpiTypeRes] = await Promise.all([
          api.get('/user-kpis', {
            params: {
              scope: 'mine',
              fromParent: true,
              t: Date.now(),
            },
          }),
          api.get('/kpis', { params: { t: Date.now() } }),
          api.get('/kpi-types', { params: { t: Date.now() } }),
        ]);

        if (!mounted) return;

        const assignments = userKpiRes.data?.data || [];
        const kpis = kpiRes.data?.data || [];
        const kpiTypes = kpiTypeRes.data?.data || [];

        const typeById = new Map(kpiTypes.map((type) => [type.Id, type]));
        const kpiById = new Map(kpis.map((kpi) => [kpi.Id, kpi]));
        const groupedThemes = new Map();

        assignments.forEach((assignment) => {
          const kpiRecord = kpiById.get(assignment.KPIId);
          if (!kpiRecord) return;

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
            name: leaf?.KPIName || kpiRecord.KPIType?.KPIName || '—',
            baseline: formatValue(assignment.Baseline ?? kpiRecord.Baseline),
            target: formatValue(kpiRecord.Target),
            q1: '-',
            q2: '-',
            q3: '-',
            q4: '-',
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
  }, [authUser?.id]);

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Assigned KPIs</h1>
          <p className="text-sm text-muted-foreground">Track KPI performance across themes and sub-themes by quarter</p>
        </div>

        <div className="flex items-center gap-2">
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
            No KPI is allocated by your parent role.
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
                      <div className="bg-muted/20 px-4 py-3 text-sm font-medium text-muted-foreground md:text-base">Sub-theme: {subTheme.name}</div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-235 table-fixed border-collapse" style={{ tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: '34%' }} />
                            <col style={{ width: '9%' }} />
                            <col style={{ width: '9%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '8%' }} />
                          </colgroup>
                          <thead className="bg-background">
                            <tr className="border-y border-border text-left text-sm text-foreground">
                              <th className="px-4 py-3 font-semibold">KPI Name</th>
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
                                <td className="px-4 py-4 align-top font-medium leading-6 whitespace-normal wrap-break-word">{kpi.name}</td>
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
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50"
                                      aria-label={`View ${kpi.name}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-300 text-emerald-600 hover:bg-emerald-50"
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
    </div>
  );
}

export default AssignedKpisPage;
