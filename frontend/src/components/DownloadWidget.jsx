import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  Check
} from 'lucide-react';
import FileIcon from './FileIcon';

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function DownloadWidget({
  downloadWidgetOpen,
  setDownloadWidgetOpen,
  downloadMinimized,
  setDownloadMinimized,
  downloadCancelled,
  downloadComplete,
  downloading,
  downloadStatus, // 'downloading' | 'merging' | 'ready' | 'cancelled' | 'failed'
  downloadStats, // { currentBytes, totalBytes }
  downloadItemName,
  timeLeftText,
  downloadProgress, // 0 - 100
  handleDirectCancelDownload,
  setShowCancelDownloadModal,
  uploadWidgetOpen
}) {
  if (!downloadWidgetOpen) return null;

  const isMerging = downloadStatus === 'merging';

  return (
    <div
      className={`fixed bottom-4 ${
        uploadWidgetOpen ? 'right-[390px]' : 'right-6'
      } w-[360px] bg-[#202124] border border-[#3C4043] rounded-xl shadow-2xl overflow-hidden z-50 text-[#E8EAED] select-none transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#202124]">
        <span className="text-sm font-medium">
          {downloadCancelled
            ? '1 download cancelled'
            : downloadComplete
              ? '1 download complete'
              : 'Downloading 1 item'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDownloadMinimized(!downloadMinimized)}
            className="cursor-pointer p-1 hover:bg-[#3C4043] rounded-full text-[#C4C7C5] transition-colors"
            title={downloadMinimized ? 'Expand' : 'Minimize'}
          >
            {downloadMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            onClick={() => {
              if (downloading && !downloadComplete && !downloadCancelled) {
                if (setShowCancelDownloadModal) {
                  setShowCancelDownloadModal(true);
                } else {
                  handleDirectCancelDownload();
                  setDownloadWidgetOpen(false);
                }
              } else {
                setDownloadWidgetOpen(false);
              }
            }}
            className="cursor-pointer p-1 hover:bg-[#3C4043] rounded-full text-[#C4C7C5] transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {!downloadMinimized && (
        <div>
          {/* Status bar with time left / merging status and cancel */}
          {!downloadComplete && !downloadCancelled && (
            <div className="bg-[#2B2C2F] px-4 py-2 flex items-center justify-between text-xs text-[#C4C7C5]">
              <span>
                {isMerging ? 'Doing final steps...' : (timeLeftText || 'Starting download...')}
              </span>
              <button
                onClick={handleDirectCancelDownload}
                className="cursor-pointer text-[#8AB4F8] hover:underline font-medium"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Item progress row */}
          <div className="group relative px-4 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#282A2D]/50">
            <div className="flex items-center gap-3 overflow-hidden pr-2">
              <FileIcon filename={downloadItemName} size={20} className="flex-shrink-0" />
              <span className="truncate max-w-[170px] text-[#E8EAED]" title={downloadItemName}>
                {downloadItemName}
              </span>

              {downloadCancelled ? (
                <span className="text-xs text-[#9AA0A6] whitespace-nowrap ml-1">
                  Download cancelled
                </span>
              ) : isMerging ? (
                <span className="text-xs text-[#8AB4F8] whitespace-nowrap ml-1 font-medium animate-pulse">
                  Doing final steps...
                </span>
              ) : downloadComplete ? (
                <span className="text-xs text-[#9AA0A6] whitespace-nowrap ml-1">
                  {downloadStats.totalBytes ? formatBytes(downloadStats.totalBytes) : 'Complete'}
                </span>
              ) : (
                <span className="text-xs text-[#9AA0A6] whitespace-nowrap ml-1">
                  {downloadStats.totalBytes > 0
                    ? `${formatBytes(downloadStats.currentBytes)} of ${formatBytes(downloadStats.totalBytes)}`
                    : `${Math.round(downloadProgress || 0)}%`}
                </span>
              )}
            </div>

            {!downloadCancelled && (
              <div className="flex-shrink-0 ml-2">
                {downloadComplete ? (
                  <div className="w-5 h-5 rounded-full bg-[#34A853] text-[#131314] flex items-center justify-center shadow-sm">
                    <Check size={13} strokeWidth={3.5} />
                  </div>
                ) : isMerging ? (
                  /* User explicitly instructed: "when downloading is complete then we know we also need some time for merging then stop showing progress circle just tell doing final steps." */
                  null
                ) : (
                  <div className="relative w-5 h-5 flex items-center justify-center">
                    {/* Normal State: SVG Circular Progress Ring */}
                    <div className="group-hover:hidden flex items-center justify-center">
                      <svg className="w-5 h-5 -rotate-90" viewBox="0 0 24 24">
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="#3C4043"
                          strokeWidth="2.5"
                          fill="none"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="#8AB4F8"
                          strokeWidth="2.5"
                          fill="none"
                          strokeDasharray="56.54"
                          strokeDashoffset={56.54 - (56.54 * (downloadProgress || 3)) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-300"
                        />
                      </svg>
                    </div>

                    {/* Hover State: White circular cross button to cancel */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDirectCancelDownload();
                      }}
                      className="cursor-pointer hidden group-hover:flex w-5 h-5 rounded-full bg-[#E8EAED] hover:bg-white text-[#131314] items-center justify-center transition-colors shadow-sm"
                      title="Cancel download"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
