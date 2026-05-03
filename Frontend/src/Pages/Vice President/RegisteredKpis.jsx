import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import Button from '../../Components/UI/Button';
import { Badge } from '../../Components/UI/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../Components/UI/Tabs';
import { ListChecks, Send, Search } from 'lucide-react';
import { Input } from '../../Components/UI/Input';
import MultiSelect from '../../Components/UI/MultiSelect';
import AssignedKpiList from '../../Components/KPI/AssignedKpiList';
import { api } from '../../api/axios';

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

const RegisteredKpis = () => {
  const authUser = useSelector((state) => state.auth?.user);
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState('all');
  const [loadingAllocated, setLoadingAllocated] = useState(false);
  const [allocatedError, setAllocatedError] = useState('');
  const [allocatedRows, setAllocatedRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);

  // Assignment state
  const [selectedHIs, setSelectedHIs] = useState([]);
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [selectedKpis, setSelectedKpis] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadAllocatedKpis = async () => {
      setLoadingAllocated(true);
      setAllocatedError('');

      try {
        const [userKpiRes, kpiRes, kpiTypeRes, rolesRes, userRolesRes] = await Promise.all([
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
          api.get('/user-roles', { params: { t: Date.now() } }),
        ]);

        if (!mounted) return;

        const assignments = userKpiRes.data?.data || [];
        const kpis = kpiRes.data?.data || [];
        const kpiTypes = kpiTypeRes.data?.data || [];
        setRoles(rolesRes.data?.data || []);
        setUserRoles((userRolesRes.data?.data || []).filter(isActiveAssignment));

        const typeById = new Map(kpiTypes.map((type) => [type.Id, type]));
        const kpiById = new Map(kpis.map((kpi) => [kpi.Id, kpi]));

        const childrenByParent = new Map();
        kpiTypes.forEach((type) => {
          const key = type.ParentKPIID || '__root__';
          if (!childrenByParent.has(key)) childrenByParent.set(key, []);
          childrenByParent.get(key).push(type);
        });

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

        const rows = assignments
          .map((assignment) => {
            const kpiRecord = kpiById.get(assignment.KPIId);
            if (!kpiRecord) return null;

            const leaf = typeById.get(kpiRecord.KPITypeId);
            const subTheme = leaf?.ParentKPIID ? typeById.get(leaf.ParentKPIID) : null;
            const theme = subTheme?.ParentKPIID ? typeById.get(subTheme.ParentKPIID) : null;

            return {
              id: assignment.Id,
              no: buildCode(kpiRecord.KPITypeId),
              kpi: leaf?.KPIName || kpiRecord.KPIType?.KPIName || '—',
              theme: theme?.KPIName || '—',
              subTheme: subTheme?.KPIName || '—',
              unit: kpiRecord.Unit?.Code || kpiRecord.Unit?.Name || '—',
              weight: formatValue(kpiRecord.Weight),
              baseline: formatValue(assignment.Baseline ?? kpiRecord.Baseline),
              target: formatValue(kpiRecord.Target),
              remark: assignment.Remark || kpiRecord.Remark || kpiRecord.Description || '—',
            };
          })
          .filter(Boolean)
          .sort((left, right) => compareCodes(left.no, right.no));

        setAllocatedRows(rows);
      } catch (loadErr) {
        if (!mounted) return;
        setAllocatedError(loadErr?.response?.data?.message || 'Failed to load allocated KPIs.');
      } finally {
        if (mounted) setLoadingAllocated(false);
      }
    };

    loadAllocatedKpis();

    return () => {
      mounted = false;
    };
  }, [authUser?.id]);

  const availableThemes = useMemo(
    () => [...new Set(allocatedRows.map((row) => row.theme).filter((theme) => theme && theme !== '—'))],
    [allocatedRows]
  );

  const filteredAllocatedKpis = useMemo(
    () =>
      allocatedRows.filter((row) => {
        const matchesSearch = `${row.no} ${row.kpi} ${row.remark}`.toLowerCase().includes(search.toLowerCase());
        const matchesTheme = themeFilter === 'all' || row.theme === themeFilter;
        return matchesSearch && matchesTheme;
      }),
    [allocatedRows, search, themeFilter]
  );

  const assignableKpis = useMemo(
    () =>
      allocatedRows
        .filter((row) => selectedThemes.length === 0 || selectedThemes.includes(row.theme))
        .map((row) => ({
          id: row.id,
          label: `${row.no}: ${row.kpi} (${row.unit}, Weight: ${row.weight})`,
        })),
    [allocatedRows, selectedThemes]
  );

  const childOfficeOptions = useMemo(() => {
    const parentRoleId = String(authUser?.roleId || '');
    if (!parentRoleId) return [];

    const childRoles = roles.filter((role) => String(role.ParentRoleId || '') === parentRoleId);
    const childRoleIdsWithUsers = new Set(userRoles.map((assignment) => String(assignment?.RoleId || assignment?.Role?.Id || '')).filter(Boolean));

    return childRoles
      .filter((role) => childRoleIdsWithUsers.has(String(role.Id)))
      .map((role) => ({ id: role.Id, label: role.RoleName || 'Unnamed Unit' }));
  }, [roles, userRoles, authUser?.roleId]);

  useEffect(() => {
    if (!selectedHIs.length) return;
    const validIds = new Set(childOfficeOptions.map((option) => String(option.id)));
    const filtered = selectedHIs.filter((id) => validIds.has(String(id)));
    if (filtered.length !== selectedHIs.length) {
      setSelectedHIs(filtered);
    }
  }, [childOfficeOptions, selectedHIs]);

  useEffect(() => {
    if (!selectedThemes.length) return;
    const validThemes = new Set(availableThemes);
    const filtered = selectedThemes.filter((theme) => validThemes.has(theme));
    if (filtered.length !== selectedThemes.length) {
      setSelectedThemes(filtered);
    }
  }, [availableThemes, selectedThemes]);

  useEffect(() => {
    if (!selectedKpis.length) return;
    const validIds = new Set(assignableKpis.map((kpi) => String(kpi.id)));
    const filtered = selectedKpis.filter((id) => validIds.has(String(id)));
    if (filtered.length !== selectedKpis.length) {
      setSelectedKpis(filtered);
    }
  }, [assignableKpis, selectedKpis]);

  const handleAssign = () => {
    if (selectedHIs.length === 0 || selectedKpis.length === 0) {
      console.log('Selection Required', 'Please select at least one sub unit and one KPI.');
      return;
    }
    const hiNames = childOfficeOptions
      .filter((office) => selectedHIs.includes(office.id))
      .map((office) => office.label)
      .join(', ');
    console.log('KPIs Assigned Successfully', `${selectedKpis.length} KPI(s) assigned to ${hiNames}.`);
    setSelectedHIs([]);
    setSelectedThemes([]);
    setSelectedKpis([]);
  };

  return (
    <div className="space-y-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">KPI Allocation</h1>
        <p className="text-sm text-muted-foreground">View allocated KPIs and assign KPIs to higher institutions</p>
      </div>

      <Tabs defaultValue="list" className="w-full ">
        <TabsList className="flex justify-center w-full max-w-sm gap-2">
          <TabsTrigger value="list" className="flex items-center gap-2 px-4 py-2">
            <ListChecks className="w-4 h-4" /> List of KPIs
          </TabsTrigger>
          <TabsTrigger value="assign" className="flex items-center gap-2 px-4 py-2">
            <Send className="w-4 h-4" /> Assign KPIs
          </TabsTrigger>
        </TabsList>

        {/* LIST TAB */}
        <TabsContent value="list" className="space-y-4 mt-4">
          {allocatedError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{allocatedError}</p> : null}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search KPIs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant={themeFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setThemeFilter('all')}>
                All Themes
              </Button>
              {availableThemes.map((theme) => (
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
            kpis={filteredAllocatedKpis}
            emptyMessage={loadingAllocated ? 'Loading allocated KPIs...' : 'No KPI is allocated by your parent role.'}
          />

          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              Showing {filteredAllocatedKpis.length} of {allocatedRows.length} allocated KPIs
            </span>
            <Badge variant="secondary">{availableThemes.length} Themes</Badge>
          </div>
        </TabsContent>

        {/* ASSIGN TAB */}
        <TabsContent value="assign" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                Select Sub Unit(s)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect options={childOfficeOptions} value={selectedHIs} onChange={setSelectedHIs} placeholder="Select Sub Units..." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                Select Theme(s)
                <span className="text-xs text-muted-foreground font-normal ml-1">(filters KPIs below)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect options={availableThemes} value={selectedThemes} onChange={setSelectedThemes} placeholder="Select Themes..." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                Select KPI(s)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect options={assignableKpis} value={selectedKpis} onChange={setSelectedKpis} placeholder="Select KPIs..." />
              {assignableKpis.length === 0 && (
                <p className="text-center py-4 text-muted-foreground text-sm">No KPIs available for the selected themes.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Assignment Summary</p>
                <p className="text-xs text-muted-foreground">
                  {selectedHIs.length} Sub Unit(s) · {selectedThemes.length} Theme(s) · {selectedKpis.length} KPI(s)
                </p>
              </div>
              <Button onClick={handleAssign} className="gap-2" disabled={selectedHIs.length === 0 || selectedKpis.length === 0}>
                <Send className="w-4 h-4" /> Assign KPIs
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RegisteredKpis;
