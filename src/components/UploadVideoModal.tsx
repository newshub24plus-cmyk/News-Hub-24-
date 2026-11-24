import { Film, UploadCloud, X } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import {
  ARTICLE_CATALOGS,
  formatFileSizeUnlimited,
  type NewsCategory,
  type VideoReelItem
} from '../data/newsData';
import type { RevenueEngineResponse } from './VideoReelsHubSection';

interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (payload: {
    video: VideoReelItem;
    message: string;
    revenueEngine: RevenueEngineResponse;
  }) => void;
}

const DEFAULT_CHUNK_BYTES = 4 * 1024 * 1024; // 4 MB streaming slices (handles MB, GB & TB cleanly)

export function UploadVideoModal({ isOpen, onClose, onUploaded }: UploadVideoModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [probedDurationSec, setProbedDurationSec] = useState<number>(30);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [category, setCategory] = useState<Exclude<NewsCategory, 'All'>>('Movie Snippets');
  const [title, setTitle] = useState<string>('');
  const [creator, setCreator] = useState<string>('');
  const [bureau, setBureau] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  const [sponsorCtaLabel, setSponsorCtaLabel] = useState<string>('');

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadedBytes, setUploadedBytes] = useState<number>(0);
  const [speedMbps, setSpeedMbps] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeUploadIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !uploading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, uploading, onClose]);

  if (!isOpen) return null;

  const inspectSelectedFile = (file: File) => {
    setSelectedFile(file);
    setError(null);
    setUploadedBytes(0);
    setSpeedMbps(0);

    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      setTitle(cleanName.length >= 3 ? cleanName : `${file.name} Video Dispatch`);
    }

    // Safely probe duration via object URL without buffering the entire file into JS memory
    try {
      const tempUrl = URL.createObjectURL(file);
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        if (Number.isFinite(probe.duration) && probe.duration >= 3) {
          setProbedDurationSec(Math.round(probe.duration));
        }
        URL.revokeObjectURL(tempUrl);
      };
      probe.onerror = () => {
        URL.revokeObjectURL(tempUrl);
      };
      probe.src = tempUrl;
    } catch {
      setProbedDurationSec(30);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) inspectSelectedFile(file);
  };

  const handleCancelUpload = async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (activeUploadIdRef.current) {
      await fetch(`/api/videos/upload/${encodeURIComponent(activeUploadIdRef.current)}`, {
        method: 'DELETE'
      }).catch(() => {});
      activeUploadIdRef.current = null;
    }
    setUploading(false);
    setUploadedBytes(0);
    setSpeedMbps(0);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError('Please choose or drop a video file (any MB, GB, or TB size).');
      return;
    }
    if (title.trim().length < 3) {
      setError('Please enter a video title (at least 3 characters).');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    setUploadedBytes(0);
    const startedAt = performance.now();

    try {
      // 1. Initialize unlimited chunked session (no file-size limit)
      const initRes = await fetch('/api/videos/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          fileName: selectedFile.name,
          mimeType: selectedFile.type || 'video/mp4',
          totalBytes: selectedFile.size,
          title: title.trim(),
          category,
          creator: creator.trim(),
          bureau: bureau.trim(),
          caption: caption.trim(),
          sponsorCtaLabel: sponsorCtaLabel.trim(),
          durationSec: probedDurationSec
        })
      });

      const initPayload = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initPayload.error || 'Failed to initialize video upload session.');
      }

      const uploadId = initPayload.uploadId as string;
      const chunkSize = Number(initPayload.chunkSizeBytes) || DEFAULT_CHUNK_BYTES;
      activeUploadIdRef.current = uploadId;

      // 2. Stream sequential file slices (File.slice keeps browser memory tiny for GB/TB files)
      let offset = 0;
      while (offset < selectedFile.size) {
        const end = Math.min(selectedFile.size, offset + chunkSize);
        const slice = selectedFile.slice(offset, end);

        const chunkRes = await fetch(
          `/api/videos/upload/${encodeURIComponent(uploadId)}/chunk?offset=${offset}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: slice,
            signal: controller.signal
          }
        );

        const chunkPayload = await chunkRes.json();
        if (!chunkRes.ok) {
          throw new Error(chunkPayload.error || 'Chunk transfer interrupted.');
        }

        offset = end;
        setUploadedBytes(offset);
        const elapsedSec = Math.max(0.05, (performance.now() - startedAt) / 1000);
        setSpeedMbps(Number((offset / (1024 * 1024) / elapsedSec).toFixed(1)));
      }

      // 3. Finalize video into monetized Video Hub
      const completeRes = await fetch(
        `/api/videos/upload/${encodeURIComponent(uploadId)}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ durationSec: probedDurationSec })
        }
      );

      const completePayload = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completePayload.error || 'Failed to finalize uploaded video.');
      }

      activeUploadIdRef.current = null;
      setSelectedFile(null);
      setTitle('');
      setCreator('');
      setBureau('');
      setCaption('');
      setSponsorCtaLabel('');
      setUploadedBytes(0);
      setSpeedMbps(0);

      onUploaded({
        video: completePayload.video as VideoReelItem,
        message: completePayload.message as string,
        revenueEngine: completePayload.revenueEngine as RevenueEngineResponse
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Video upload cancelled.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to complete video upload.');
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const progressPct =
    selectedFile && selectedFile.size > 0
      ? Math.min(100, Math.round((uploadedBytes / selectedFile.size) * 100))
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-8 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-video-modal-title"
      onClick={() => {
        if (!uploading) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-[#FBF9F5] dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#1C1B19]">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-0.5 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" />
              <span>Unlimited Size Chunked Broadcast Upload (MB · GB · TB)</span>
            </p>
            <h2
              id="upload-video-modal-title"
              className="font-serif text-lg sm:text-xl font-semibold text-[#141413] dark:text-[#F5F3EE]"
            >
              Upload Video to News Hub 24+ Revenue Stream
            </h2>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={onClose}
            aria-label="Close video upload modal"
            className="inline-flex items-center justify-center w-9 h-9 text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] disabled:opacity-50 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* File Drop Zone (Zero File-Size Limit) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (!uploading) fileInputRef.current?.click();
            }}
            className={`p-6 border-2 border-dashed rounded-md text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-[#991B1B] bg-[#FEF2F2] dark:bg-[#2A1515]/50'
                : 'border-[#D6D1C7] dark:border-[#3A3732] bg-white dark:bg-[#1C1B19] hover:border-[#141413] dark:hover:border-[#F5F3EE]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.mov,.mkv,.webm,.avi,.mxf,.m4v,.ts"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) inspectSelectedFile(file);
              }}
              className="sr-only"
              aria-label="Select video file of any size"
            />
            <UploadCloud className="w-7 h-7 mx-auto mb-2 text-[#991B1B] dark:text-[#F87171]" />
            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#141413] dark:text-[#F5F3EE] break-all">
                  {selectedFile.name}
                </p>
                <p className="font-mono text-xs text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  Size: {formatFileSizeUnlimited(selectedFile.size)} ({selectedFile.size.toLocaleString()} bytes) · Unlimited cap accepted
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Click to select or drop any video file here
                </p>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                  No size cap — supports MB, GB, and TB master video files via 4 MB streaming slices (MP4, MOV, WebM, MKV, MXF).
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="vid-category"
                className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
              >
                Catalog Section *
              </label>
              <select
                id="vid-category"
                disabled={uploading}
                value={category}
                onChange={(e) => setCategory(e.target.value as Exclude<NewsCategory, 'All'>)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
              >
                {ARTICLE_CATALOGS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="vid-creator"
                className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
              >
                Creator / Desk Name
              </label>
              <input
                id="vid-creator"
                type="text"
                disabled={uploading}
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                placeholder="e.g. Cinema Desk · Independent Creator"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="vid-title"
              className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
            >
              Broadcast Title *
            </label>
            <input
              id="vid-title"
              type="text"
              required
              disabled={uploading}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video reel or feature title..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="vid-bureau"
                className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
              >
                Bureau / City Desk
              </label>
              <input
                id="vid-bureau"
                type="text"
                disabled={uploading}
                value={bureau}
                onChange={(e) => setBureau(e.target.value)}
                placeholder="e.g. Lagos Desk · London Bureau"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
              />
            </div>

            <div>
              <label
                htmlFor="vid-cta"
                className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
              >
                Sponsored Click CTA ($0.45/Click)
              </label>
              <input
                id="vid-cta"
                type="text"
                disabled={uploading}
                value={sponsorCtaLabel}
                onChange={(e) => setSponsorCtaLabel(e.target.value)}
                placeholder="e.g. Sponsor: Featured Premiere Link"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="vid-caption"
              className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
            >
              Broadcast Caption / Description
            </label>
            <input
              id="vid-caption"
              type="text"
              disabled={uploading}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Short broadcast note displayed in the Video Hub..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
            />
          </div>

          {uploading && selectedFile && (
            <div className="p-4 bg-white dark:bg-[#1C1B19] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-md space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Streaming chunks: {formatFileSizeUnlimited(uploadedBytes)} / {formatFileSizeUnlimited(selectedFile.size)}
                </span>
                <span className="text-[#14532D] dark:text-[#4ADE80]">
                  {progressPct}% · {speedMbps} MB/s
                </span>
              </div>
              <svg viewBox="0 0 100 2" className="w-full h-2 rounded-sm overflow-hidden bg-[#EFECE6] dark:bg-[#262420]" aria-hidden="true">
                <rect x="0" y="0" width={progressPct} height="2" className="fill-[#991B1B] dark:fill-[#DC2626]" />
              </svg>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] px-3 py-2 rounded-md"
            >
              {error}
            </p>
          )}

          <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-mono text-[#57534E] dark:text-[#A8A29E]">
              Max size: Unlimited (MB · GB · TB)
            </span>

            <div className="flex items-center gap-2.5">
              {uploading ? (
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="px-4 py-2 text-xs font-semibold text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] rounded-md transition-colors"
                >
                  Cancel Upload
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-55 transition-colors"
              >
                {uploading ? `Uploading (${progressPct}%)…` : 'Upload & Monetize Video'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
