import { Image as ImageIcon } from 'lucide-react';
import { getFileUrl } from '../../../shared/lib/utils';
import { PersonAvatar } from '../../01-identity/components/PersonAvatar';
import { fullNameOf, isImage } from '../lib/messageFormat';

const Detail = ({ label, value }) =>
  value ? (
    <div className="flex flex-col gap-1 px-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="truncate text-xs font-medium text-foreground">{value}</span>
    </div>
  ) : null;

/**
 * Who I am talking with, and the pictures shared in this chat.
 */
const ContactPanel = ({ person, messages, onPreview }) => {
  const photos = messages.flatMap((message) => message.attachments.filter(isImage)).slice(-9).reverse();

  return (
    <div className="flex w-72 shrink-0 flex-col bg-card/20">
      <div className="flex flex-col items-center space-y-3 p-8 text-center">
        <PersonAvatar personId={person.id} fileId={person.profilePictureFileId} fullName={fullNameOf(person)} className="h-20 w-20 border-4 border-background text-2xl shadow-md" />
        <div>
          <h3 className="text-lg font-bold text-foreground">{fullNameOf(person)}</h3>
          {person.username && <p className="mt-1 text-xs font-medium text-muted-foreground">@{person.username}</p>}
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        <div className="space-y-4 border-t border-border/50 pt-4">
          <Detail label="Email" value={person.email} />
          <Detail label="Position" value={person.position} />
          <Detail label="Office" value={person.officeName} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" /> Shared photos
          </div>
          {photos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No photos shared yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <button key={photo.fileId} type="button" onClick={() => onPreview({ preview: getFileUrl(photo.fileUrl), name: photo.fileName, type: photo.fileType })} className="aspect-square overflow-hidden rounded-lg hover:opacity-80">
                  <img src={getFileUrl(photo.fileUrl)} alt={photo.fileName} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactPanel;
