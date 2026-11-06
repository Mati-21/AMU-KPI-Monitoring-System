import { useEffect, useRef, useState } from 'react';
import { File, Loader2, Paperclip, Send, Smile, X } from 'lucide-react';
import { fileIconOf } from '../lib/messageFormat';

const EMOJIS = ['😀', '😂', '😍', '🤔', '👍', '🙏', '🔥', '❤️', '🙌', '🎉', '😎', '✨', '😢', '😮', '👏', '🤝', '✅', '🚀'];
const MAX_FILES = 5;
const MAX_FILE_MB = 10;

/**
 * The message box: text, emoji and files waiting to be sent. Calls onSend({ content, files }) and clears itself
 * only when that succeeds.
 */
const Composer = ({ name, isSending, onSend, onPreview }) => {
  const [text, setText] = useState('');
  const [pending, setPending] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [problem, setProblem] = useState('');
  const fileInput = useRef(null);

  // Free the browser's copies of the picture previews when they are no longer shown
  useEffect(() => () => pending.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)), [pending]);

  const addFiles = (event) => {
    const chosen = Array.from(event.target.files);
    event.target.value = '';
    if (pending.length + chosen.length > MAX_FILES) return setProblem(`You can attach at most ${MAX_FILES} files to a message.`);
    if (chosen.some((file) => file.size > MAX_FILE_MB * 1024 * 1024)) return setProblem(`Each file must be ${MAX_FILE_MB} MB or smaller.`);
    setProblem('');
    return setPending((current) => [
      ...current,
      ...chosen.map((file) => ({ id: crypto.randomUUID(), file, name: file.name, type: file.type, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null })),
    ]);
  };

  const submit = async (event) => {
    event.preventDefault();
    const content = text.trim();
    if ((!content && pending.length === 0) || isSending) return;
    try {
      await onSend({ content, files: pending.map((item) => item.file) });
      setText('');
      setPending([]);
      setProblem('');
    } catch (error) {
      setProblem(error?.response?.data?.message || 'The message could not be sent. Please try again.');
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-border bg-card/30 p-4">
      {problem && <p className="mb-2 text-xs text-red-500">{problem}</p>}
      <input type="file" ref={fileInput} onChange={addFiles} multiple className="hidden" />

      <div className="relative flex items-center gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/20">
        {pending.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-3 shadow-xl">
            {pending.map((item) => (
              <div key={item.id} className="group relative shrink-0">
                <button type="button" onClick={() => onPreview(item)} title={item.name} className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted hover:ring-2 hover:ring-primary">
                  {item.preview ? (
                    <img src={item.preview} alt="" className="h-full w-full object-cover" />
                  ) : fileIconOf(item.type, item.name) ? (
                    <img src={fileIconOf(item.type, item.name)} alt="" className="h-10 w-10 object-contain" />
                  ) : (
                    <File className="h-6 w-6 text-muted-foreground" />
                  )}
                </button>
                <button type="button" onClick={() => setPending((current) => current.filter((other) => other.id !== item.id))} aria-label={`Remove ${item.name}`} className="absolute -right-2 -top-2 flex h-5 w-5 scale-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform group-hover:scale-100">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={() => fileInput.current?.click()} disabled={isSending} aria-label="Attach files" className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50">
          <Paperclip className="h-5 w-5" />
        </button>
        <input type="text" value={text} onChange={(event) => setText(event.target.value)} disabled={isSending} maxLength={4000} placeholder={isSending ? 'Sending...' : `Message ${name}...`} className="flex-1 border-none bg-transparent px-2 text-sm outline-none disabled:opacity-50" />

        <div className="relative">
          <button type="button" onClick={() => setShowEmoji((open) => !open)} aria-label="Emoji" className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted">
            <Smile className="h-5 w-5" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-full right-0 z-50 mb-4 grid w-48 grid-cols-6 gap-1 rounded-2xl border border-border bg-card p-2 shadow-2xl">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setText((current) => current + emoji);
                    setShowEmoji(false);
                  }}
                  className="rounded-lg p-1.5 text-lg transition-colors hover:bg-muted"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={(!text.trim() && pending.length === 0) || isSending} aria-label="Send" className="rounded-xl bg-primary p-2 text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none">
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </form>
  );
};

export default Composer;
