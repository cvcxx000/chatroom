interface Props {
  fileName?: string | null;
  size?: number;
}

function extOf(name?: string | null): string {
  if (!name) return '';
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

const EXT_MAP: Record<string, { icon: string; label: string; color: string }> = {
  pdf: { icon: '📕', label: 'PDF', color: '#e5484d' },
  doc: { icon: '📘', label: 'DOC', color: '#2b579a' },
  docx: { icon: '📘', label: 'DOC', color: '#2b579a' },
  xls: { icon: '📗', label: 'XLS', color: '#217346' },
  xlsx: { icon: '📗', label: 'XLS', color: '#217346' },
  csv: { icon: '📗', label: 'CSV', color: '#217346' },
  ppt: { icon: '📙', label: 'PPT', color: '#d24726' },
  pptx: { icon: '📙', label: 'PPT', color: '#d24726' },
  jpg: { icon: '🖼️', label: 'IMG', color: '#4f6ef7' },
  jpeg: { icon: '🖼️', label: 'IMG', color: '#4f6ef7' },
  png: { icon: '🖼️', label: 'IMG', color: '#4f6ef7' },
  gif: { icon: '🖼️', label: 'IMG', color: '#4f6ef7' },
  webp: { icon: '🖼️', label: 'IMG', color: '#4f6ef7' },
  svg: { icon: '🖼️', label: 'IMG', color: '#4f6ef7' },
  mp4: { icon: '🎬', label: 'VID', color: '#9c3fd6' },
  mov: { icon: '🎬', label: 'VID', color: '#9c3fd6' },
  avi: { icon: '🎬', label: 'VID', color: '#9c3fd6' },
  mkv: { icon: '🎬', label: 'VID', color: '#9c3fd6' },
  webm: { icon: '🎬', label: 'VID', color: '#9c3fd6' },
  mp3: { icon: '🎵', label: 'AUD', color: '#e06c75' },
  wav: { icon: '🎵', label: 'AUD', color: '#e06c75' },
  zip: { icon: '🗜️', label: 'ZIP', color: '#b58900' },
  rar: { icon: '🗜️', label: 'ZIP', color: '#b58900' },
  '7z': { icon: '🗜️', label: 'ZIP', color: '#b58900' },
  tar: { icon: '🗜️', label: 'ZIP', color: '#b58900' },
  gz: { icon: '🗜️', label: 'ZIP', color: '#b58900' },
  txt: { icon: '📄', label: 'TXT', color: '#8a93a6' },
  md: { icon: '📄', label: 'MD', color: '#8a93a6' },
  js: { icon: '📜', label: 'JS', color: '#c678dd' },
  ts: { icon: '📜', label: 'TS', color: '#c678dd' },
  json: { icon: '📜', label: 'JSON', color: '#c678dd' },
};

export function FileIcon({ fileName, size = 40 }: Props) {
  const ext = extOf(fileName);
  const meta = EXT_MAP[ext] || { icon: '📎', label: 'FILE', color: '#8a93a6' };
  return (
    <div
      className="file-type-icon"
      style={{ width: size, height: size, background: `${meta.color}1a`, color: meta.color }}
      title={meta.label}
    >
      <span style={{ fontSize: size * 0.45 }}>{meta.icon}</span>
    </div>
  );
}
