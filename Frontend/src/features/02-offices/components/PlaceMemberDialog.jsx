import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import SearchInput from '../../../shared/components/ui/SearchInput';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { formatEthiopianDate } from '../../../shared/lib/ethiopianDate';
import { usePersons } from '../../01-identity/hooks/useUsers';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useOfficeTree, usePlaceMember, usePositions } from '../hooks/useOffices';
import { officeOptions } from '../lib/officeTree';
import { Field, FormDialog } from './FormParts';

const SEARCH_DELAY_MS = 300;

const PersonPicker = ({ selected, onSelect }) => {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const hasSearch = appliedSearch.length > 0;
  const { data, isLoading, error } = usePersons({ search: appliedSearch, isActive: true, limit: 20 }, { enabled: hasSearch });

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-2">
      <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, staff number..." />
      {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load people.')}</p>}
      {!hasSearch && <p className="text-xs text-muted-foreground">{selected ? `Selected: ${selected.fullName}` : 'Search to find the person.'}</p>}
      {/* About four people show at once; the rest scroll, so the dialog keeps its size */}
      {hasSearch && (
        <ul className="max-h-52 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {isLoading && <li className="p-2 text-sm text-muted-foreground">Loading...</li>}
          {!isLoading && data?.data.length === 0 && <li className="p-2 text-sm text-muted-foreground">Nobody found.</li>}
          {data?.data.map((person) => (
            <li key={person.id}>
              <button type="button" onClick={() => onSelect(person)} className={`flex w-full items-center justify-between gap-2 p-2 text-left text-sm hover:bg-muted ${selected?.id === person.id ? 'bg-primary/10' : ''}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{person.fullName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{person.email || 'No email yet'}</span>
                </span>
                {selected?.id === person.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Places a person in a position. Opened from an office the person is chosen here; opened from a person the office is.
 */
const PlaceMemberDialog = ({ office, person, onClose }) => {
  const { notify } = useNotification();
  const place = usePlaceMember();
  const { data: tree } = useOfficeTree();
  const [officeId, setOfficeId] = useState(office?.id ?? '');
  const [chosenPerson, setChosenPerson] = useState(person ?? null);
  const [positionId, setPositionId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const { data: positions = [], isLoading: positionsLoading } = usePositions(officeId);
  const positionOptions = positions.map((position) => ({ value: position.id, label: position.isHead ? `${position.title} (head)` : position.title }));

  const chooseOffice = (next) => {
    setOfficeId(next);
    setPositionId('');
  };

  const submit = (event) => {
    event.preventDefault();
    place.mutate(
      { officeId, values: { personId: chosenPerson.id, positionId, ...(isPrimary && { isPrimary }) } },
      {
        onSuccess: () => {
          notify(`${chosenPerson.fullName} was placed.`, 'success');
          onClose();
        },
      }
    );
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Place in Office"
      description={office ? `Give someone a position in ${office.name}.` : `Give ${person.fullName} a position in an office.`}
      onSubmit={submit}
      error={place.error}
      pending={place.isPending}
      submitLabel="Place"
      submitDisabled={!chosenPerson || !officeId || !positionId}
    >
      {!person && (
        <Field label="Person" required group>
          <PersonPicker selected={chosenPerson} onSelect={setChosenPerson} />
        </Field>
      )}
      {!office && (
        <Field label="Office" required group>
          <CustomSelect compact options={officeOptions(tree)} value={officeId} onChange={chooseOffice} placeholder="Choose the office" />
        </Field>
      )}
      {officeId && (
        <Field label="Position" required group hint={!positionsLoading && positions.length === 0 ? 'This office has no positions yet. Add one on the office page first.' : undefined}>
          <CustomSelect compact options={positionOptions} value={positionId} onChange={setPositionId} placeholder="Choose the position" />
        </Field>
      )}
      <p className="text-sm text-muted-foreground">The placement starts today, {formatEthiopianDate(new Date())}, and runs until you end it.</p>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />
        Make this their main office
      </label>
    </FormDialog>
  );
};

export default PlaceMemberDialog;
