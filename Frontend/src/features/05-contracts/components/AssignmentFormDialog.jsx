import { useState } from 'react';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { useFrequencies } from '../../04-kpi-catalog/hooks/useCatalog';
import { usePeriods } from '../../06-reporting-periods/hooks/usePlanning';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useSaveAssignment } from '../hooks/useContracts';
import { assignmentPayload, changedPayload, defaultsForKpi, formFromAssignment, frequencyChoices, hasLevels, shareFor, sharedTarget } from '../lib/contractRules';
import AssignmentValueFields from './AssignmentValueFields';
import ParentKpiSummary from './ParentKpiSummary';
import ShareMethodField from './ShareMethodField';

/**
 * Add a KPI to a contract, or edit one still in draft. `choices` lists what can be added, and `kpi` is the
 * catalog record of the assignment being edited. Below the top office the KPI comes from the office above: how its
 * target is shared decides this office's target, and it is reported as often as above or more often.
 */
const AssignmentFormDialog = ({ contract, assignment, kpi: editedKpi, parentContract, choices = [], onClose }) => {
  const { notify } = useNotification();
  const save = useSaveAssignment();
  const { data: frequencies = [] } = useFrequencies();
  const { data: periods = [] } = usePeriods(contract.fiscalYear.id);
  const [kpiId, setKpiId] = useState('');
  const [form, setForm] = useState(() => (assignment ? formFromAssignment(assignment) : defaultsForKpi()));

  const choice = choices.find((item) => item.kpi.id === kpiId);
  const kpi = editedKpi ?? choice?.kpi;
  const parent = choice?.parent ?? parentContract?.assignments.find((candidate) => candidate.id === assignment?.parentAssignmentId);
  // While editing, the way the KPI above is shared counts until another is chosen here
  const shareMethod = parent ? (form.shareMethod ?? parent.sharing?.method ?? 'CUSTOM') : undefined;
  const current = parent ? { ...form, shareMethod } : form;
  const targetNote = kpi && parent ? sharedTarget(kpi, parent, shareMethod, current, contract.officeId) : null;

  // Only frequencies the year has periods for, because a KPI is reported only in periods of its own frequency
  const usable = frequencies.filter((frequency) => periods.some((period) => period.frequencyId === frequency.id));
  const offered = frequencyChoices(usable, frequencies, parent?.reportingFrequencyId);
  const set = (key) => (value) => setForm({ ...form, [key]: value });
  const frequencyHint = () => {
    if (usable.length === 0) return `Create reporting periods for ${contract.fiscalYear.name} under Fiscal Years first.`;
    if (parent) return `${contract.assigningOffice.name} reports it ${parent.reportingFrequency?.name ?? ''}. It can be reported as often, or more often, among the frequencies ${contract.fiscalYear.name} has periods for.`;
    return `Only frequencies ${contract.fiscalYear.name} has periods for are listed.`;
  };
  const others = contract.totalWeight - (assignment?.weight ?? 0);

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
    const values = assignment ? changedPayload(kpi, current, formFromAssignment(assignment, parent)) : { kpiId, ...(choice.parent && { parentAssignmentId: choice.parent.id }), ...assignmentPayload(kpi, current) };
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
      className="sm:max-w-3xl"
      title={assignment ? `Edit ${assignment.kpi.name}` : 'Add KPI'}
      description={`For ${contract.office.name}, ${contract.fiscalYear.name}.`}
      onSubmit={submit}
      error={save.error}
      pending={save.isPending}
      submitLabel={assignment ? 'Save' : 'Add KPI'}
      submitDisabled={!kpi || !offered.some((frequency) => frequency.id === form.reportingFrequencyId) || !hasLevels(kpi, current) || (parent && !shareMethod) || Boolean(targetNote?.problem)}
    >
      {assignment ? (
        <p className="text-sm font-medium text-foreground">{assignment.kpi.name}</p>
      ) : choices.length === 0 ? (
        <p className="rounded-md border border-border p-3 text-sm text-foreground">
          {contract.assigningOfficeId ? `${contract.assigningOffice.name} has no signed KPI to pass down yet. Its own contract must be signed first.` : 'No KPI is available. Register an active KPI under KPI Management, or check whether every one is already on this contract.'}
        </p>
      ) : (
        <Field label="KPI" required group>
          <CustomSelect compact options={choices.map((item) => ({ value: item.kpi.id, label: item.kpi.name }))} value={kpiId} onChange={chooseKpi} placeholder="Choose a KPI" />
        </Field>
      )}

      {kpi && (
        <>
          {parent && <ParentKpiSummary kpi={kpi} parent={parent} fromOffice={contract.assigningOffice} toOffice={contract.office} share={shareFor(parent, contract.officeId)} shareMethod={shareMethod} />}
          {parent?.sharing && <ShareMethodField parent={parent} fromOffice={contract.assigningOffice} value={shareMethod ?? ''} onChange={set('shareMethod')} />}

          <AssignmentValueFields kpi={kpi} form={form} onChange={setForm} targetNote={targetNote} weightHint={`Other KPIs use ${others} of ${contract.requiredTotalWeight}, leaving ${contract.requiredTotalWeight - others}.`} />

          <Field label="Reporting Frequency" required group hint={frequencyHint()}>
            <CustomSelect compact options={offered.map((frequency) => ({ value: frequency.id, label: frequency.name }))} value={offered.some((frequency) => frequency.id === form.reportingFrequencyId) ? form.reportingFrequencyId : ''} onChange={set('reportingFrequencyId')} placeholder={offered.length ? 'Choose a frequency' : 'This year has no reporting periods for it'} />
          </Field>
        </>
      )}
    </FormDialog>
  );
};

export default AssignmentFormDialog;
