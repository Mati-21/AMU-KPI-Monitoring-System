import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Input } from '../../../shared/components/ui/Input';
import { Field } from '../../02-offices/components/FormParts';
import { fractionPreview, usesLevels } from '../lib/contractRules';

const NumberField = ({ label, value, onChange, hint, max }) => (
  <Field label={label} required hint={hint}>
    <Input type="number" required min="0" max={max} step="any" value={value} onChange={(event) => onChange(event.target.value)} />
  </Field>
);

const unitHint = (kpi) => (kpi.measurementType === 'MONEY' ? kpi.currency?.code : kpi.unit?.name);

/**
 * The inputs for one baseline or target, following the KPI's measurement type. `withParts` asks a percentage or
 * ratio for its numerator and denominator.
 */
const MeasureFields = ({ kpi, levels, title, withParts, measure, onChange }) => {
  const set = (key) => (value) => onChange({ ...measure, [key]: value });

  if (usesLevels(kpi)) {
    return (
      <Field label={title} required group>
        <CustomSelect compact options={levels.map((level) => ({ value: level.id, label: level.name }))} value={measure.scaleLevelId} onChange={set('scaleLevelId')} placeholder="Choose a level" />
      </Field>
    );
  }

  if (withParts && (kpi.measurementType === 'PERCENTAGE' || kpi.measurementType === 'RATIO')) {
    const preview = fractionPreview(kpi, measure);
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label={`${title}: ${kpi.numeratorLabel || 'Numerator'}`} value={measure.numerator} onChange={set('numerator')} />
          <NumberField label={`${title}: ${kpi.denominatorLabel || 'Denominator'}`} value={measure.denominator} onChange={set('denominator')} />
        </div>
        {preview && <p className="text-xs text-muted-foreground">Comes to {preview}</p>}
      </div>
    );
  }

  const isPercentage = kpi.measurementType === 'PERCENTAGE';
  return <NumberField label={isPercentage ? `${title} (%)` : title} value={measure.value} onChange={set('value')} max={isPercentage ? 100 : undefined} hint={unitHint(kpi)} />;
};

export default MeasureFields;
