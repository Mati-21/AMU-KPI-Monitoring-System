import { useState } from 'react';

import { FileSpreadsheet } from 'lucide-react';

import Button from '../../../shared/components/ui/Button';
import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Input } from '../../../shared/components/ui/Input';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { Field } from '../../02-offices/components/FormParts';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useCurrencies, useFrequencies, useSaveRecord, useScales, useThemeTree, useUnits } from '../hooks/useCatalog';
import { DIRECTIONS, MEASUREMENT_TYPES, RULES_BY_TYPE, SCORING_METHODS, ZERO_TARGET_RULES, isAdditiveType, kpiErrors, targetTypesFor, themeOptions, themePath, toOptions, usesLabels, usesScale } from '../lib/kpiRules';

const TEXT_KEYS = ['name', 'description', 'remark', 'numeratorLabel', 'denominatorLabel'];
const CHOICE_KEYS = ['themeId', 'measurementType', 'direction', 'targetType', 'defaultFrequencyId', 'unitId', 'scaleId', 'currencyId', 'aggregationMethod', 'periodRollupMethod', 'scoringMethod', 'zeroTargetRule'];
const EDITABLE_WHEN_LOCKED = new Set(['defaultFrequencyId', 'remark']);

const blankForm = () => ({
  ...Object.fromEntries([...TEXT_KEYS, ...CHOICE_KEYS].map((key) => [key, ''])),
  isAdditive: false,
  maintenanceTolerance: '',
  decimalPlaces: '2',
  zeroTargetRule: 'NOT_CALCULABLE',
});

const formFrom = (kpi) => {
  const form = blankForm();
  if (!kpi) return form;
  for (const key of [...TEXT_KEYS, ...CHOICE_KEYS]) form[key] = kpi[key] ?? '';
  return { ...form, isAdditive: kpi.isAdditive, maintenanceTolerance: kpi.maintenanceTolerance ?? '', decimalPlaces: String(kpi.decimalPlaces ?? 2) };
};

const toSendValues = (form) => ({
  ...Object.fromEntries([...TEXT_KEYS, ...CHOICE_KEYS].map((key) => [key, form[key] === '' ? null : form[key]])),
  isAdditive: form.isAdditive,
  maintenanceTolerance: form.maintenanceTolerance === '' ? null : Number(form.maintenanceTolerance),
  decimalPlaces: Number(form.decimalPlaces),
});

const changedValues = (values, kpi) => {
  const before = toSendValues(formFrom(kpi));
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => String(value) !== String(before[key])));
};

const withoutEmpty = (values) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null));

const SectionTitle = ({ children }) => <h3 className="border-b border-border pb-2 text-sm font-semibold text-foreground md:col-span-3">{children}</h3>;

/**
 * Register a KPI, edit one, or (with `replaces`) register its replacement.
 */
