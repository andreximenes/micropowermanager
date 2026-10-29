import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';

import { ApiError } from '@/api/client';
import { uploadDocument } from '@/api/customers';
import { Field } from '@/components/form';
import { Sheet } from '@/components/Sheet';

// The backend's `StorePersonDocumentRequest` accepts these, up to 5 MB.
const ACCEPTED_EXTENSIONS = ['pdf', 'docx'];
const MAX_BYTES = 5 * 1024 * 1024;

type Errors = { type?: string; file?: string };

function fileError(file: File | null): string | undefined {
  if (!file) {
    return 'Choose a PDF or Word (.docx) file.';
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return 'Only PDF and Word (.docx) files can be uploaded.';
  }
  if (file.size > MAX_BYTES) {
    return 'The file is larger than 5 MB.';
  }
  return undefined;
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type UploadDocumentSheetProps = { customerId: number; customerName: string; onClose: () => void };

export function UploadDocumentSheet({ customerId, customerName, onClose }: UploadDocumentSheetProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const [type, setType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const upload = useMutation({
    mutationFn: (document: { file: File; type: string }) =>
      uploadDocument(customerId, document.file, document.type),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', customerId] });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrors({ type: error.fieldErrors.type?.[0], file: error.fieldErrors.file?.[0] });
      }
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const found: Errors = {
      type: type.trim() === '' ? 'Say what the document is, e.g. National ID.' : undefined,
      file: fileError(file),
    };
    setErrors(found);
    if (found.type || found.file || !file) {
      return;
    }
    upload.mutate({ file, type: type.trim() });
  }

  return (
    <Sheet
      title="Upload document"
      description={`For ${customerName}. PDF or Word (.docx), up to 5 MB.`}
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
        {upload.isError ? (
          <Banner tone="error" role="alert">
            The document was not uploaded: {upload.error.message}
          </Banner>
        ) : null}
        <Field label="Document type *" error={errors.type}>
          <Input
            autoComplete="off"
            maxLength={255}
            placeholder="National ID, signed contract…"
            aria-invalid={Boolean(errors.type)}
            value={type}
            onChange={(event) => setType(event.target.value)}
          />
        </Field>
        <Field label="File *" error={errors.file}>
          <span className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-panel-2">
              <FileUp className="size-4" aria-hidden="true" />
              {file ? 'Replace file' : 'Choose file'}
            </span>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-invalid={Boolean(errors.file)}
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setErrors((current) => ({ ...current, file: undefined }));
              }}
            />
            {file ? (
              <span className="min-w-0 truncate text-sm font-normal text-foreground">
                {file.name} · {formatSize(file.size)}
              </span>
            ) : null}
          </span>
        </Field>
      </form>
    </Sheet>
  );
}
