import { useState } from 'react';

import PeriodsTable from '../components/PeriodsTable';
import YearsTable from '../components/YearsTable';
import { useFiscalYears } from '../hooks/usePlanning';

const PlanningPage = () => {
  const { data: years = [], isLoading, error } = useFiscalYears();
  const [selectedId, setSelectedId] = useState(null);
  const year = years.find((candidate) => candidate.id === selectedId) ?? years.find((candidate) => candidate.status === 'ACTIVE') ?? years[0];

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fiscal Years & Periods</h1>
          <p className="text-sm text-muted-foreground">The planning calendar every contract and report follows. Click a year to see its periods.</p>
        </div>
        <YearsTable years={years} selectedId={year?.id} onSelect={setSelectedId} isLoading={isLoading} error={error} />
        {year && <PeriodsTable key={year.id} year={year} />}
      </main>
    </div>
  );
};

export default PlanningPage;
