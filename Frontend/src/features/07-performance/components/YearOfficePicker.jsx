import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { optionLabel } from '../../10-system/lib/settingValues';

/**
 * The fiscal year and office a performance page shows. An office the person works in says so.
 */
const YearOfficePicker = ({ years, year, offices, office, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {offices.length > 1 && (
      <div className="w-64">
        <CustomSelect compact options={offices.map((item) => ({ value: item.id, label: item.isOwn ? `${item.name} (yours)` : item.name }))} value={office?.id} onChange={(next) => onChange({ office: next })} />
      </div>
    )}
    {year && (
      <div className="w-56">
        <CustomSelect compact options={years.map((item) => ({ value: item.id, label: `${item.name} (${optionLabel(item.status)})` }))} value={year.id} onChange={(next) => onChange({ year: next })} />
      </div>
    )}
  </div>
);

export default YearOfficePicker;
