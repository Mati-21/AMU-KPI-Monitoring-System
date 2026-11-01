import CustomSelect from '../../../../shared/components/ui/CustomSelect';
import { Input } from '../../../../shared/components/ui/Input';
import { Switch } from '../../../../shared/components/ui/Switch';
import { Field } from '../../../02-offices/components/FormParts';
import { optionLabel, rangeHint } from '../../lib/settingValues';

const INPUT_TYPES = { email: 'email', number: 'number', datetime: 'datetime-local' };

/**
 * The control for one setting, chosen from its type in config/settings.json.
 */
const SettingField = ({ setting, value, error, onChange }) => {
  const hint = [`${setting.description}.`, setting.type === 'json' ? 'Separate the days with commas.' : '', rangeHint(setting)].filter(Boolean).join(' ');
  const problem = error && <p className="text-xs text-red-500">{error}</p>;

  if (setting.type === 'boolean') {
    return (
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{setting.label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
          {problem}
        </div>
        <Switch aria-label={setting.label} checked={value} onCheckedChange={onChange} className="shrink-0" />
      </div>
    );
  }

  if (setting.type === 'enum') {
    return (
      <Field label={setting.label} hint={hint} group>
        <CustomSelect compact options={setting.options.map((option) => ({ value: option, label: optionLabel(option) }))} value={value} onChange={onChange} />
        {problem}
      </Field>
    );
  }

  return (
    <Field label={setting.label} hint={hint} group>
      <Input aria-label={setting.label} type={INPUT_TYPES[setting.type] ?? 'text'} min={setting.min} max={setting.max} maxLength={setting.maxLength} placeholder={setting.defaultValue === null ? '' : `Default: ${setting.defaultValue}`} value={value} onChange={(event) => onChange(event.target.value)} />
      {problem}
    </Field>
  );
};

export default SettingField;
