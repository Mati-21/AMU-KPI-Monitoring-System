import { useSearchParams } from 'react-router-dom';

import TabButton from '../../../shared/components/ui/TabButton';
import { useCan } from '../../03-access-control/hooks/useCan';
import DocumentTypesPanel from '../components/DocumentTypesPanel';
import DocumentsPanel from '../components/DocumentsPanel';

/**
 * Everything about documents: the files themselves and the types of document the university accepts.
 */
const DocumentsPage = () => {
  const can = useCan();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManageTypes = can('document:manage');
  const tab = searchParams.get('tab') === 'types' && canManageTypes ? 'types' : 'documents';

  const changeTab = (next) => setSearchParams(next === 'documents' ? {} : { tab: next }, { replace: true });

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground">Upload, find and open documents, and set which kinds of document and file the university accepts.</p>
        </div>

        {canManageTypes && (
          <div className="flex flex-wrap gap-2">
            <TabButton label="Documents" value="documents" activeValue={tab} onChange={changeTab} />
            <TabButton label="Document Types" value="types" activeValue={tab} onChange={changeTab} />
          </div>
        )}

        {tab === 'documents' ? <DocumentsPanel /> : <DocumentTypesPanel />}
      </main>
    </div>
  );
};

export default DocumentsPage;
