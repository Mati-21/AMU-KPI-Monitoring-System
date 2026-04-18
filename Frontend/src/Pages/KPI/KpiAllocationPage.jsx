import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import Button from '../../Components/UI/Button';
import Checkbox from '../../Components/UI/Checkbox';
import { Input } from '../../Components/UI/Input';
import AssignedKpiList from '../../Components/KPI/AssignedKpiList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../Components/UI/ProfileButtonTab';
import { Search } from 'lucide-react';
import { useNotification } from '../../Context/NotificationContext';
import { api } from '../../api/axios';
import MultiSelect from '../../Components/UI/MultiSelect';

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

const isActiveAssignment = (assignment) => {
  if (!assignment) return false;
  if (assignment.IsArchived) return false;
  if (!assignment.ToDate) return true;
  return new Date(assignment.ToDate).getTime() >= Date.now();
};

const KpiAllocationPage = () => {
  const { notify } = useNotification();
  const authUser = useSelector((state) => state.auth?.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [themeFilter, setThemeFilter] = useState('all');
  const [selectedOffice, setSelectedOffice] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState([]);
  const [selectedKpi, setSelectedKpi] = useState([]);
  const [includeCurrentRole, setIncludeCurrentRole] = useState(false);
  const [roles, setRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [allocatedAssignments, setAllocatedAssignments] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [kpiTypes, setKpiTypes] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const [rolesRes, userRolesRes, userKpiRes, kpiRes, kpiTypeRes] = await Promise.all([
          api.get('/roles', { params: { t: Date.now() } }),
          api.get('/user-roles', { params: { t: Date.now() } }),
          api.get('/user-kpis', { params: { scope: 'mine', fromParent: true, t: Date.now() } }),
          api.get('/kpis', { params: { t: Date.now() } }),
          api.get('/kpi-types', { params: { t: Date.now() } }),
        ]);

        if (!mounted) return;

        setRoles(rolesRes.data?.data || []);
        setUserRoles(userRolesRes.data?.data || []);
        setAllocatedAssignments(userKpiRes.data?.data || []);
        setKpis(kpiRes.data?.data || []);
        setKpiTypes(kpiTypeRes.data?.data || []);
      } catch (loadErr) {
        if (!mounted) return;
        setError(loadErr?.response?.data?.message || 'Failed to load assign KPI data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const typeById = useMemo(() => new Map(kpiTypes.map((type) => [type.Id, type])), [kpiTypes]);

  const childrenByParent = useMemo(() => {
    const map = new Map();
    kpiTypes.forEach((type) => {
      const key = type.ParentKPIID || '__root__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(type);
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

  const kpiRows = useMemo(
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
          };
        })
        .sort((left, right) => compareCodes(left.no, right.no)),
    [kpis, typeById, childrenByParent]
  );

  const kpiRowById = useMemo(() => new Map(kpiRows.map((row) => [row.id, row])), [kpiRows]);

  const allocatedKpiRows = useMemo(() => {
    return allocatedAssignments
      .map((assignment) => {
        const row = kpiRowById.get(assignment.KPIId);
        if (!row) return null;

        return {
          ...row,
          baseline: formatValue(assignment.Baseline ?? row.baseline),
          remark: assignment.Remark || row.remark,
        };
      })
      .filter(Boolean)
      .sort((left, right) => compareCodes(left.no, right.no));
  }, [allocatedAssignments, kpiRowById]);

  const activeUserRoles = useMemo(() => userRoles.filter(isActiveAssignment), [userRoles]);

  const childOfficeRoles = useMemo(() => {
    const childRoles = roles.filter((role) => String(role.ParentRoleId || '') === String(authUser?.roleId || ''));

    const childRoleIdsWithUsers = new Set(
      activeUserRoles.map((assignment) => String(assignment?.RoleId || assignment?.Role?.Id || '')).filter(Boolean)
    );

    return childRoles.filter((role) => childRoleIdsWithUsers.has(String(role.Id)));
  }, [roles, authUser?.roleId, activeUserRoles]);

  const officeOptions = useMemo(() => childOfficeRoles.map((role) => ({ id: role.Id, label: role.RoleName || 'Unnamed Unit' })), [childOfficeRoles]);

  const currentRoleOption = useMemo(
    () => ({
      id: authUser?.roleId,
      label: authUser?.roleName || authUser?.role || 'Current Role',
    }),
    [authUser?.roleId, authUser?.roleName, authUser?.role]
  );

  const officeOptionsWithCurrent = useMemo(
    () =>
      includeCurrentRole && currentRoleOption.id
        ? [currentRoleOption, ...officeOptions.filter((option) => String(option.id) !== String(currentRoleOption.id))]
        : officeOptions,
    [officeOptions, includeCurrentRole, currentRoleOption]
  );

  const currentRole = useMemo(() => roles.find((role) => String(role.Id) === String(authUser?.roleId || '')) || null, [roles, authUser?.roleId]);

  const hasParentRole = Boolean(currentRole?.ParentRoleId);

  const sourceKpiRows = useMemo(() => (hasParentRole ? allocatedKpiRows : kpiRows), [hasParentRole, allocatedKpiRows, kpiRows]);

  const allThemes = useMemo(() => [...new Set(sourceKpiRows.map((row) => row.theme).filter((theme) => theme && theme !== '—'))], [sourceKpiRows]);

  const kpiOptionsByTheme = useMemo(
    () =>
      sourceKpiRows
        .filter((row) => selectedTheme.length === 0 || selectedTheme.includes(row.theme))
        .map((row) => ({ id: row.id, label: `${row.no}: ${row.kpi} (${row.unit}, Weight: ${row.weight})` }))
        .filter((item, index, items) => items.findIndex((entry) => entry.id === item.id) === index),
    [sourceKpiRows, selectedTheme]
  );

  const filteredKpis = useMemo(
    () =>
      sourceKpiRows.filter((row) => {
        const matchesSearch = `${row.kpi} ${row.remark}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTheme = themeFilter === 'all' || row.theme === themeFilter;
        return matchesSearch && matchesTheme;
      }),
    [sourceKpiRows, searchTerm, themeFilter]
  );

  const handleAssign = () => {
    if (selectedOffice.length === 0 || selectedTheme.length === 0 || selectedKpi.length === 0) {
      notify('Please select at least one sub unit, one theme, and one KPI.', 'warning');
      return;
    }

    const selectedOfficeIds = new Set(selectedOffice);
    if (includeCurrentRole && currentRoleOption.id) {
      selectedOfficeIds.add(currentRoleOption.id);
    }

    const selectedKpiRecords = sourceKpiRows.filter(
      (row) => selectedKpi.includes(row.id) && (selectedTheme.length === 0 || selectedTheme.includes(row.theme))
    );

    if (selectedKpiRecords.length === 0) {
      notify('Invalid KPI selection.', 'warning');
      return;
    }

    const officeUsers = activeUserRoles
      .filter((assignment) => selectedOfficeIds.has(String(assignment?.RoleId || assignment?.Role?.Id || '')))
      .map((assignment) => assignment.UserId)
      .filter(Boolean);

    const uniqueUserIds = [...new Set(officeUsers)];

    if (!uniqueUserIds.length) {
      notify('No active users found under the selected sub units.', 'warning');
      return;
    }

    Promise.all(
      selectedKpiRecords.flatMap((kpiRecord) => uniqueUserIds.map((userId) => api.post('/user-kpis', { KPIId: kpiRecord.id, UserId: userId })))
    )
      .then(() => {
        notify(`Selected KPI(s) assigned to ${selectedOfficeIds.size} sub unit(s).`, 'success');
        setSelectedOffice([]);
        setSelectedTheme([]);
        setSelectedKpi([]);
        setIncludeCurrentRole(false);
      })
      .catch((assignErr) => {
        notify(assignErr?.response?.data?.message || 'Failed to assign KPI.', 'error');
      });
  };

  useEffect(() => {
    if (selectedOffice.length === 0) return;
    const validIds = new Set(officeOptionsWithCurrent.map((option) => String(option.id)));
    const filtered = selectedOffice.filter((id) => validIds.has(String(id)));
    if (filtered.length !== selectedOffice.length) {
      setSelectedOffice(filtered);
    }
  }, [officeOptionsWithCurrent, selectedOffice]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">KPI Assignment</h1>
        <p className="text-sm text-muted-foreground">Assign KPIs to one-level child offices based on theme</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Tabs defaultValue="view">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="view">Assigned KPI</TabsTrigger>
          <TabsTrigger value="assign">Assign KPI</TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="space-y-4 mt-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-end">
            <div className="relative min-w-0 md:w-70">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search KPIs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button variant={themeFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setThemeFilter('all')}>
                All Themes
              </Button>
              {allThemes.map((theme) => (
                <Button
                  key={theme}
                  variant={themeFilter === theme ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setThemeFilter(theme)}
                  className="text-xs"
                >
                  {theme}
                </Button>
              ))}
            </div>
          </div>

          <AssignedKpiList
            kpis={filteredKpis}
            emptyMessage={loading ? 'Loading KPIs...' : hasParentRole ? 'No KPI is allocated by your parent role.' : 'No registered KPIs found.'}
          />
        </TabsContent>

        <TabsContent value="assign" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign KPI</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <MultiSelect
                  options={officeOptionsWithCurrent}
                  value={selectedOffice}
                  onChange={setSelectedOffice}
                  placeholder="Select Sub Unit(s)"
                />

                <MultiSelect
                  options={allThemes}
                  value={selectedTheme}
                  onChange={(themesSelected) => {
                    setSelectedTheme(themesSelected);
                    setSelectedKpi([]);
                  }}
                  placeholder="Select Theme(s)"
                />

                <MultiSelect options={kpiOptionsByTheme} value={selectedKpi} onChange={setSelectedKpi} placeholder="Select KPI(s)" />
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={includeCurrentRole} onCheckedChange={(checked) => setIncludeCurrentRole(Boolean(checked))} />
                Include current role
              </label>

              <Button onClick={handleAssign} disabled={loading}>
                Assign KPI
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KpiAllocationPage;
