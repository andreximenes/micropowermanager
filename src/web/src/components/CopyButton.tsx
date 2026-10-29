import { Button } from '@spark/ui/button';
import { Copy } from 'lucide-react';
import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      <Copy aria-hidden="true" />
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}
