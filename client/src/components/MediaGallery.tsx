import { useMemo, useState } from 'react';
import type { GroupFile, Message } from '../types';
import { FileIcon } from './FileIcon';
import { formatBytes } from '../utils/format';

interface Props {
  messages: Message[];
  files: GroupFile[];
  onPreviewImage?: (src: string) => void;
  onDownloadFile?: (fileName: string | null, url: string | null) => void;
}

type Tab = 'images' | 'files';

export function MediaGallery({ messages, files, onPreviewImage, onDownloadFile }: Props) {
  const [tab, setTab] = useState<Tab>('images');

  const images = useMemo(
    () =>
      messages
        .filter((m) => (m.messageType ?? m.message_type) === 'image' && (m.fileUrl ?? m.file_url))
        .map((m) => m.fileUrl ?? m.file_url!)
        .filter(Boolean),
    [messages],
  );

  const fileItems = useMemo(() => {
    const fromMsgs = messages
      .filter((m) => (m.messageType ?? m.message_type) === 'file')
      .map((m) => ({
        name: m.fileName ?? m.file_name ?? '文件',
        url: m.fileUrl ?? m.file_url ?? null,
        size: m.fileSize ?? m.file_size ?? null,
      }));
    const fromFiles = files.map((f) => ({
      name: f.fileName ?? f.file_name ?? '文件',
      url: f.fileUrl ?? f.file_url ?? null,
      size: f.fileSize ?? f.file_size ?? null,
    }));
    const seen = new Set<string>();
    return [...fromFiles, ...fromMsgs].filter((f) => {
      const key = `${f.name}|${f.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [messages, files]);

  return (
    <div className="media-gallery">
      <div className="media-gallery-tabs">
        <button
          className={tab === 'images' ? 'active' : ''}
          onClick={() => setTab('images')}
        >
          图片 ({images.length})
        </button>
        <button
          className={tab === 'files' ? 'active' : ''}
          onClick={() => setTab('files')}
        >
          文件 ({fileItems.length})
        </button>
      </div>

      {tab === 'images' && (
        images.length === 0 ? (
          <div className="empty-list">暂无图片</div>
        ) : (
          <div className="media-grid">
            {images.map((src, i) => (
              <div
                key={i}
                className="media-grid-item"
                onClick={() => onPreviewImage?.(src)}
              >
                <img src={src} alt={`image-${i}`} loading="lazy" />
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'files' && (
        fileItems.length === 0 ? (
          <div className="empty-list">暂无文件</div>
        ) : (
          <div className="media-file-list">
            {fileItems.map((f, i) => (
              <div key={i} className="media-file-row" onClick={() => f.url && onDownloadFile?.(f.name, f.url)}>
                <FileIcon fileName={f.name} size={36} />
                <div className="media-file-meta">
                  <div className="media-file-name" title={f.name}>{f.name}</div>
                  <div className="muted">{formatBytes(f.size)}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
