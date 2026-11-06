import { useState } from 'react';
import { Plus } from 'lucide-react';

import Button from '../../../shared/components/ui/Button';
import SearchInput from '../../../shared/components/ui/SearchInput';
import TabButton from '../../../shared/components/ui/TabButton';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import OfficeDetail from '../components/OfficeDetail';
import OfficeFormDialog from '../components/OfficeFormDialog';
import OfficeHierarchy from '../components/OfficeHierarchy';
import OfficeListPanel from '../components/OfficeListPanel';
import OfficeTree from '../components/OfficeTree';
import OfficeTypesPanel from '../components/OfficeTypesPanel';
import { useOfficeTree, useOfficeTypes } from '../hooks/useOffices';
import { filterTree } from '../lib/officeTree';

const OfficesPage = () => {
  const can = useCan();
  const { data: tree = [], isLoading, error } = useOfficeTree();
  const { data: types = [] } = useOfficeTypes();
  const [tab, setTab] = useState('offices');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const shownId = selectedId ?? tree[0]?.id;
  const shownTree = filterTree(tree, search);

  const closeDialog = () => setDialog(null);

  const openOffice = (id) => {
    setSelectedId(id);
    setTab('offices');
  };

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Offices</h1>
          <p className="text-sm text-muted-foreground">The university structure, its positions and the people placed in them.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <TabButton label="Offices" value="offices" activeValue={tab} onChange={setTab} />
          <TabButton label="All Offices" value="list" activeValue={tab} onChange={setTab} />
          <TabButton label="Hierarchy" value="hierarchy" activeValue={tab} onChange={setTab} />
          <TabButton label="Office Categories" value="types" activeValue={tab} onChange={setTab} />
        </div>

        {tab === 'types' && <OfficeTypesPanel />}
        {tab === 'list' && <OfficeListPanel onOpen={openOffice} />}
        {tab === 'hierarchy' && (
          <>
            {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load offices.')}</p>}
            {!isLoading && !error && <OfficeHierarchy tree={tree} onOpen={openOffice} />}
          </>
        )}

        {tab === 'offices' && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(280px,1fr)_3fr]">
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <SearchInput value={search} onChange={setSearch} placeholder="Search offices..." />
              {can('office:create') && tree.length === 0 && !isLoading && (
                <Button type="button" className="w-full gap-2" onClick={() => setDialog({})}>
                  <Plus className="h-4 w-4" />
                  Add Office
                </Button>
              )}
              {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
              {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load offices.')}</p>}
              {!isLoading && !error && shownTree.length === 0 && <p className="text-sm text-muted-foreground">No offices found.</p>}
              <OfficeTree nodes={shownTree} selectedId={shownId} onSelect={setSelectedId} forceOpen={Boolean(search.trim())} />
            </div>

            {shownId ? (
              <OfficeDetail key={shownId} officeId={shownId} onSelect={setSelectedId} onDeleted={() => setSelectedId(null)} onEdit={(office) => setDialog({ office })} onAddSubOffice={(parentId) => setDialog({ parentId })} />
            ) : (
              !isLoading && <p className="text-sm text-muted-foreground">Add the first office to begin.</p>
            )}
          </div>
        )}

        {dialog && (
          <OfficeFormDialog
            office={dialog.office}
            defaultParentId={dialog.parentId}
            tree={tree}
            types={types}
            onClose={closeDialog}
            onSaved={(id) => {
              setSelectedId(id);
              closeDialog();
            }}
          />
        )}
      </main>
    </div>
  );
};

export default OfficesPage;
