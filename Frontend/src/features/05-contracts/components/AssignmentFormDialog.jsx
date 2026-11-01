import { useState } from 'react';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { useFrequencies } from '../../04-kpi-catalog/hooks/useCatalog';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useSaveAssignment } from '../hooks/useContracts';
import { SCOPE_OPTIONS, assignmentPayload, changedPayload, defaultsForKpi, formFromAssignment, hasLevels, measureText, shareFor, withShareTarget } from '../lib/contractRules';
import AssignmentValueFields from './AssignmentValueFields';

/**
 * Add a KPI to a contract, or edit one still in draft. `choices` lists what can be added, and `kpi` is the
 * catalog record of the assignment being edited.
 */
const AssignmentFormDialog = ({ contract, assignment, kpi: editedKpi, parentContract, choices = [], onClose }) => {
  const { notify } = useNotification();
  const save = useSaveAssignment();
  const { data: frequencies = [] } = useFrequencies();
  const [kpiId, setKpiId] = useState('');
  const [form, setForm] = useState(() => (assignment ? formFromAssignment(assignment) : defaultsForKpi()));

  const choice = choices.find((item) => item.kpi.id === kpiId);
  const kpi = editedKpi ?? choice?.kpi;
  const set = (key) => (value) => setForm({ ...form, [key]: value });
  const others = contract.totalWeight - (assignment?.weight ?? 0);
  const parent = choice?.parent ?? parentContract?.assignments.find((candidate) => candidate.id === assignment?.parentAssignmentId);
  const share = shareFor(parent, contract.officeId);

  const chooseKpi = (id) => {
    const next = choices.find((item) => item.kpi.id === id);
    setKpiId(id);
    setForm(defaultsForKpi(next.kpi, next.parent));
  };

  const close = () => {
    save.reset();
    onClose();
  };

  const submit = (event) => {
    event.preventDefault();
    const values = assignment ? changedPayload(kpi, form, formFromAssignment(assignment)) : { kpiId, ...(choice.parent && { parentAssignmentId: choice.parent.id }), ...assignmentPayload(kpi, form) };
    if (assignment && Object.keys(values).length === 0) {
      close();
      return;
    }
    save.mutate(
      { id: assignment?.id, contractId: contract.id, values },
      {
        onSuccess: () => {
          notify(assignment ? 'KPI updated.' : 'KPI added to the contract.', 'success');
          close();
        },
      }
    );
  };

  return (
    <FormDialog
      open
      onClose={close}
      title={assignment ? `Edit ${assignment.kpi.code}` : 'Add KPI'}
      description={`For ${contract.office.name}, ${contract.fiscalYear.name}.`}
      onSubmit={submit}
      error={save.error}
      pending={save.isPending}
      submitLabel={assignment ? 'Save' : 'Add KPI'}
      submitDisabled={!kpi || !form.reportingFrequencyId || !hasLevels(kpi, form)}
    >
      {assignment ? (
        <p className="text-sm font-medium text-foreground">{assignment.kpi.name}</p>
      ) : choices.length === 0 ? (
        <p className="rounded-md border border-border p-3 text-sm text-foreground">
          {contract.assigningOfficeId ? `${contract.assigningOffice.name} has no signed KPI to pass down yet. Its own contract must be signed first.` : 'No KPI is available. Register an active KPI under KPI Management, or check whether every one is already on this contract.'}
        </p>
      ) : (
        <Field label="KPI" required group>
          <CustomSelect compact options={choices.map((item) => ({ value: item.kpi.id, label: `${item.kpi.code} - ${item.kpi.name}` }))} value={kpiId} onChange={chooseKpi} placeholder="Choose a KPI" />
        </Field>
      )}

      {kpi && (
        <>
          {parent && (
            <p className="rounded-md border border-border p-2 text-xs text-foreground">
              {contract.assigningOffice.name} holds baseline {measureText(kpi, parent.baseline)} and target {measureText(kpi, parent.target)}.
              {parent.sharing?.shareable && ` It has assigned ${parent.sharing.assigned} of ${parent.sharing.parentAmount}, so ${Math.max(0, -parent.sharing.difference)} remains.`}
              {share !== null && ` The share for ${contract.office.name} is ${share}, and the target follows from its baseline.`}
            </p>
          )}

          <AssignmentValueFields kpi={kpi} form={form} onChange={(next) => setForm(withShareTarget(kpi, share, form, next))} weightHint={`Other KPIs use ${others} of ${contract.requiredTotalWeight}, leaving ${contract.requiredTotalWeight - others}.`} />

          <Field label="Reporting Frequency" required group>
            <CustomSelect compact options={frequencies.map((frequency) => ({ value: frequency.id, label: frequency.name }))} value={form.reportingFrequencyId} onChange={set('reportingFrequencyId')} placeholder="Choose a frequency" />
          </Field>

          <Field label="How It Passes Down" required group hint="Decides whether the offices below must add up to this target.">
            <CustomSelect compact options={SCOPE_OPTIONS} value={form.scopeRelation} onChange={set('scopeRelation')} />
          </Field>
        </>
      )}
    </FormDialog>
  );
};

export default AssignmentFormDialog;
