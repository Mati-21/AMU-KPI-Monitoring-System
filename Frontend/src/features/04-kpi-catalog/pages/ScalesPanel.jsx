import { useState } from 'react';
import { BadgeCheck, Edit3, Plus, Trash2, Undo2 } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Input } from '../../../shared/components/ui/Input';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import RecordTable, { IconAction } from '../components/RecordTable';
import { useSaveRecord, useScales, useSetScaleScoring } from '../hooks/useCatalog';

const SCALE_TYPES = [
  { value: 'STAGE', label: 'Stage - steps in order, each with criteria' },
  { value: 'CATEGORY', label: 'Category - named results' },
];

const emptyLevel = () => ({ name: '', score: '', assessmentCriteria: '' });

const toFormLevel = (level) => ({ name: level.name, score: level.score ?? '', assessmentCriteria: level.assessmentCriteria ?? '' });

const toSentLevel = (level, index) => ({
  name: level.name,
  sortOrder: index + 1,
  score: level.score === '' ? null : Number(level.score),
  assessmentCriteria: level.assessmentCriteria.trim() || null,
});

const ScaleDialog = ({ scale, onClose }) => {
  const { notify } = useNotification();
  const save = useSaveRecord('kpi-scales');
  const [name, setName] = useState(scale?.name ?? '');
  const [scaleType, setScaleType] = useState(scale?.scaleType ?? 'STAGE');
  const [isBinary, setIsBinary] = useState(scale?.isBinary ?? false);
  const [isOrdered, setIsOrdered] = useState(scale?.isOrdered ?? true);
  const [levels, setLevels] = useState(scale ? scale.levels.map(toFormLevel) : [emptyLevel(), emptyLevel()]);
  const isStage = scaleType === 'STAGE';

  const changeLevel = (index, field, value) => setLevels(levels.map((level, position) => (position === index ? { ...level, [field]: value } : level)));

  const submit = (event) => {
    event.preventDefault();
    save.mutate(
      { id: scale?.id, values: { name, scaleType, isBinary: !isStage && isBinary, isOrdered: isStage || (!isBinary && isOrdered), levels: levels.map(toSentLevel) } },
      {
        onSuccess: () => {
          notify('Scale saved.', 'success');
          onClose();
        },
      }
    );
  };

  return (
    <FormDialog open onClose={onClose} title={scale ? 'Edit Scale' : 'Add Scale'} description={scale?.scoringApproved ? 'Saving withdraws its scoring approval, because what was approved has changed.' : 'The levels a stage or category KPI reports on, listed in order.'} onSubmit={submit} error={save.error} pending={save.isPending}>
      <Field label="Name" required>
        <Input required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Type" required group>
        <CustomSelect compact options={SCALE_TYPES} value={scaleType} onChange={setScaleType} />
      </Field>
      {!isStage && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={isBinary} onChange={(event) => setIsBinary(event.target.checked)} />
            Only two results, such as Yes or No
          </label>
          {!isBinary && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={isOrdered} onChange={(event) => setIsOrdered(event.target.checked)} />
              The results have an order from worst to best
            </label>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Levels</p>
        {levels.map((level, index) => (
          <div key={index} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
              <Input required aria-label={`Level ${index + 1} name`} placeholder="Name" value={level.name} onChange={(event) => changeLevel(index, 'name', event.target.value)} />
              <Input type="number" step="any" aria-label={`Level ${index + 1} score`} placeholder="Score" value={level.score} onChange={(event) => changeLevel(index, 'score', event.target.value)} className="w-24 shrink-0" />
              {levels.length > 2 && <IconAction icon={Trash2} label={`Remove level ${index + 1}`} danger onClick={() => setLevels(levels.filter((_, position) => position !== index))} />}
            </div>
            {isStage && <Input required aria-label={`Level ${index + 1} criteria`} placeholder="How to tell this stage is reached" value={level.assessmentCriteria} onChange={(event) => changeLevel(index, 'assessmentCriteria', event.target.value)} />}
          </div>
        ))}
        {!(isBinary && !isStage && levels.length >= 2) && (
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setLevels([...levels, emptyLevel()])}>
            <Plus className="h-4 w-4" />
            Add Level
          </Button>
        )}
        <p className="text-xs text-muted-foreground">Scores are optional. Approved scoring needs one on every level, rising or falling steadily.</p>
      </div>
    </FormDialog>
  );
};

const ScalesPanel = () => {
  const can = useCan();
  const { notify } = useNotification();
  const { data: scales = [], isLoading, error } = useScales();
  const setScoring = useSetScaleScoring();
  const [dialog, setDialog] = useState(null);
  const canManage = can('kpi:manage');

  const changeScoring = (scale, approved) =>
    setScoring.mutate(
      { id: scale.id, approved },
      {
        onSuccess: () => notify(approved ? 'Scoring approved.' : 'Scoring approval withdrawn.', 'success'),
        onError: (failure) => notify(apiErrorMessage(failure, 'Could not change the scoring approval.'), 'error'),
      }
    );

  const columns = [
    { label: 'Name', render: (row) => <span className="font-medium text-foreground">{row.name}</span> },
    { label: 'Type', render: (row) => (row.scaleType === 'STAGE' ? 'Stage' : row.isBinary ? 'Category (two results)' : 'Category') },
    { label: 'Levels', render: (row) => row.levels.map((level) => level.name).join(' → ') },
    { label: 'Scoring', render: (row) => <Badge variant="outline">{row.scoringApproved ? 'Approved' : 'Not approved'}</Badge> },
    { label: 'Used By', render: (row) => `${row.kpiCount} KPI(s)` },
    ...(canManage
      ? [
          {
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-2">
                {!row.isLocked && <IconAction icon={Edit3} label={`Edit ${row.name}`} onClick={() => setDialog({ scale: row })} />}
                {!row.scoringApproved && !row.isBinary && row.isOrdered && <IconAction icon={BadgeCheck} label={`Approve scoring of ${row.name}`} onClick={() => changeScoring(row, true)} />}
                {row.scoringApproved && !row.isLocked && <IconAction icon={Undo2} label={`Withdraw scoring of ${row.name}`} danger onClick={() => changeScoring(row, false)} />}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <RecordTable title="Stage and Category Scales" description="What stage and category KPIs report on. A scale locks once a KPI uses it." addLabel="Add Scale" onAdd={canManage ? () => setDialog({}) : null} columns={columns} rows={scales} isLoading={isLoading} error={error} />
      {dialog && <ScaleDialog scale={dialog.scale} onClose={() => setDialog(null)} />}
    </>
  );
};

export default ScalesPanel;
