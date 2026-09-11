import { useRef, useState } from 'react';
import { Spinner } from './Spinner';

interface Props {
  onSelect: (file: File) => void | Promise<void>;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  buttonText?: string;
  compact?: boolean;
}

export function FileUploader({
  onSelect,
  accept,
  multiple = false,
  disabled,
  buttonText = '上传文件',
  compact,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      if (multiple) {
        for (const f of Array.from(files)) await onSelect(f);
      } else {
        await onSelect(files[0]);
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
