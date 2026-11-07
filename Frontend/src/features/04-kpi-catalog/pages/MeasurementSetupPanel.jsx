import { useSearchParams } from 'react-router-dom';

import { getTabTriggerClass } from '../../../shared/components/ui/Tabs';
import CurrenciesPanel from './CurrenciesPanel';
import ScalesPanel from './ScalesPanel';
import UnitsPanel from './UnitsPanel';

// What a KPI result is measured in. Each part keeps its own screen; they are grouped because they are used together.
const SECTIONS = {
  units: { label: 'Units', Panel: UnitsPanel },
  scales: { label: 'Scales', Panel: ScalesPanel },
  currencies: { label: 'Currencies', Panel: CurrenciesPanel },
};

/**
 * Units, scales and currencies in one place. The section is kept in the address (?tab=measurement&section=scales),
 * so a link can open it directly.
 */
const MeasurementSetupPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // The older addresses (?tab=units, ?tab=scales, ?tab=currencies) open the matching section
  const requested = searchParams.get('section') ?? searchParams.get('tab');
  const section = SECTIONS[requested] ? requested : 'units';
  const { Panel } = SECTIONS[section];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Measurement setup">
        {Object.entries(SECTIONS).map(([value, { label }]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={value === section}
            onClick={() => setSearchParams({ tab: 'measurement', section: value }, { replace: true })}
            className={getTabTriggerClass(value === section)}
          >
            {label}
          </button>
        ))}
      </div>
      <Panel />
    </div>
  );
};

export default MeasurementSetupPanel;
