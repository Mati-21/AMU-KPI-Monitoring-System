import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../Components/UI/Badge';
import { Search } from 'lucide-react';
import { Input } from '../../Components/UI/Input';
import CustomSelect from '../../Components/UI/CustomSelect';
import AssignedKpiList from '../../Components/KPI/AssignedKpiList';
import { api } from '../../api/axios';
import { useKpisQuery, useKpiTypesQuery } from '../../Hooks/Queries/useKpis';

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

  // Queries
  const { data: kpis = [], isLoading: loadingKpis, error: kpiError } = useKpisQuery();
  const { data: kpiTypes = [], isLoading: loadingTypes, error: typeError } = useKpiTypesQuery();

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

  const registeredKpis = useMemo(
    () =>
      kpis
        .map((kpi) => {
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

          return {
            id: kpi.Id,
            no: subThemeCode && sequentialRank ? `${subThemeCode}.${sequentialRank}` : buildCode(kpi.KPITypeId),
            kpi: leaf?.KPIName || kpi.KPIType?.KPIName || '—',
            theme: theme?.KPIName || '—',
            subTheme: subTheme?.KPIName || '—',
            unit: kpi.Unit?.Code || kpi.Unit?.Name || '—',
            weight: formatValue(kpi.Weight),
            baseline: formatValue(kpi.Baseline),
            target: formatValue(kpi.Target),
            remark: kpi.Remark || kpi.Description || '—',
            isEvidenceRequired: kpi.IsEvedenceRequired || false,
          };
        })
        .sort((left, right) => compareCodes(left.no, right.no)),
    [kpis, typeById, childrenByParent]
  );

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

  const filteredKpis = registeredKpis.filter((k) => {
    const matchesSearch = k.kpi.toLowerCase().includes(search.toLowerCase()) || k.no.includes(search);
    const matchesTheme = themeFilter === ALL_THEMES_OPTION || k.theme === themeFilter;
    const matchesSubTheme = subThemeFilter === ALL_SUB_THEMES_OPTION || k.subTheme === subThemeFilter;
    return matchesSearch && matchesTheme && matchesSubTheme;
  });

  return (
    <div className="space-y-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Registered KPIs</h1>
        <p className="text-sm text-muted-foreground">View all KPIs registered by admin</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
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

      <AssignedKpiList kpis={filteredKpis} />

      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>{loading ? 'Loading registered KPIs...' : `Showing ${filteredKpis.length} of ${registeredKpis.length} KPIs`}</span>
        <Badge variant="secondary">{themes.length} Themes</Badge>
      </div>
    </div>
  );
};

export default RegisteredKpis;
