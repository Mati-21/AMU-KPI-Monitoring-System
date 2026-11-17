import { useState } from 'react';
import { Download, Eye, Trash2, Upload } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import CustomSelect from '../../../shared/components/ui/CustomSelect';
import SearchInput from '../../../shared/components/ui/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from '../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { formatEthiopianDate } from '../../../shared/lib/ethiopianDate';
import { ConfirmDialog } from '../../02-offices/components/FormParts';
import { useCan } from '../../03-access-control/hooks/useCan';
import { IconAction } from '../../04-kpi-catalog/components/RecordTable';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { downloadFile, openFile, useDeleteDocument, useDocumentTypes, useDocuments } from '../hooks/useDocuments';
import { formatSize, personName } from '../lib/documentRules';
import UploadDocumentDialog from './UploadDocumentDialog';

const PAGE_SIZE = 10;
const ALL = 'all';

const Filter = ({ allLabel, options, value, onChange }) => (
  <div className="w-48">
    <CustomSelect compact options={[{ value: ALL, label: allLabel }, ...options]} value={value} onChange={onChange} />
  </div>
);

const matches = (document, search) => {
  const text = search.trim().toLowerCase();
  return !text || [document.title, document.description, document.file.originalName].some((part) => part?.toLowerCase().includes(text));
};

const DocumentsPanel = () => {
  const { notify } = useNotification();
  const can = useCan();
  const { data: documents = [], isLoading, error } = useDocuments();
  const { data: types = [] } = useDocumentTypes();
  const remove = useDeleteDocument();
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState(ALL);
  const [officeId, setOfficeId] = useState(ALL);
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const canUpload = can('document:create');
  const canDownload = can('document:download');

  // Only the offices that hold a document are worth filtering by
  const offices = [...new Map(documents.filter((document) => document.ownerOffice).map((document) => [document.ownerOffice.id, document.ownerOffice])).values()];
  const shown = documents.filter((document) => matches(document, search) && (typeId === ALL || document.documentType.id === typeId) && (officeId === ALL || document.ownerOffice?.id === officeId));
  const lastPage = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const rows = shown.slice((Math.min(page, lastPage) - 1) * PAGE_SIZE, Math.min(page, lastPage) * PAGE_SIZE);
  const filtered = search.trim() || typeId !== ALL || officeId !== ALL;

  // A new search or filter starts from the first page
  const changing = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const open = (document) => openFile(document.file.id).catch((failure) => notify(apiErrorMessage(failure, 'Could not open this file.'), 'error'));
  const download = (document) => downloadFile(document.file.id, document.file.originalName).catch((failure) => notify(apiErrorMessage(failure, 'Could not download this file.'), 'error'));

  const confirmDelete = () =>
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        notify(`${toDelete.title} deleted.`, 'success');
        setToDelete(null);
      },
    });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Uploaded Documents</h2>
            <p className="mt-1 text-xs text-muted-foreground">Files uploaded by your office and the offices below it, including the evidence attached to results. A document used as evidence cannot be deleted.</p>
          </div>
          {canUpload && (
            <Button type="button" className="gap-2" onClick={() => setUploading(true)}>
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <SearchInput value={search} onChange={changing(setSearch)} placeholder="Search title or file name..." />
          </div>
          <Filter allLabel="All types" options={types.map((type) => ({ value: type.id, label: type.name }))} value={typeId} onChange={changing(setTypeId)} />
          <Filter allLabel="All offices" options={offices.map((office) => ({ value: office.id, label: office.name }))} value={officeId} onChange={changing(setOfficeId)} />
        </div>
      </div>

      {error && <p className="p-4 text-sm text-red-500">{apiErrorMessage(error, 'Could not load the documents.')}</p>}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7}>Loading...</TableCell>
              </TableRow>
            )}
            {!isLoading && !error && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>{filtered ? 'No document matches these filters.' : 'No documents yet.'}</TableCell>
              </TableRow>
            )}
            {rows.map((document) => (
              <TableRow key={document.id}>
                <TableCell>
                  <span className="block font-medium text-foreground">{document.title}</span>
                  {document.description && <span className="block max-w-xs truncate text-xs text-muted-foreground">{document.description}</span>}
                </TableCell>
                <TableCell>{document.documentType.name}</TableCell>
                <TableCell>{document.ownerOffice?.name ?? '-'}</TableCell>
                <TableCell>
                  <span className="block max-w-[14rem] truncate">{document.file.originalName}</span>
                  <span className="block text-xs text-muted-foreground">{formatSize(document.file.sizeBytes)}</span>
                </TableCell>
                <TableCell>
                  <span className="block">{formatEthiopianDate(document.createdAt)}</span>
                  <span className="block text-xs text-muted-foreground">{personName(document.createdBy)}</span>
                </TableCell>
                <TableCell>{document.usedAsEvidence ? <Badge variant="outline">Used as evidence</Badge> : <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {canDownload && <IconAction icon={Eye} label={`View ${document.title}`} onClick={() => open(document)} />}
                    {canDownload && <IconAction icon={Download} label={`Download ${document.title}`} onClick={() => download(document)} />}
                    {canUpload && !document.usedAsEvidence && <IconAction icon={Trash2} label={`Delete ${document.title}`} danger onClick={() => setToDelete(document)} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination currentPage={Math.min(page, lastPage)} totalItems={shown.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />

      {uploading && <UploadDocumentDialog onClose={() => setUploading(false)} />}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => {
          setToDelete(null);
          remove.reset();
        }}
        title="Delete Document"
        description={toDelete ? `"${toDelete.title}" and its file will be removed. This cannot be undone.` : ''}
        onConfirm={confirmDelete}
        error={remove.error}
        pending={remove.isPending}
      />
    </div>
  );
};

export default DocumentsPanel;
