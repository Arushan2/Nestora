import { useRef, useState } from 'react';
import { Button } from './button';

export interface FileUploadProps {
  id: string;
  label: string;
  accept?: string;
  maxSize?: number; // in MB
  onChange: (file: File | null) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export function FileUpload({
  id,
  label,
  accept = 'image/*',
  maxSize = 10,
  onChange,
  onError,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<string>('');
  const [error, setError] = useState<string>('');

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError('');

    if (!file) {
      setFileName('');
      setPreview('');
      onChange(null);
      return;
    }

    // Validate file size
    const fileSizeInMB = file.size / (1024 * 1024);
    if (fileSizeInMB > maxSize) {
      const msg = `File size exceeds ${maxSize}MB limit`;
      setError(msg);
      onError?.(msg);
      setFileName('');
      setPreview('');
      onChange(null);
      return;
    }

    // Validate file type for images
    if (!file.type.startsWith('image/')) {
      const msg = 'Please select a valid image file';
      setError(msg);
      onError?.(msg);
      setFileName('');
      setPreview('');
      onChange(null);
      return;
    }

    setFileName(file.name);
    onChange(file);

    // Create preview for images
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleClick() {
    inputRef.current?.click();
  }

  function handleClear() {
    setFileName('');
    setPreview('');
    setError('');
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-ink-900">
        {label}
      </label>

      <div className="space-y-3">
        <div className="rounded-lg border-2 border-dashed border-ink-200 bg-ink-50 p-6 transition-colors hover:border-ink-300">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />

          {preview ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg bg-white">
                <img src={preview} alt="Preview" className="h-40 w-full object-cover" />
              </div>
              <p className="text-sm text-ink-600">{fileName}</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-ink-600">
                {disabled ? 'Upload disabled' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-ink-500">Images only • Max {maxSize}MB</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleClick} disabled={disabled}>
            {fileName ? 'Change' : 'Choose'} image
          </Button>
          {fileName && (
            <Button type="button" variant="outline" onClick={handleClear} disabled={disabled}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
