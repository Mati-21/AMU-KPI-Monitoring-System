import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Field } from '../../02-offices/components/FormParts';
import { SHARE_METHOD_WORDS, shareMethodOptions } from '../lib/contractRules';

/**
 * How the office above shares a KPI with the offices below it. Fixed once a contract holding the KPI was sent.
 */
const ShareMethodField = ({ parent, fromOffice, value, onChange }) => {
  const { sharing } = parent;
  const hint = sharing.locked
    ? `${fromOffice.name} shares this KPI ${SHARE_METHOD_WORDS[sharing.method].toLowerCase()}, because a contract holding it was already sent. Every office below gets it the same way.`
    : sharing.divisible
      ? 'Equally divides the improvement, Fully gives each office all of it, Custom lets you set the target. Once a contract with this KPI is sent, the choice stays for every office below.'
      : 'This KPI cannot be divided, so it is shared fully or with custom targets. Once a contract with this KPI is sent, the choice stays for every office below.';

  return (
    <Field label="How the Target Is Shared" required group hint={hint}>
      <CustomSelect compact options={shareMethodOptions(sharing)} value={value} onChange={onChange} placeholder="Choose how" />
    </Field>
  );
};

export default ShareMethodField;
