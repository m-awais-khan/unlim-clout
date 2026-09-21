import React, { useRef, useEffect } from 'react';
import { FolderPlus, FileUp, FolderUp, HardDrive } from 'lucide-react';

export default function NewItemMenu({
  onCreateFolder,
  onUploadFile,
  onUploadFolder,
  onUploadFromDrive,
  onUploadFolderFromDrive,
  driveEnabled = false,
  uploading = false,
  isDriveTransferDisabled = false,
  onClose,
  className = '',
  style = {}
}) {

  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        if (onClose) onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onClose) onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={style}
      onClick={(e) => e.stopPropagation()}
      className={`bg-[#1e1f20] border border-[#444746] rounded-xl shadow-2xl w-56 py-2 z-50 text-sm text-[#E8EAED] select-none animate-in fade-in zoom-in-95 duration-100 ${className}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onClose) onClose();
          if (onCreateFolder) onCreateFolder();
        }}
        className="cursor-pointer w-full text-left px-4 py-2.5 hover:bg-[#333538] flex items-center gap-3 text-slate-200 transition-colors select-none"
      >
        <FolderPlus size={18} className="text-[#C4C7C5]" />
        <span className="font-normal text-[14px]">New folder</span>
      </button>

      <div className="border-t border-[#444746] my-1"></div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onClose) onClose();
          if (onUploadFile) onUploadFile();
        }}
        disabled={uploading}
        className="cursor-pointer w-full text-left px-4 py-2.5 hover:bg-[#333538] flex items-center gap-3 text-slate-200 disabled:opacity-50 transition-colors select-none"
      >
        <FileUp size={18} className="text-[#C4C7C5]" />
        <span className="font-normal text-[14px]">File upload</span>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onClose) onClose();
          if (onUploadFolder) onUploadFolder();
        }}
        disabled={uploading}
        className="cursor-pointer w-full text-left px-4 py-2.5 hover:bg-[#333538] flex items-center gap-3 text-slate-200 disabled:opacity-50 transition-colors select-none"
      >
        <FolderUp size={18} className="text-[#C4C7C5]" />
        <span className="font-normal text-[14px]">Folder upload</span>
      </button>

      {driveEnabled && (
        <>
          <div className="border-t border-[#444746] my-1"></div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (uploading || isDriveTransferDisabled) return;
              if (onClose) onClose();
              if (onUploadFromDrive) onUploadFromDrive();
            }}
            disabled={uploading || isDriveTransferDisabled}
            title={
              (uploading || isDriveTransferDisabled)
                ? "Transfer in progress (Concurrent Drive transfers coming soon)"
                : "Upload file from Google Drive"
            }
            className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors select-none ${
              (uploading || isDriveTransferDisabled)
                ? "opacity-50 cursor-not-allowed text-[#8E918F]"
                : "cursor-pointer hover:bg-[#333538] text-[#A8C7FA]"
            }`}
          >
            <div className="flex items-center gap-3">
              <HardDrive size={18} className={(uploading || isDriveTransferDisabled) ? "text-[#8E918F]" : "text-[#A8C7FA]"} />
              <span className="font-normal text-[14px]">Upload file from Drive</span>
            </div>
            {(uploading || isDriveTransferDisabled) && (
              <span className="text-[10px] bg-[#3C4043] text-[#9AA0A6] px-1.5 py-0.5 rounded font-medium">
                Busy
              </span>
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (uploading || isDriveTransferDisabled) return;
              if (onClose) onClose();
              if (onUploadFolderFromDrive) onUploadFolderFromDrive();
            }}
            disabled={uploading || isDriveTransferDisabled}
            title={
              (uploading || isDriveTransferDisabled)
                ? "Transfer in progress (Concurrent Drive transfers coming soon)"
                : "Upload folder from Google Drive"
            }
            className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors select-none ${
              (uploading || isDriveTransferDisabled)
                ? "opacity-50 cursor-not-allowed text-[#8E918F]"
                : "cursor-pointer hover:bg-[#333538] text-[#A8C7FA]"
            }`}
          >
            <div className="flex items-center gap-3">
              <FolderUp size={18} className={(uploading || isDriveTransferDisabled) ? "text-[#8E918F]" : "text-[#A8C7FA]"} />
              <span className="font-normal text-[14px]">Upload folder from Drive</span>
            </div>
            {(uploading || isDriveTransferDisabled) && (
              <span className="text-[10px] bg-[#3C4043] text-[#9AA0A6] px-1.5 py-0.5 rounded font-medium">
                Busy
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );
}

