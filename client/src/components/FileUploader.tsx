import { useRef, useState } from 'react';
import { Spinner } from './Spinner';

interface Props {
  onSelect: (file: File) => void | Promise<void>;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  buttonText?: string;
  compact?: boolean;
  /** 单文件大小上限（MB），默认 10MB */
  maxSizeMB?: number;
}

export function FileUploader({
  onSelect,
  accept,
  multiple = false,
  disabled,
  buttonText = '上传文件',
  compact,
  maxSizeMB = 10,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const list = Array.from(files);
      // 前端校验：文件大小上限（后端仍需二次校验，此处仅减少无效上传）
      const maxBytes = maxSizeMB * 1024 * 1024;
      const oversize = list.find((f) => f.size > maxBytes);
      if (oversize) {
        window.alert(`文件「${oversize.name}」超过大小限制（${maxSizeMB}MB）`);
        return;
      }
      if (multiple) {
        for (const f of list) await onSelect(f);
      } else {
        await onSelect(list[0]);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled || busy}
      />
      <button
        type="button"
        className={`btn ${compact ? 'btn-ghost' : 'btn-secondary'}`}
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
      >
        {busy ? <Spinner size={14} /> : null}
        {buttonText}
      </button>
    </>
  );
}
