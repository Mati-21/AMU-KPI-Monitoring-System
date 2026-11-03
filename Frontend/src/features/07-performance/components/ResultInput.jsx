import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Input } from '../../../shared/components/ui/Input';
import { isFraction, usesLevels } from '../lib/reportRules';

const unitOf = (kpi) => (kpi.measurementType === 'MONEY' ? kpi.currency?.code : kpi.measurementType === 'PERCENTAGE' ? '%' : kpi.unit?.symbol);

/**
 * The input for one result, following the KPI's measurement type: a level, a numerator and denominator, or a number.
 */
const ResultInput = ({ kpi, entry, onChange, label }) => {
  const set = (key) => (event) => onChange({ ...entry, [key]: event.target.value });

  if (usesLevels(kpi)) {
    return <CustomSelect compact options={kpi.levels.map((level) => ({ value: level.id, label: level.name }))} value={entry.scaleLevelId} onChange={(scaleLevelId) => onChange({ ...entry, scaleLevelId })} placeholder="Choose a level" />;
  }
  if (isFraction(kpi)) {
    return (
      <div className="flex items-center gap-1.5">
        <Input type="number" min="0" step="any" value={entry.numerator} onChange={set('numerator')} aria-label={`${label} numerator`} placeholder="Count" className="w-24" />
        <span className="text-xs text-muted-foreground">of</span>
        <Input type="number" min="0" step="any" value={entry.denominator} onChange={set('denominator')} aria-label={`${label} denominator`} placeholder="Total" className="w-24" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Input type="number" min="0" step="any" value={entry.value} onChange={set('value')} aria-label={label} className="w-36" />
      {unitOf(kpi) && <span className="text-xs text-muted-foreground">{unitOf(kpi)}</span>}
    </div>
  );
};

export default ResultInput;
