import type { GroupFile } from '../types';
import { formatBytes, formatTime } from '../utils/format';
import { Spinner } from './Spinner';

interface Props {
  files: GroupFile[];
  loading?: boolean;
  onDownload?: (file: GroupFile) => void;
  onDelete?: (file: GroupFile) => void;
  canDelete?: boolean;
}

export function GroupFileList({ files, loading, onDownload, onDelete, canDelete }: Props) {
  if (loading) {
    return (
      <div className="empty-list">
        <Spinner />
      </div>
    );
  }
  if (files.length === 0) {
    return <div className="empty-list">群文件列表为空</div>;
  }
  return (
    <div className="group-file-list">
      {files.map((f) => (
        <div key={f.id} className="group-file-item">
          <div className="file-icon">📎</div>
          <div className="group-file-meta">
            <div className="file-name" title={f.fileName}>
              {f.fileName}
            </div>
            <div className="file-size">
              {formatBytes(f.fileSize ?? f.file_size)} · {formatTime(f.createdAt)}
              {f.uploader ? ` · ${f.uploader.displayName || f.uploader.display_name || f.uploader.username}` : ''}
            </div>
          </div>
          <div className="group-file-actions">
            {onDownload && (
              <button className="btn btn-ghost btn-sm" onClick={() => onDownload(f)}>
                下载
              </button>
            )}
            {canDelete && onDelete && (
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(f)}>
                删除
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
