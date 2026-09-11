import { useEffect } from 'react';

interface Props {
  open: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ImagePreview({ open, src, alt = '', onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="image-preview-backdrop" onClick={onClose}>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
      <button className="icon-btn image-preview-close" onClick={onClose} aria-label="close">
        ×
      </button>
    </div>
  );
}
