import { Check, Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SeoInspectorModalProps {
  endpointPath: string | null;
  label: string;
  onClose: () => void;
}

export function SeoInspectorModal({ endpointPath, label, onClose }: SeoInspectorModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!endpointPath) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(endpointPath)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load endpoint');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [endpointPath]);

  useEffect(() => {
    if (!endpointPath) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [endpointPath, onClose]);

  if (!endpointPath) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seo-inspector-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#FBF9F5] dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#1C1B19]">
          <div className="min-w-0">
            <h3 id="seo-inspector-title" className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
              {label}
            </h3>
            <p className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] truncate">{endpointPath}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || !!error}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Output'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              className="inline-flex items-center justify-center w-9 h-9 text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[68vh] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-[#57534E] dark:text-[#A8A29E]">Fetching live search-engine payload…</p>
          ) : error ? (
            <p className="text-sm text-[#991B1B] dark:text-[#FCA5A5]">Failed to fetch endpoint: {error}</p>
          ) : (
            <pre className="p-4 bg-[#141413] dark:bg-[#090908] text-[#F5F2EB] border border-transparent dark:border-[#2C2A26] font-mono text-xs leading-relaxed rounded-md overflow-x-auto whitespace-pre-wrap break-all">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