function RegisterKpi({ kpi, replaces, onDone, onCancel, onMassRegister }) {
  const { notify } = useNotification();
  const save = useSaveRecord('kpis');
  const { data: themes = [] } = useThemeTree();
  const { data: frequencies = [] } = useFrequencies();
  const { data: units = [] } = useUnits();
  const { data: scales = [] } = useScales();
  const { data: currencies = [] } = useCurrencies();
  const [form, setForm] = useState(() => (replaces ? formFrom(replaces) : formFrom(kpi)));
  const [chosenThemeId, setChosenThemeId] = useState(null);
  const [subThemeMissing, setSubThemeMissing] = useState(false);
  const isEditing = Boolean(kpi);
  const rules = RULES_BY_TYPE[form.measurementType];
  const lockedOut = (key) => Boolean(kpi?.isLocked) && !EDITABLE_WHEN_LOCKED.has(key);
  const scaleChoices = scales.filter((scale) => scale.scaleType === form.measurementType);
  // form.themeId is what is saved: the sub-theme, or the theme itself when it has no sub-themes
  const topThemeId = chosenThemeId ?? themePath(themes, form.themeId)[0]?.id ?? '';
  const topTheme = themes.find((theme) => theme.id === topThemeId);
  const activeOnly = !lockedOut('themeId');
  const topThemeOptions = themes.filter((theme) => theme.isActive || !activeOnly).map((theme) => ({ value: theme.id, label: theme.name }));
  const subThemeOptions = themeOptions(topTheme?.children, { activeOnly });

  const chooseTheme = (id) => {
    setChosenThemeId(id);
    setSubThemeMissing(false);
    const theme = themes.find((candidate) => candidate.id === id);
    setForm({ ...form, themeId: themeOptions(theme.children, { activeOnly }).length > 0 ? '' : id });
  };

  const chooseSubTheme = (id) => {
    setSubThemeMissing(false);
    setForm({ ...form, themeId: id });
  };

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const setChoice = (key) => (value) => setForm({ ...form, [key]: value });

  // Clear what no longer applies and start from the usual methods for this type
  const chooseType = (measurementType) =>
    setForm({
      ...form,
      measurementType,
      aggregationMethod: RULES_BY_TYPE[measurementType].aggregation[0],
      periodRollupMethod: RULES_BY_TYPE[measurementType].rollup[0],
      isAdditive: isAdditiveType(measurementType),
      unitId: measurementType === 'NUMBER' ? form.unitId : '',
      currencyId: measurementType === 'MONEY' ? form.currencyId : '',
      scaleId: '',
      numeratorLabel: usesLabels(measurementType) ? form.numeratorLabel : '',
      denominatorLabel: usesLabels(measurementType) ? form.denominatorLabel : '',
    });

  const chooseDirection = (direction) =>
    setForm({ ...form, direction, targetType: targetTypesFor(direction)[0], maintenanceTolerance: direction === 'MAINTAIN' ? form.maintenanceTolerance : '' });

  const submit = (event) => {
    event.preventDefault();
    if (topThemeId && !form.themeId) {
      setSubThemeMissing(true);
      return;
    }
    const values = toSendValues(form);
    const payload = isEditing ? changedValues(values, kpi) : { ...withoutEmpty(values), ...(replaces && { replacesKpiId: replaces.id }) };
    if (isEditing && Object.keys(payload).length === 0) {
      onCancel();
      return;
    }
    save.mutate(
      { id: kpi?.id, values: payload },
      {
        onSuccess: (saved) => {
          notify(replaces ? `${saved.name} now replaces ${replaces.name}, which was retired.` : `${saved.name} saved.`, 'success');
          onDone();
        },
      }
    );
  };

  const select = (key, label, options, { required, hint, onChange, placeholder } = {}) =>
    lockedOut(key) ? (
      <Field label={label} group>
        <Input disabled value={options.find((option) => option.value === form[key])?.label ?? '-'} />
      </Field>
    ) : (
      <Field label={label} required={required} hint={hint} group>
        <CustomSelect compact options={options} value={form[key]} onChange={onChange ?? setChoice(key)} placeholder={placeholder ?? `Choose ${label.toLowerCase()}`} />
      </Field>
    );

  const text = (key, label, { required, hint, ...rest } = {}) => (
    <Field label={label} required={required} hint={hint}>
      <Input required={required} disabled={lockedOut(key)} value={form[key]} onChange={set(key)} {...rest} />
    </Field>
  );

  const area = (key, label, { required, hint } = {}) => (
    <Field label={label} required={required} hint={hint}>
      <textarea required={required} disabled={lockedOut(key)} rows={3} value={form[key]} onChange={set(key)} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />
    </Field>
  );

  const missingCatalog = [themes.length === 0 && 'Themes', frequencies.length === 0 && 'Frequencies'].filter(Boolean);
  const problems = kpiErrors(save.error);
  const title = isEditing ? `Edit ${kpi.name}` : replaces ? `Replace ${replaces.name}` : 'Register KPI';

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-card p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
          {kpi?.isLocked && 'This KPI is in use, so only its reporting frequency can change. To change anything else, replace it.'}
          {replaces && `Saving retires the old one and links the two, so the trend carries on.`}
          {!kpi?.isLocked && !replaces && 'What is measured and how. Weights, baselines and targets are set per year on each contract.'}
          </p>
        </div>
        {onMassRegister && (
          <Button type="button" variant="outline" className="gap-2" onClick={onMassRegister}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Mass Register
          </Button>
        )}
      </div>

      {!isEditing && missingCatalog.length > 0 && <p className="text-sm text-amber-600">Add at least one in each of these tabs first: {missingCatalog.join(', ')}.</p>}

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
        <SectionTitle>What It Is</SectionTitle>
        <div className="md:col-span-3">{text('name', 'Name', { required: true })}</div>
        {lockedOut('themeId') ? (
          <Field label="Theme" group>
            <Input disabled value={topTheme?.name ?? '-'} />
          </Field>
        ) : (
          <Field label="Theme" required group>
            <CustomSelect compact options={topThemeOptions} value={topThemeId} onChange={chooseTheme} placeholder="Choose theme" />
          </Field>
        )}
        {lockedOut('themeId') ? (
          <Field label="Sub-Theme" group>
            <Input disabled value={subThemeOptions.find((option) => option.value === form.themeId)?.label ?? '-'} />
          </Field>
        ) : (
          <Field label="Sub-Theme" required={subThemeOptions.length > 0} group hint={topTheme && subThemeOptions.length === 0 ? 'This theme has no sub-themes, so the KPI goes directly under it.' : undefined}>
            <CustomSelect compact options={subThemeOptions} value={subThemeOptions.some((option) => option.value === form.themeId) ? form.themeId : ''} onChange={chooseSubTheme} placeholder={topTheme ? (subThemeOptions.length > 0 ? 'Choose sub-theme' : 'No sub-themes') : 'Choose a theme first'} />
            {subThemeMissing && <p className="text-xs text-red-500">Choose a sub-theme.</p>}
          </Field>
        )}
        {select('defaultFrequencyId', 'Reporting Frequency', frequencies.map((frequency) => ({ value: frequency.id, label: frequency.name })), { required: true })}
        <div className="md:col-span-3">{area('description', 'Description', { required: true })}</div>
        <div className="md:col-span-3">{area('remark', 'Remark', { hint: 'Optional. Anything worth noting about this KPI.' })}</div>

        <SectionTitle>How It Is Measured</SectionTitle>
        {select('measurementType', 'Measurement Type', toOptions(MEASUREMENT_TYPES), { required: true, onChange: chooseType, hint: 'Use Percentage, Ratio or Money for those results, not Number with a unit, so they add up correctly.' })}
        {select('direction', 'Direction', toOptions(DIRECTIONS), { required: true, onChange: chooseDirection })}
        {select('targetType', 'Target Type', toOptions(targetTypesFor(form.direction)), { required: true, placeholder: form.direction ? 'Choose target type' : 'Choose a direction first' })}
        {form.measurementType === 'NUMBER' && select('unitId', 'Unit', units.map((unit) => ({ value: unit.id, label: unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name })), { required: true })}
        {form.measurementType === 'MONEY' && select('currencyId', 'Currency', currencies.map((currency) => ({ value: currency.id, label: `${currency.code} - ${currency.name}` })), { required: true })}
        {usesScale(form.measurementType) && select('scaleId', 'Scale', scaleChoices.map((scale) => ({ value: scale.id, label: scale.name })), { required: true, hint: scaleChoices.length === 0 ? 'There is no scale of this type yet. Add one under Measurement Setup, in Scales.' : undefined })}
        {usesLabels(form.measurementType) && text('numeratorLabel', 'Numerator Label', { required: true, hint: 'What is counted, such as Graduates.' })}
        {usesLabels(form.measurementType) && text('denominatorLabel', 'Denominator Label', { required: true, hint: 'What it is out of, such as Enrolled students.' })}
        {form.direction === 'MAINTAIN' && text('maintenanceTolerance', 'Allowed Variation', { required: true, type: 'number', min: 0, step: 'any', hint: 'How far from the target still counts as maintained.' })}

        {rules && (
          <>
            <SectionTitle>Scoring Rules</SectionTitle>
            {select('aggregationMethod', 'Combining Offices', toOptions(rules.aggregation), { hint: 'How results of offices below add up.' })}
            {select('periodRollupMethod', 'Combining Periods', toOptions(rules.rollup), { hint: 'How period results make the year-end result.' })}
            {select('scoringMethod', 'Scoring Method', [{ value: '', label: 'University default' }, ...toOptions(SCORING_METHODS)], { placeholder: 'University default', hint: 'Left empty, it follows Official score basis in Configuration.' })}
            {select('zeroTargetRule', 'When the Target Is Zero', toOptions(ZERO_TARGET_RULES))}
            {text('decimalPlaces', 'Decimal Places', { type: 'number', min: 0, max: 6, step: 1 })}
            {isAdditiveType(form.measurementType) && (
              <label className="flex items-center gap-2 pt-7 text-sm text-foreground">
                <input type="checkbox" disabled={lockedOut('isAdditive')} checked={form.isAdditive} onChange={(event) => setForm({ ...form, isAdditive: event.target.checked })} />
                Results can be added together
              </label>
            )}
          </>
        )}
      </div>

      {save.error && (
        <div className="space-y-1 text-sm text-red-500">
          <p>{apiErrorMessage(save.error, 'Could not save this KPI.')}</p>
          {problems.length > 0 && (
            <ul className="list-disc pl-5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default RegisterKpi;
