'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useHumeTheme } from '@/lib/useHumeTheme';

type ResumeUploadDropzoneProps = {
  onFile: (file: File) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
};

export function ResumeUploadDropzone({ onFile, loading, disabled }: ResumeUploadDropzoneProps) {
  const isHume = useHumeTheme();
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
          isHume
            ? dragOver
              ? 'border-[var(--color-iris)] bg-[var(--color-rose-mist)]'
              : 'border-[rgba(34,34,34,0.12)] bg-[var(--color-bone)] hover:border-[rgba(34,34,34,0.18)]'
            : dragOver
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
        <InboxOutlined
          className={`text-2xl mb-2 block ${isHume ? 'text-[var(--color-smoke)]' : 'text-green-400/90'}`}
          aria-hidden
        />
        <p className={isHume ? 'hume-body-sm text-sm mb-1' : 'text-sm text-slate-300 mb-1'}>
          Перетащите файл резюме сюда или нажмите кнопку ниже
        </p>
        <p className={isHume ? 'hume-body-sm !text-xs mb-4' : 'text-xs text-slate-500 mb-4'}>
          PDF или DOCX, до 12 МБ
        </p>
        <Button
          type="primary"
          loading={loading}
          disabled={disabled || loading}
          onClick={() => inputRef.current?.click()}
          className={
            isHume
              ? 'hume-btn-pill !h-9 !px-6 !border-none'
              : 'rounded-full border-none bg-green-500 px-6 h-9 text-white shadow-lg hover:bg-green-400 !text-white'
          }
        >
          Выбрать файл
        </Button>
      </div>
    </div>
  );
}
