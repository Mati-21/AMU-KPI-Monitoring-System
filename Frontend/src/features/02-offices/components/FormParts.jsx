import Button from '../../../shared/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../shared/components/ui/dialog';
import { apiErrorMessage } from '../../../shared/lib/apiError';

/**
 * `group` is for controls made of buttons, such as CustomSelect: inside a real label, every click on them would
 * also press the first button again.
 */
export const Field = ({ label, required, hint, group, children }) => {
  const Wrapper = group ? 'div' : 'label';
  return (
    <div className="space-y-1.5">
      <Wrapper className="block space-y-1.5">
        <span className="block text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
        {children}
      </Wrapper>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

/**
 * A dialog holding a form, with the usual error line and buttons.
 */
export const FormDialog = ({ open, onClose, title, description, onSubmit, error, pending, submitLabel = 'Save', submitDisabled, children }) => (
  <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not save this.')}</p>}
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || submitDisabled}>
            {pending ? 'Saving...' : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);

export const ConfirmDialog = ({ open, onClose, title, description, onConfirm, error, pending, confirmLabel = 'Delete' }) => (
  <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
    <DialogContent className="bg-card">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not do this.')}</p>}
      <DialogFooter className="gap-2 sm:space-x-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
