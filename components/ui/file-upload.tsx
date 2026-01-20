'use client';

import * as React from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
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
  variant?: 'default' | 'minimal' | 'compact';
}

export function FileUpload({
  onFilesSelected,
  accept,
  maxFiles = 0, // 0 = unlimited
  maxSize = 10 * 1024 * 1024, // 10MB default
  className,
  multiple = false,
  preview = false,
  hideFileList = false,
  variant = 'default',
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles,
    maxSize,
    multiple,
    onDrop: (acceptedFiles) => {
      const newFiles = multiple ? [...selectedFiles, ...acceptedFiles] : acceptedFiles;
      setSelectedFiles(newFiles);
      onFilesSelected(acceptedFiles);

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

  // Minimal variant - More compact and modern
  if (variant === 'minimal') {
    return (
      <div className={className}>
        <div
          {...getRootProps()}
          className={cn(
            'group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all',
            'min-h-[200px] w-full focus:outline-none',
            isDragActive
              ? 'border-brand-accent bg-brand-accent/5 scale-[1.02]'
              : 'border-gray-800 bg-gray-900/30 hover:border-gray-700 hover:bg-gray-900/50'
          )}
        >
          <input {...getInputProps()} className="focus:outline-none" />
          
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              "rounded-full p-4 transition-all",
              isDragActive 
                ? "bg-brand-accent/20" 
                : "bg-gray-800/50 group-hover:bg-gray-800"
            )}>
              <Upload className={cn(
                "h-8 w-8 transition-colors",
                isDragActive ? "text-brand-accent" : "text-gray-400 group-hover:text-gray-300"
              )} />
            </div>
            
            <div className="text-center">
              <p className="text-sm font-medium text-gray-300">
                {isDragActive ? 'Suelta aquí' : 'Haz clic o arrastra'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {multiple ? 'Múltiples archivos' : 'Un archivo'} · Máx {Math.round(maxSize / 1024 / 1024)}MB
              </p>
            </div>
          </div>
        </div>

        {!hideFileList && selectedFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg bg-gray-900/50 border border-gray-800 p-2.5 transition-colors hover:bg-gray-900"
              >
                <div className="flex items-center gap-2.5">
                  {preview && previews[index] ? (
                    <img
                      src={previews[index]}
                      alt={file.name}
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-800">
                      <ImageIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Compact variant - Even smaller
  if (variant === 'compact') {
    return (
      <div className={cn("h-full w-full", className)}>
        <div
          {...getRootProps()}
          className={cn(
            'group flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-all',
            'h-full w-full focus:outline-none',
            isDragActive
              ? 'border-brand-accent bg-brand-accent/5'
              : 'border-gray-800 bg-gray-900/30 hover:border-gray-700'
          )}
        >
          <input {...getInputProps()} className="focus:outline-none" />
          
          <div className="flex items-center gap-3">
            <Upload className={cn(
              "h-6 w-6 transition-colors",
              isDragActive ? "text-brand-accent" : "text-gray-400 group-hover:text-gray-300"
            )} />
            <div>
              <p className="text-sm font-medium text-gray-300">
                {isDragActive ? 'Suelta aquí' : 'Subir imagen'}
              </p>
              <p className="text-xs text-gray-500">
                Máx {Math.round(maxSize / 1024 / 1024)}MB
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
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
