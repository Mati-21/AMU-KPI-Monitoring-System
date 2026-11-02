import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import TabButton from '../../../shared/components/ui/TabButton';
import { useCan } from '../../03-access-control/hooks/useCan';
import CurrenciesPanel from './CurrenciesPanel';
import FrequenciesPanel from './FrequenciesPanel';
import ImportKpi from './ImportKpi';
import KpiList from './KpiList';
import RegisterKpi from './RegisterKpi';
import ScalesPanel from './ScalesPanel';
import ThemesPanel from './ThemesPanel';
import UnitsPanel from './UnitsPanel';

const PANELS = {
  themes: { label: 'Themes', Panel: ThemesPanel },
  units: { label: 'Units', Panel: UnitsPanel },
  frequencies: { label: 'Frequencies', Panel: FrequenciesPanel },
  scales: { label: 'Scales', Panel: ScalesPanel },
  currencies: { label: 'Currencies', Panel: CurrenciesPanel },
};

const KpiManagement = () => {
  const can = useCan();
  const [searchParams, setSearchParams] = useSearchParams();
  // { kpi } edits it, { replaces } registers its replacement, {} registers a new one
  const [formFor, setFormFor] = useState(null);
  const requested = searchParams.get('tab');
  const tab = formFor ? 'form' : (PANELS[requested] && requested) || (['register', 'import'].includes(requested) && can('kpi:create') ? requested : 'list');

  const changeTab = (next) => {
    setFormFor(null);
    setSearchParams(next === 'list' ? {} : { tab: next }, { replace: true });
  };

  const finishForm = () => changeTab('list');
  const Panel = PANELS[tab]?.Panel;

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">KPI Management</h1>
          <p className="text-sm text-muted-foreground">The university's master list of KPIs and everything they are built from.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <TabButton label="KPIs" value="list" activeValue={tab} onChange={changeTab} />
          {can('kpi:create') && <TabButton label="Register KPI" value="register" activeValue={tab} onChange={changeTab} />}
          {can('kpi:create') && <TabButton label="Mass Register" value="import" activeValue={tab} onChange={changeTab} />}
          {Object.entries(PANELS).map(([value, { label }]) => (
            <TabButton key={value} label={label} value={value} activeValue={tab} onChange={changeTab} />
          ))}
        </div>

        {tab === 'list' && <KpiList onEdit={(kpi) => setFormFor({ kpi })} onReplace={(replaces) => setFormFor({ replaces })} />}
        {tab === 'register' && <RegisterKpi onDone={finishForm} onCancel={finishForm} />}
        {tab === 'import' && <ImportKpi onDone={finishForm} />}
        {tab === 'form' &&<RegisterKpi key={formFor.kpi?.id ?? formFor.replaces?.id} kpi={formFor.kpi} replaces={formFor.replaces} onDone={finishForm} onCancel={finishForm} />}
        {Panel && <Panel />}
      </main>
    </div>
  );
};

export default KpiManagement;
