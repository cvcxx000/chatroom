import { useCallback, useEffect, useState } from 'react';

interface Props {
  open: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
  images?: string[];
  index?: number;
  onNavigate?: (index: number) => void;
}

export function ImagePreview({ open, src, alt = '', onClose, images, index, onNavigate }: Props) {
  const [zoom, setZoom] = useState(1);

  const hasNav = Array.isArray(images) && images.length > 1 && onNavigate;
  const go = useCallback(
    (dir: 1 | -1) => {
      if (!hasNav || index === undefined) return;
      const next = (index + dir + images!.length) % images!.length;
      onNavigate(next);
    },
    [hasNav, index, images, onNavigate],
  );

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)));
      if (e.key === '-') setZoom((z) => Math.max(0.3, +(z - 0.2).toFixed(2)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, go]);

  if (!open) return null;
  return (
    <div className="image-preview-backdrop" onClick={onClose}>
      {hasNav && (
        <button
          className="image-preview-nav prev"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          aria-label="上一张"
        >
          ‹
        </button>
      )}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{ transform: `scale(${zoom})` }}
      />
      {hasNav && (
        <button
          className="image-preview-nav next"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          aria-label="下一张"
        >
          ›
        </button>
      )}
      <div className="image-preview-toolbar" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.2).toFixed(2)))}>
          －
        </button>
        <span className="image-preview-zoom">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))}>
          ＋
        </button>
      </div>
      <button className="icon-btn image-preview-close" onClick={onClose} aria-label="close">
        ×
      </button>
    </div>
  );
}
