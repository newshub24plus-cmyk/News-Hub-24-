import { Check, Copy, Download, FileCode2, History, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ApkReleaseEntry } from '../data/newsData';

export interface ApkInspectionInfo {
  filename: string;
  version: string;
  versionCode: number;
  packageId: string;
  minAndroid: string;
  sizeBytes: number;
  sizeFormatted: string;
  sha256: string;
  downloadUrl: string;
  releasedAt: string;
  downloadsCount: number;
}

export interface ApkManifestEntry {
  name: string;
  role: string;
}

interface ApkInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  apkInfo: ApkInspectionInfo;
  manifestFiles: ApkManifestEntry[];
  releaseHistory: ApkReleaseEntry[];
  onDownloadClick: () => void;
}

type ModalTab = 'all' | 'changelog' | 'manifest';

export function ApkInspectionModal({
  isOpen,
  onClose,
  apkInfo,
  manifestFiles,
  releaseHistory,
  onDownloadClick
}: ApkInspectionModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('all');
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopySha = async () => {
    try {
      await navigator.clipboard.writeText(apkInfo.sha256);
      setCopiedHash(true);
      window.setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      setCopiedHash(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-8 sm:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-inspection-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#FBF9F5] dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#1C1B19]">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-0.5">
              Android Package Inspection &amp; Release History
            </p>
            <h2
              id="apk-inspection-modal-title"
              className="font-mono text-base sm:text-lg font-semibold text-[#141413] dark:text-[#F5F3EE] truncate"
            >
              {apkInfo.filename}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close APK inspection modal"
            className="inline-flex items-center justify-center w-9 h-9 text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Technical Metadata Bar + Tab Selector */}
        <div className="px-6 py-4 bg-white dark:bg-[#191816] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#57534E] dark:text-[#A8A29E]">
            <span className="font-mono font-medium text-[#141413] dark:text-[#F5F3EE]">{apkInfo.packageId}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              v{apkInfo.version} (Build {apkInfo.versionCode})
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{apkInfo.sizeFormatted}</span>
            <span aria-hidden="true">·</span>
            <span>{apkInfo.minAndroid}</span>
          </div>

          <div
            role="tablist"
            aria-label="Inspect APK sections"
            className="inline-flex items-center gap-1 p-1 bg-[#F5F2EB] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md self-start"
          >
            {[
              { id: 'all' as const, label: 'All Details' },
              { id: 'changelog' as const, label: 'Changelog' },
              { id: 'manifest' as const, label: 'Archive Files' }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-[#262420] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                      : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="px-6 py-6 max-h-[65vh] overflow-y-auto space-y-8">
          {/* SHA-256 Verification Box */}
          <div className="p-4 bg-white dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">SHA-256 Checksum</span>
              <button
                type="button"
                onClick={handleCopySha}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171]"
              >
                {copiedHash ? (
                  <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
              </button>
            </div>
            <p className="font-mono text-[11px] text-[#44403C] dark:text-[#D6D3CD] break-all select-all">
              {apkInfo.sha256}
            </p>
          </div>

          {/* Archive Manifest Entries */}
          {(activeTab === 'all' || activeTab === 'manifest') && (
            <section aria-labelledby="apk-archive-heading">
              <div className="flex items-center gap-2 mb-3">
                <FileCode2 className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                <h3 id="apk-archive-heading" className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Archive Contents
                </h3>
              </div>
              <div className="bg-white dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                {manifestFiles.map((entry) => (
                  <div
                    key={entry.name}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                  >
                    <span className="font-mono font-medium text-[#141413] dark:text-[#F5F3EE]">{entry.name}</span>
                    <span className="text-[#57534E] dark:text-[#A8A29E]">{entry.role}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Dynamic Changelog & Version History */}
          {(activeTab === 'all' || activeTab === 'changelog') && (
            <section aria-labelledby="apk-changelog-heading">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                  <h3 id="apk-changelog-heading" className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Version History &amp; Release Notes
                  </h3>
                </div>
                <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                  {releaseHistory.length} releases
                </span>
              </div>

              <div className="space-y-4">
                {releaseHistory.map((release) => (
                  <article
                    key={release.version}
                    className="p-5 bg-white dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#F0EDE6] dark:border-[#2C2A26]">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-sm font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                          v{release.version}
                        </span>
                        <span aria-hidden="true" className="text-[#A8A29E] dark:text-[#57534E]">
                          ·
                        </span>
                        <span className="font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                          Build {release.versionCode}
                        </span>
                        <span aria-hidden="true" className="text-[#A8A29E] dark:text-[#57534E]">
                          ·
                        </span>
                        <span
                          className={
                            release.channel === 'Current Stable'
                              ? 'font-semibold text-[#14532D] dark:text-[#4ADE80]'
                              : 'text-[#57534E] dark:text-[#A8A29E]'
                          }
                        >
                          {release.channel}
                        </span>
                      </div>
                      <time className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E]">{release.releaseDate}</time>
                    </div>

                    <p className="text-sm font-medium text-[#141413] dark:text-[#F5F3EE] leading-relaxed mb-3">
                      {release.summary}
                    </p>

                    <ul className="space-y-1.5 text-xs text-[#44403C] dark:text-[#D6D3CD] leading-relaxed list-disc pl-4">
                      {release.notes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#1C1B19] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#57534E] dark:text-[#A8A29E]">
            Published by <strong className="text-[#141413] dark:text-[#F5F3EE] font-semibold">News Hub 24+.com</strong>
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#EAE5DC] dark:hover:bg-[#2E2C28] transition-colors whitespace-nowrap"
            >
              Close
            </button>
            <a
              href={apkInfo.downloadUrl}
              download={apkInfo.filename}
              onClick={onDownloadClick}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {apkInfo.filename}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
