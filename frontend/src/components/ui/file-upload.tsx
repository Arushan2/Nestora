import { useRef, useState, useEffect } from 'react';
import { Button } from './button';

export interface FileUploadProps {
  id: string;
  label: string;
  accept?: string;
  maxSize?: number; // in MB
  multiple?: boolean;
  onChange?: (file: File | null) => void;
  onChangeMultiple?: (files: File[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  existingImages?: string[];
  onRemoveExistingImage?: (url: string) => void;
}

export function FileUpload({
  id,
  label,
  accept = 'image/*',
  maxSize = 10,
  multiple = false,
  onChange,
  onChangeMultiple,
  onError,
  disabled = false,
  existingImages = [],
  onRemoveExistingImage,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Single-file states
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Multi-file states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [multiPreviews, setMultiPreviews] = useState<string[]>([]);

  // Reset local state if props change (for single file reset)
  useEffect(() => {
    if (!multiple && fileName === '' && preview === '') {
      // already reset
    }
  }, [multiple]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    setError('');

    if (!fileList || fileList.length === 0) {
      if (!multiple) {
        setFileName('');
        setPreview('');
        onChange?.(null);
      }
      return;
    }

    if (multiple) {
      const newFiles: File[] = [];
      const newPreviews: string[] = [];
      let hasError = false;

      Array.from(fileList).forEach((file) => {
        // Validate file size
        const fileSizeInMB = file.size / (1024 * 1024);
        if (fileSizeInMB > maxSize) {
          const msg = `File "${file.name}" exceeds ${maxSize}MB limit`;
          setError(msg);
          onError?.(msg);
          hasError = true;
          return;
        }

        // Validate file type for images
        if (accept.includes('image/') && !file.type.startsWith('image/')) {
          const msg = `File "${file.name}" is not a valid image`;
          setError(msg);
          onError?.(msg);
          hasError = true;
          return;
        }

        newFiles.push(file);
        newPreviews.push(URL.createObjectURL(file));
      });

      if (hasError) return;

      const updatedFiles = [...selectedFiles, ...newFiles];
      const updatedPreviews = [...multiPreviews, ...newPreviews];

      setSelectedFiles(updatedFiles);
      setMultiPreviews(updatedPreviews);
      onChangeMultiple?.(updatedFiles);

      // Reset input value so same files can be selected again if needed
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } else {
      const file = fileList[0];
      // Validate file size
      const fileSizeInMB = file.size / (1024 * 1024);
      if (fileSizeInMB > maxSize) {
        const msg = `File size exceeds ${maxSize}MB limit`;
        setError(msg);
        onError?.(msg);
        setFileName('');
        setPreview('');
        onChange?.(null);
        return;
      }

      // Validate file type for images
      if (accept.includes('image/') && !file.type.startsWith('image/')) {
        const msg = 'Please select a valid image file';
        setError(msg);
        onError?.(msg);
        setFileName('');
        setPreview('');
        onChange?.(null);
        return;
      }

      setFileName(file.name);
      onChange?.(file);

      // Create preview for images
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleClick() {
    inputRef.current?.click();
  }

  function handleClearSingle() {
    setFileName('');
    setPreview('');
    setError('');
    onChange?.(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  function handleRemoveMulti(index: number) {
    // Revoke object URL to prevent memory leaks
    URL.revokeObjectURL(multiPreviews[index]);

    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    const updatedPreviews = multiPreviews.filter((_, i) => i !== index);

    setSelectedFiles(updatedFiles);
    setMultiPreviews(updatedPreviews);
    onChangeMultiple?.(updatedFiles);
  }

  function handleClearAllMulti() {
    multiPreviews.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setMultiPreviews([]);
    onChangeMultiple?.([]);
    setError('');
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
        <div className="rounded-lg border-2 border-dashed border-ink-200 bg-ink-50 p-4 transition-colors hover:border-ink-300">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />

          {!multiple && (
            preview ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-lg bg-white border border-ink-100 flex items-center justify-center p-2">
                  <img src={preview} alt="Preview" className="h-32 max-h-32 object-contain" />
                </div>
                <p className="text-xs text-ink-600 truncate">{fileName}</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-ink-600">
                  {disabled ? 'Upload disabled' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-ink-500">Images only • Max {maxSize}MB</p>
              </div>
            )
          )}

          {multiple && (
            <div className="space-y-4">
              {/* Grid of existing + newly selected previews */}
              {(existingImages.length > 0 || multiPreviews.length > 0) ? (
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {/* Existing Images */}
                  {existingImages.map((url, index) => (
                    <div key={`existing-${index}`} className="group relative aspect-square w-full overflow-hidden rounded-xl border border-ink-200 bg-white">
                      <img src={url} alt={`Existing ${index}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => onRemoveExistingImage?.(url)}
                        className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white opacity-90 hover:opacity-100 hover:bg-red-700 transition-opacity"
                        title="Remove existing image"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <span className="absolute bottom-0 inset-x-0 bg-ink-900/60 text-[8px] font-semibold text-white text-center py-0.5">
                        Current
                      </span>
                    </div>
                  ))}

                  {/* New Images */}
                  {multiPreviews.map((url, index) => (
                    <div key={`new-${index}`} className="group relative aspect-square w-full overflow-hidden rounded-xl border border-ink-200 bg-white">
                      <img src={url} alt={`New ${index}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveMulti(index)}
                        className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white opacity-90 hover:opacity-100 hover:bg-red-700 transition-opacity"
                        title="Remove image"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <span className="absolute bottom-0 inset-x-0 bg-aura-600/70 text-[8px] font-semibold text-white text-center py-0.5">
                        New
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-ink-600">
                    {disabled ? 'Upload disabled' : 'Click to select one or more images'}
                  </p>
                  <p className="text-xs text-ink-500">Multiple images allowed • Max {maxSize}MB each</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!multiple ? (
            <>
              <Button type="button" variant="outline" className="py-1 px-3 text-xs" onClick={handleClick} disabled={disabled}>
                {fileName ? 'Change' : 'Choose'} image
              </Button>
              {fileName && (
                <Button type="button" variant="outline" className="py-1 px-3 text-xs" onClick={handleClearSingle} disabled={disabled}>
                  Clear
                </Button>
              )}
            </>
          ) : (
            <>
              <Button type="button" variant="outline" className="py-1 px-3 text-xs" onClick={handleClick} disabled={disabled}>
                Add images
              </Button>
              {(selectedFiles.length > 0 || existingImages.length > 0) && (
                <Button type="button" variant="outline" className="py-1 px-3 text-xs text-red-600 hover:bg-red-50 border-red-200" onClick={handleClearAllMulti} disabled={disabled}>
                  Clear All New
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
