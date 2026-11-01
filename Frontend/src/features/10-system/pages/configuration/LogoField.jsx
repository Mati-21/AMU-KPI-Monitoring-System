import { useRef } from 'react';
import { Loader2, Upload } from 'lucide-react';

import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { getFileUrl } from '../../../../shared/lib/utils';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import { useUploadLogo } from '../../hooks/useSystem';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const LogoField = ({ setting }) => {
  const { notify } = useNotification();
  const upload = useUploadLogo();
  const inputRef = useRef(null);
  const logoUrl = setting.value ? getFileUrl(`/api/v1/files/${setting.value}/public`) : null;

  const choose = (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      notify('The logo must be 5 MB or smaller.', 'error');
      return;
    }
    upload.mutate(file, {
      onSuccess: () => notify('Logo saved.', 'success'),
      onError: (error) => notify(apiErrorMessage(error, 'Could not upload the logo.'), 'error'),
    });
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-sm font-medium text-foreground">{setting.label}</p>
      <input ref={inputRef} type="file" accept="image/*" aria-label="Logo file" onChange={choose} className="hidden" />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="group flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50">
        {upload.isPending && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
        {!upload.isPending && logoUrl && (
          <>
            <span className="flex h-24 w-48 items-center justify-center rounded-lg border border-border bg-white p-2">
              <img src={logoUrl} alt="System logo" className="max-h-full max-w-full object-contain" />
            </span>
            <span className="text-sm font-semibold text-primary group-hover:underline">Click to change logo</span>
          </>
        )}
        {!upload.isPending && !logoUrl && (
          <>
            <Upload className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">Click to upload a logo</span>
          </>
        )}
        <span className="text-xs text-muted-foreground">An image of up to 5 MB. It saves straight away.</span>
      </button>
    </div>
  );
};

export default LogoField;
