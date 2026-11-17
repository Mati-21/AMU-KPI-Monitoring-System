import { ConfirmDialog } from '../../02-offices/components/FormParts';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useDeleteRecord } from '../hooks/useCatalog';

/**
 * Confirms deleting one catalog record (a unit, scale or currency). The server refuses one that is in use and says why.
 */
const DeleteRecordDialog = ({ path, id, title, name, details, onClose }) => {
  const { notify } = useNotification();
  const remove = useDeleteRecord(path);

  const confirm = () =>
    remove.mutate(id, {
      onSuccess: () => {
        notify(`${name} was deleted.`, 'success');
        onClose();
      },
    });

  return <ConfirmDialog open onClose={onClose} title={title} description={`Delete ${name}? ${details} This cannot be undone.`} onConfirm={confirm} error={remove.error} pending={remove.isPending} />;
};

export default DeleteRecordDialog;
