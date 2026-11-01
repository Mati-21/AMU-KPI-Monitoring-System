import { useState } from 'react';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { useFiscalYears } from '../../06-reporting-periods/hooks/usePlanning';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useContract, useContracts, useSaveAssignment } from '../hooks/useContracts';
import { assignableKpis, assignmentPayload, blockedReason, defaultsForKpi, hasLevels, isOpen, shareFor, withShareTarget } from '../lib/contractRules';
import AssignmentValueFields from './AssignmentValueFields';

/**
 * Add the KPIs selected in the KPI list to one draft contract. Each is saved on its own, so when one is refused
 * the others stay added and only the refused one is left to fix.
 */
const AddToContractDialog = ({ kpis, onAdded, onClose }) => {
  const { notify } = useNotification();
  const save = useSaveAssignment();
  const { data: years = [] } = useFiscalYears();
  const openYears = years.filter((year) => year.status !== 'CLOSED');
  const [chosenYearId, setChosenYearId] = useState(null);
  const yearId = chosenYearId ?? (openYears.find((year) => year.status === 'ACTIVE') ?? openYears[0])?.id;
  const [contractId, setContractId] = useState('');
  const [forms, setForms] = useState({});
  const [errors, setErrors] = useState({});
  const [addedIds, setAddedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data: contracts = [] } = useContracts(yearId);
  const { data: contract } = useContract(contractId);
  const { data: parentContract } = useContract(contracts.find((candidate) => candidate.officeId === contract?.assigningOfficeId)?.id);
  const drafts = contracts.filter(isOpen);

  const remaining = kpis.filter((kpi) => !addedIds.includes(kpi.id));
  const choices = contract ? assignableKpis(contract, remaining, parentContract) : [];
  const blocked = contract ? remaining.filter((kpi) => !choices.some((choice) => choice.kpi.id === kpi.id)) : [];
  const formOf = (choice) => forms[choice.kpi.id] ?? defaultsForKpi(choice.kpi, choice.parent);
  const newWeight = choices.reduce((sum, choice) => sum + Number(formOf(choice).weight || 0), 0);

  const changeYear = (id) => {
    setChosenYearId(id);
    setContractId('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const added = [];
    const failures = {};
    for (const choice of choices) {
      const values = { kpiId: choice.kpi.id, ...(choice.parent && { parentAssignmentId: choice.parent.id }), ...assignmentPayload(choice.kpi, formOf(choice)) };
      try {
        await save.mutateAsync({ contractId, values });
        added.push(choice.kpi.id);
      } catch (failure) {
        failures[choice.kpi.id] = apiErrorMessage(failure, 'Could not add this KPI.');
      }
    }
    setSaving(false);
    setErrors(failures);
    setAddedIds([...addedIds, ...added]);
    onAdded(added);

    if (added.length > 0) notify(`${added.length} KPI(s) added to ${contract.office.name}.`, 'success');
    if (Object.keys(failures).length === 0) onClose();
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title="Add to Contract"
      description={`${remaining.length} KPI(s) selected. Each one needs its own baseline, target and weight.`}
      onSubmit={submit}
      pending={saving}
      submitLabel={`Add ${choices.length} KPI(s)`}
      submitDisabled={choices.length === 0 || !choices.every((choice) => hasLevels(choice.kpi, formOf(choice)))}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fiscal Year" required group>
          <CustomSelect compact options={openYears.map((year) => ({ value: year.id, label: year.name }))} value={yearId ?? ''} onChange={changeYear} placeholder="No open fiscal year" />
        </Field>
        <Field label="Contract" required group hint={yearId && drafts.length === 0 ? 'This year has no contract open for changes. Create one under KPI Assignment.' : undefined}>
          <CustomSelect compact options={drafts.map((candidate) => ({ value: candidate.id, label: candidate.office.name }))} value={contractId} onChange={setContractId} placeholder="Choose a contract" />
        </Field>
      </div>

      {contract && (
        <p className="text-sm text-foreground">
          Weight total after adding: {contract.totalWeight + newWeight} of {contract.requiredTotalWeight}
        </p>
      )}

      {blocked.map((kpi) => (
        <p key={kpi.id} className="rounded-md border border-border p-3 text-sm text-foreground">
          <span className="font-medium">{kpi.code} - {kpi.name}:</span> {blockedReason(contract, kpi)} It will be left out.
        </p>
      ))}

      {choices.map((choice) => (
        <section key={choice.kpi.id} aria-label={choice.kpi.code} className="space-y-3 rounded-md border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">{choice.kpi.code} - {choice.kpi.name}</h3>
          {choice.parent?.sharing?.shareable && (
            <p className="text-xs text-foreground">
              {contract.assigningOffice.name} has assigned {choice.parent.sharing.assigned} of {choice.parent.sharing.parentAmount}, so {Math.max(0, -choice.parent.sharing.difference)} remains.
              {shareFor(choice.parent, contract.officeId) !== null && ` The share for ${contract.office.name} is ${shareFor(choice.parent, contract.officeId)}.`}
            </p>
          )}
          <AssignmentValueFields kpi={choice.kpi} form={formOf(choice)} onChange={(form) => setForms({ ...forms, [choice.kpi.id]: withShareTarget(choice.kpi, shareFor(choice.parent, contract.officeId), formOf(choice), form) })} />
          {errors[choice.kpi.id] && <p className="text-sm text-red-500">{errors[choice.kpi.id]}</p>}
        </section>
      ))}
    </FormDialog>
  );
};

export default AddToContractDialog;
