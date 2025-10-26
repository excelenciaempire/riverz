'use client';

import * as React from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number;
  className?: string;
  multiple?: boolean;
  preview?: boolean;
  hideFileList?: boolean;
}

export function FileUpload({
  onFilesSelected,
  accept,
  maxFiles = 1,
  maxSize = 10 * 1024 * 1024, // 10MB default
  className,
  multiple = false,
  preview = false,
  hideFileList = false,
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles,
    maxSize,
    multiple,
    onDrop: (acceptedFiles) => {
      // For multiple files, append to existing files instead of replacing
      const newFiles = multiple ? [...selectedFiles, ...acceptedFiles] : acceptedFiles;
      setSelectedFiles(newFiles);
      onFilesSelected(acceptedFiles); // Still pass only new files to parent

      if (preview) {
        const urls = acceptedFiles.map((file) => URL.createObjectURL(file));
        const newPreviews = multiple ? [...previews, ...urls] : urls;
        setPreviews(newPreviews);
      }
    },
  });

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);

    if (preview) {
      const newPreviews = previews.filter((_, i) => i !== index);
      setPreviews(newPreviews);
    }
  };

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12',
          'transition-colors focus:outline-none w-full',
          isDragActive
            ? 'border-brand-accent bg-brand-accent/10'
            : 'border-gray-700 bg-transparent hover:border-gray-600'
        )}
      >
        <input {...getInputProps()} className="focus:outline-none" />
        <Upload className="mb-4 h-12 w-12 text-gray-500" />
        <p className="text-center text-sm text-gray-400">
          {isDragActive
            ? 'Suelta los archivos aquí...'
            : 'Haz clic o arrastra archivos aquí'}
        </p>
        {multiple && (
          <p className="mt-1 text-xs text-gray-500">
            Mantén Ctrl/Cmd para seleccionar múltiples archivos
          </p>
        )}
        <p className="mt-2 text-xs text-gray-600">
          Tamaño máximo: {Math.round(maxSize / 1024 / 1024)}MB
        </p>
      </div>

      {/* File previews */}
      {!hideFileList && selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg bg-brand-dark-secondary p-3"
            >
              <div className="flex items-center gap-3">
                {preview && previews[index] && (
                  <img
                    src={previews[index]}
                    alt={file.name}
                    className="h-12 w-12 rounded object-cover"
                  />
                )}
                <div>
                  <p className="text-sm text-white">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

