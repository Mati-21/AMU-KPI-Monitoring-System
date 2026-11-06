import { Check, CheckCheck, Download, File, Trash2 } from 'lucide-react';
import { getFileUrl } from '../../../shared/lib/utils';
import { fileIconOf, isImage } from '../lib/messageFormat';

const IconButton = ({ title, onClick, className, children }) => (
  <button
    type="button"
    title={title}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    className={className}
  >
    {children}
  </button>
);

const Attachment = ({ file, isOwn, onPreview, onDownload, onDelete }) => {
  const url = getFileUrl(file.fileUrl);
  const icon = fileIconOf(file.fileType, file.fileName);
  const actions = (
    <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-all group-hover/item:opacity-100">
      <IconButton title="Download" onClick={() => onDownload(file)} className="rounded-lg bg-black/40 p-1.5 text-white backdrop-blur-sm hover:bg-primary">
        <Download className="h-3 w-3" />
      </IconButton>
      {isOwn && (
        <IconButton title="Delete" onClick={() => onDelete(file)} className="rounded-lg bg-black/40 p-1.5 text-white backdrop-blur-sm hover:bg-destructive/80">
          <Trash2 className="h-3 w-3" />
        </IconButton>
      )}
    </div>
  );

  if (isImage(file)) {
    return (
      <div className="group/item relative overflow-hidden rounded-xl">
        <img src={url} alt={file.fileName} onClick={() => onPreview({ preview: url, name: file.fileName, type: file.fileType })} className="aspect-square w-full cursor-pointer border border-border/10 object-cover shadow-lg hover:opacity-90" />
        {actions}
      </div>
    );
  }

  return (
    <div className="group/item relative">
      <a href={url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 rounded-xl border border-border/30 p-2 shadow-sm hover:opacity-80 ${isOwn ? 'bg-primary/20 text-foreground' : 'bg-muted text-foreground'}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
          {icon ? <img src={icon} alt="" className="h-6 w-6 object-contain" /> : <File className="h-4 w-4 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-bold leading-tight">{file.fileName}</p>
          <p className="text-[8px] uppercase opacity-60">{file.fileType?.split('/')[1]?.toUpperCase() || 'FILE'}</p>
        </div>
      </a>
      {actions}
    </div>
  );
};

/**
 * One message: its files, its text, the time and, for my own messages, whether it was read.
 */
const MessageBubble = ({ message, isOwn, onPreview, onDownload, onDelete, onDeleteAttachment }) => {
  const { attachments, content } = message;
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`group relative max-w-[85%] ${isOwn ? 'ml-auto' : ''}`}>
      <div
        className={`relative rounded-2xl text-sm leading-relaxed ${
          content ? (isOwn ? 'min-w-[140px] rounded-br-none bg-primary py-1.5 pl-4 pr-20 text-primary-foreground shadow-sm' : 'min-w-[110px] rounded-bl-none border border-border/50 bg-muted/50 py-1.5 pl-4 pr-16 text-foreground shadow-sm') : ''
        }`}
      >
        {attachments.length > 0 && (
          <div className={`mb-2 grid gap-1.5 ${attachments.length === 1 ? 'max-w-[150px] grid-cols-1' : 'max-w-[200px] grid-cols-2'}`}>
            {attachments.map((file, index) => (
              <div key={file.fileId} className={attachments.length % 2 !== 0 && index === 0 && attachments.length > 1 ? 'col-span-2' : ''}>
                <Attachment file={file} isOwn={isOwn} onPreview={onPreview} onDownload={onDownload} onDelete={(item) => onDeleteAttachment(message.id, item.fileId)} />
              </div>
            ))}
          </div>
        )}

        {content && <p className="whitespace-pre-wrap break-words">{content}</p>}

        <div className={`flex items-center gap-1.5 text-[9px] font-medium ${content ? `absolute bottom-1.5 right-2.5 ${isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground/70'}` : 'mt-1 text-muted-foreground/70'}`}>
          <span className="whitespace-nowrap">{time}</span>
          {isOwn && (message.isRead ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Check className="h-3 w-3" />)}
        </div>
      </div>

      {isOwn && (
        <button type="button" onClick={() => onDelete(message.id)} title="Delete for everyone" className="absolute -left-8 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-transparent transition-all hover:bg-destructive/10 group-hover:text-destructive/60">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default MessageBubble;
