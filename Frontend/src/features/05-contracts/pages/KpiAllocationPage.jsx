import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { useFiscalYears } from '../../06-reporting-periods/hooks/usePlanning';
import { optionLabel } from '../../10-system/lib/settingValues';
import ContractsTable from '../components/ContractsTable';
import RejectionHistory from '../components/RejectionHistory';
import { useContracts } from '../hooks/useContracts';

const KpiAllocationPage = () => {
  const { data: years = [], isLoading: yearsLoading } = useFiscalYears();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [showHistory, setShowHistory] = useState(false);
  const year = years.find((candidate) => candidate.id === params.get('year')) ?? years.find((candidate) => candidate.status === 'ACTIVE') ?? years[0];
  const { data = [], isLoading, error } = useContracts(year?.id);
  // KPIs start at the self contract, so it comes first
  const contracts = [...data].sort((a, b) => Number(Boolean(a.assigningOfficeId)) - Number(Boolean(b.assigningOfficeId)));

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">KPI Assignment</h1>
            <p className="text-sm text-muted-foreground">Contracts between each office and the office above it, and the KPIs they hold.</p>
          </div>
          {year && (
            <div className="w-56">
              <CustomSelect compact options={years.map((item) => ({ value: item.id, label: `${item.name} (${optionLabel(item.status)})` }))} value={year.id} onChange={(next) => setParams({ year: next })} />
            </div>
          )}
        </div>

        {!yearsLoading && !year && <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">There are no fiscal years yet. Add one under Fiscal Years first.</p>}
        {year && showHistory && <RejectionHistory year={year} onBack={() => setShowHistory(false)} />}
        {year && !showHistory && <ContractsTable year={year} contracts={contracts} onSelect={(id) => navigate(`/assign-kpi/${id}`)} onShowHistory={() => setShowHistory(true)} isLoading={isLoading} error={error} />}
      </main>
    </div>
  );
};

export default KpiAllocationPage;
