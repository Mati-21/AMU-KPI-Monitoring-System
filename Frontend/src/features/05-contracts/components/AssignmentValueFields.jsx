import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Input } from '../../../shared/components/ui/Input';
import { Field } from '../../02-offices/components/FormParts';
import { useScales } from '../../04-kpi-catalog/hooks/useCatalog';
import { BASELINE_OPTIONS, usesLevels } from '../lib/contractRules';
import MeasureFields from './MeasureFields';

/**
 * The baseline, target and weight of one KPI on a contract.
 */
const AssignmentValueFields = ({ kpi, form, onChange, weightHint }) => {
  const { data: scales = [] } = useScales();
  const levels = scales.find((scale) => scale.id === kpi.scaleId)?.levels ?? [];
  const set = (key) => (value) => onChange({ ...form, [key]: value });

  return (
    <>
      {usesLevels(kpi) && kpi.scale && !kpi.scale.scoringApproved && <p className="text-xs text-amber-700 dark:text-amber-400">The scoring of "{kpi.scale.name}" is not approved yet, so this KPI earns no contract points until it is.</p>}

      <Field label="Baseline Is" required group hint="The starting value. An unknown baseline is never treated as zero.">
        <CustomSelect compact options={BASELINE_OPTIONS} value={form.baselineStatus} onChange={set('baselineStatus')} />
      </Field>
      {form.baselineStatus === 'KNOWN' ? (
        <MeasureFields kpi={kpi} levels={levels} title="Baseline" withParts measure={form.baseline} onChange={set('baseline')} />
      ) : (
        <Field label="Why Is There No Value?" required>
          <textarea required rows={2} value={form.justification} onChange={(event) => set('justification')(event.target.value)} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </Field>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <MeasureFields kpi={kpi} levels={levels} title="Target" measure={form.target} onChange={set('target')} />
        <Field label="Weight" required hint={weightHint}>
          <Input type="number" required min="0.01" max="100" step="any" value={form.weight} onChange={(event) => set('weight')(event.target.value)} />
        </Field>
      </div>
    </>
  );
};

export default AssignmentValueFields;
