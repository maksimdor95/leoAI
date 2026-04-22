'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

type ResumeUploadDropzoneProps = {
  onFile: (file: File) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
};

export function ResumeUploadDropzone({ onFile, loading, disabled }: ResumeUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept =
    '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file || disabled || loading) return;
      await onFile(file);
    },
    [disabled, loading, onFile]
  );

  return (
    <div className="mt-4 w-full min-w-0">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(false);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={[
          'rounded-2xl border border-dashed px-4 py-5 sm:px-5 sm:py-6 transition-colors text-center',
          dragOver
            ? 'border-green-400/80 bg-green-500/10'
            : 'border-white/15 bg-white/[0.02] hover:border-white/25',
          disabled ? 'opacity-50 pointer-events-none' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <InboxOutlined className="text-2xl text-green-400/90 mb-2 block" aria-hidden />
        <p className="text-sm text-slate-300 mb-1">
          Перетащите файл резюме сюда или нажмите кнопку ниже
        </p>
        <p className="text-xs text-slate-500 mb-4">PDF или DOCX, до 12 МБ</p>
        <Button
          type="primary"
          loading={loading}
          disabled={disabled || loading}
          onClick={() => inputRef.current?.click()}
          className="rounded-full border-none bg-green-500 px-6 h-9 text-white shadow-lg hover:bg-green-400 !text-white"
        >
          Выбрать файл
        </Button>
      </div>
    </div>
  );
}
