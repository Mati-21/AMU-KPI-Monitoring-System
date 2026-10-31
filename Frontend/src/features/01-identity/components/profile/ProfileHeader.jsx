import { useRef } from 'react';
import { Building2, Camera, Trash2 } from 'lucide-react';

import { Badge } from '../../../../shared/components/ui/Badge';
import { Card, CardContent } from '../../../../shared/components/ui/Card';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import { useRemoveMyPicture, useUploadMyPicture } from '../../hooks/useProfile';
import PersonAvatar from '../PersonAvatar';

const PICTURE_TYPES = '.png,.jpg,.jpeg,.webp';

export const ProfileHeader = ({ user }) => {
  const fileInput = useRef(null);
  const { notify } = useNotification();
  const upload = useUploadMyPicture();
  const remove = useRemoveMyPicture();
  const busy = upload.isPending || remove.isPending;
  const offices = user.placements?.map((placement) => placement.office.name) ?? [];

  const choosePicture = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    upload.mutate(file, {
      onSuccess: () => notify('Profile picture updated.', 'success'),
      onError: (error) => notify(apiErrorMessage(error, 'Could not upload the picture.'), 'error'),
    });
  };

  const removePicture = () =>
    remove.mutate(undefined, {
      onSuccess: () => notify('Profile picture removed.', 'success'),
      onError: (error) => notify(apiErrorMessage(error, 'Could not remove the picture.'), 'error'),
    });

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      <div className="h-32 bg-linear-to-r from-primary/20 via-primary/10 to-accent/20" />
      <CardContent className="relative pb-6 pt-0 px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end -mt-12">
          <div className="group relative h-24 w-24 shrink-0">
            <PersonAvatar personId={user.personId} fileId={user.profilePictureFileId} fullName={user.fullName} className="h-24 w-24 border-4 border-card text-2xl shadow-lg" />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              aria-label="Change profile picture"
              className="absolute inset-1 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed"
            >
              {busy ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Camera className="h-5 w-5" />}
            </button>
            <input ref={fileInput} type="file" accept={PICTURE_TYPES} onChange={choosePicture} className="hidden" aria-label="Profile picture file" />
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{user.fullName}</h1>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                Active
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{user.roles?.length ? user.roles.join(', ') : user.roleName}</p>
            {offices.length > 0 && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                {offices.join(', ')}
              </p>
            )}
          </div>

          {user.profilePictureFileId && (
            <button type="button" onClick={removePicture} disabled={busy} className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-destructive sm:self-end">
              <Trash2 className="h-3.5 w-3.5" />
              Remove picture
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileHeader;
