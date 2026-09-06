import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn } from 'lucide-react';

export default function MessageImage({ src, alt = 'Chat image' }: { src?: string; alt?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="my-3 block rounded-lg border border-border p-3 text-sm text-muted-foreground">Image unavailable. {alt}</span>;
  return <span className="my-3 block max-w-full">
    <button aria-label={'Enlarge ' + alt} onClick={() => dialog.current?.showModal()} className="relative block max-w-full overflow-hidden rounded-xl border border-border focus-visible:outline-2 focus-visible:outline-primary">
      <img src={src} alt={alt} onError={() => setFailed(true)} className="max-h-80 max-w-full object-contain" />
      <ZoomIn aria-hidden="true" className="absolute bottom-2 right-2 h-7 w-7 rounded bg-black/60 p-1 text-white" />
    </button>
    {createPortal(<dialog ref={dialog} aria-label={alt} className="fixed inset-0 m-auto max-h-[90dvh] max-w-[95vw] rounded-xl border border-border bg-card p-4 text-foreground backdrop:bg-black/80">
      <button autoFocus aria-label="Close image preview" onClick={() => dialog.current?.close()} className="mb-3 ml-auto flex h-11 w-11 items-center justify-center rounded-lg border border-border"><X className="h-5 w-5" /></button>
      <img src={src} alt={alt} className="max-h-[70dvh] max-w-full object-contain" />
    </dialog>, document.body)}
  </span>;
}
