import React from 'react';
import {
  Folder as FolderIcon,
  ChevronDown,
  ChevronUp,
  X,
  Check
} from 'lucide-react';
import FileIcon from './FileIcon';

export default function UploadWidget({
  uploadWidgetOpen,
  setUploadWidgetOpen,
  uploadMinimized,
  setUploadMinimized,
  uploadCancelled,
  uploadComplete,
  uploading,
  isFolderUploadState,
  uploadStats,
  uploadItemName,
  timeLeftText,
  overallProgress,
  uploadedFolderId,
  currentFolderId,
  breadcrumbs,
  setShowCancelModal,
  handleDirectCancelItem,
  handleOpenUploadedFolder,
  handleLocateUploadedItem
}) {
  if (!uploadWidgetOpen) return null;

  const isFolderOpened = Boolean(
    uploadComplete &&
    isFolderUploadState &&
    (
      (uploadedFolderId && currentFolderId === uploadedFolderId) ||
      (currentFolderId !== null && breadcrumbs[breadcrumbs.length - 1]?.name === uploadItemName)
    )
  );

  return (
    <div className="fixed bottom-4 right-6 w-[360px] bg-[#202124] border border-[#3C4043] rounded-xl shadow-2xl overflow-hidden z-50 text-[#E8EAED] select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#202124]">
        <span className="text-sm font-medium">
          {uploadCancelled
            ? `${isFolderUploadState ? '1' : uploadStats.total} upload${(!isFolderUploadState && uploadStats.total > 1) ? 's' : ''} cancelled`
            : uploadComplete
              ? `${uploadStats.total} upload${uploadStats.total > 1 ? 's' : ''} complete`
              : isFolderUploadState
                ? `Uploading 1 item`
                : `Uploading ${uploadStats.total} item${uploadStats.total > 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setUploadMinimized(!uploadMinimized)}
            className="cursor-pointer p-1 hover:bg-[#3C4043] rounded-full text-[#C4C7C5] transition-colors"
            title={uploadMinimized ? "Expand" : "Minimize"}
          >
            {uploadMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            onClick={() => {
              if (uploading && !uploadComplete && !uploadCancelled) {
                setShowCancelModal(true);
              } else {
                setUploadWidgetOpen(false);
              }
            }}
            className="cursor-pointer p-1 hover:bg-[#3C4043] rounded-full text-[#C4C7C5] transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {!uploadMinimized && (
        <div>
          {/* Status bar with time left and cancel (hidden when cancelled or complete) */}
          {!uploadComplete && !uploadCancelled && (
            <div className="bg-[#2B2C2F] px-4 py-2 flex items-center justify-between text-xs text-[#C4C7C5]">
              <span>
                {timeLeftText || 'Starting upload...'}
              </span>
              <button
                onClick={handleDirectCancelItem}
                className="cursor-pointer text-[#8AB4F8] hover:underline font-medium"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Item progress row */}
          <div
            onClick={() => {
              if (uploadComplete && isFolderUploadState) {
                handleOpenUploadedFolder();
              }
            }}
            className={`group relative px-4 py-3 flex items-center justify-between text-sm transition-colors ${
              uploadComplete && isFolderUploadState
                ? 'cursor-pointer hover:bg-[#282A2D]'
                : 'hover:bg-[#282A2D]/50'
            }`}
          >
            {/* Active/Opened Folder Blue Indicator Line */}
            {isFolderOpened && (
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8AB4F8]" />
            )}

            <div className="flex items-center gap-3 overflow-hidden pr-2">
              {isFolderUploadState ? (
                <FolderIcon size={20} className="text-[#9AA0A6] flex-shrink-0" />
              ) : (
                <FileIcon filename={uploadItemName} size={20} className="flex-shrink-0" />
              )}
              <span className="truncate max-w-[180px] text-[#E8EAED]" title={uploadItemName}>
                {uploadItemName}
              </span>
              {uploadCancelled ? (
                <span className="text-xs text-[#9AA0A6] whitespace-nowrap ml-1">
                  Upload cancelled
                </span>
              ) : (
                <span className="text-xs text-[#9AA0A6] whitespace-nowrap">
                  {uploadComplete
                    ? `${uploadStats.total} of ${uploadStats.total}`
                    : `${uploadStats.current > 0 ? uploadStats.current - 1 : 0} of ${uploadStats.total}`}
                </span>
              )}
            </div>

            {!uploadCancelled && (
              <div className="flex-shrink-0 ml-2">
                {uploadComplete ? (
                  <div className="relative w-7 h-7 flex items-center justify-center">
                    {/* Normal State: Solid filled green circle with dark checkmark */}
                    <div className="group-hover:hidden w-5 h-5 rounded-full bg-[#34A853] text-[#131314] flex items-center justify-center shadow-sm">
                      <Check size={13} strokeWidth={3.5} />
                    </div>

                    {/* Hover State: Outline folder icon with circular hover background */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLocateUploadedItem();
                      }}
                      className="cursor-pointer hidden group-hover:flex w-7 h-7 rounded-full items-center justify-center hover:bg-[#3C4043] text-[#C4C7C5] hover:text-white transition-colors"
                      title="Show location"
                    >
                      <FolderIcon size={18} strokeWidth={1.8} />
                    </button>
                  </div>
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
                          strokeDashoffset={56.54 - (56.54 * (overallProgress || 3)) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-300"
                        />
                      </svg>
                    </div>

                    {/* Hover State: White circular cross button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDirectCancelItem();
                      }}
                      className="cursor-pointer hidden group-hover:flex w-5 h-5 rounded-full bg-[#E8EAED] hover:bg-white text-[#131314] items-center justify-center transition-colors shadow-sm"
                      title="Cancel upload"
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
