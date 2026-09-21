import React, { useState, useRef, useEffect } from 'react';
import {
  FolderPlus,
  Download,
  Edit2,
  Copy,
  UserPlus,
  Folder as FolderIcon,
  FolderInput,
  CornerUpRight,
  Star,
  Info,
  Clock,
  Trash2,
  ChevronRight,
  Link2,
  Eye,
  Maximize2,
  HardDrive
} from 'lucide-react';


const FOLDER_COLORS = [
  '#8d6e63', '#d9534f', '#ff3b30', '#ff5722', '#ff7043', '#ffa726', '#ffca28', '#fff59d',
  '#aed581', '#7cb342', '#00a651', '#26a69a', '#80cbc4', '#80deea', '#90caf9', '#4285f4',
  '#9fa8da', '#b39ddb', '#ba68c8', '#ce93d8', '#f48fb1', '#d7ccc8', '#cfd8dc', '#90a4ae'
];

export default function ItemActionMenu({
  item,
  type, // 'folder' | 'file'
  onClose,
  align = 'right', // 'right' | 'left' | 'auto'
  className = '',
  style = {},
  isMultiple = false,
  selectedItems = [],
  showNewFolder = false,
  onCreateFolder,
  downloading = false,
  handleDownload,
  handleDownloadFolder,
  handleRename,
  handleRenameFolder,
  handleDelete,
  handleDeleteFolder,
  handleBatchDelete,
  handleCut,
  handleShare,
  handleToggleStar,
  handleMakeCopy,
  starredItems,
  showToast,
  driveEnabled = false,
  handleSaveToDrive,
  isDriveTransferDisabled = false
}) {

  const isDriveBusy = Boolean(isDriveTransferDisabled || downloading);
  const [activeSubmenu, setActiveSubmenu] = useState(null); // null | 'openWith' | 'share' | 'organise' | 'info'
  const [menuAlign, setMenuAlign] = useState(align === 'left' ? 'left' : (align === 'auto' ? 'left' : 'right'));
  const [submenuFlyoutLeft, setSubmenuFlyoutLeft] = useState(align === 'right');
  const menuRef = useRef(null);

  const targetItem = item?.item || item;
  const multiple = Boolean(isMultiple);
  const isFolder = type === 'folder' || targetItem?.type === 'folder' || (!type && targetItem?.name && !targetItem?.filename);
  const name = isFolder ? targetItem?.name : targetItem?.filename;
  const isStarred = starredItems?.has?.(`${type || (isFolder ? 'folder' : 'file')}-${targetItem?.id}`);
  const hasFiles = selectedItems?.some?.(i => (i.type === 'file' || i.item?.filename));
  const infoLabel = multiple
    ? (hasFiles ? 'File information' : (isFolder ? 'Folder information' : 'File information'))
    : (isFolder ? 'Folder information' : 'File information');

  // Handle outside click and Escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Determine menu alignment and submenu flyout direction based on viewport space
  useEffect(() => {
    if (menuRef.current) {
      if (className.includes('fixed') || style.top !== undefined) {
        const rect = menuRef.current.getBoundingClientRect();
        if (rect.right + 250 > window.innerWidth) {
          setSubmenuFlyoutLeft(true);
        } else {
          setSubmenuFlyoutLeft(false);
        }
      } else if (align === 'left') {
        setMenuAlign('left');
        setSubmenuFlyoutLeft(false);
      } else if (align === 'right') {
        setMenuAlign('right');
        setSubmenuFlyoutLeft(true);
      } else { // 'auto' (e.g. for grid cards)
        const parent = menuRef.current.parentElement;
        const rect = parent ? parent.getBoundingClientRect() : menuRef.current.getBoundingClientRect();
        
        // If there's room to the right of the trigger button for a 265px menu:
        if (rect.left + 265 <= window.innerWidth) {
          setMenuAlign('left');
          // Check if submenus (another 260px) would fit to the right:
          if (rect.left + 265 + 260 <= window.innerWidth) {
            setSubmenuFlyoutLeft(false);
          } else {
            setSubmenuFlyoutLeft(true);
          }
        } else {
          setMenuAlign('right');
          setSubmenuFlyoutLeft(true);
        }
      }
    }
  }, [align, className, style]);

  const submenuPosClass = submenuFlyoutLeft
    ? 'right-full top-0 mr-1'
    : 'left-full top-0 ml-1';

  const positionClass = menuAlign === 'left' ? 'left-0' : 'right-0';
  const defaultPositionClass = `absolute ${positionClass} top-full mt-1.5`;

  return (
    <div
      ref={menuRef}
      data-item-action-menu="true"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onMouseLeave={() => setActiveSubmenu(null)}
      className={`w-64 bg-[#1e1f20] border border-[#444746] rounded-xl shadow-2xl py-1.5 z-50 text-sm text-[#E8EAED] select-none animate-in fade-in zoom-in-95 duration-100 ${
        className ? className : defaultPositionClass
      }`}
    >
      {/* --- FOLDER HEADER DROPDOWN: New folder --- */}
      {showNewFolder && isFolder && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              if (onCreateFolder) onCreateFolder();
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <FolderPlus size={18} className="text-[#C4C7C5]" />
              <span className="font-normal text-[14px]">New folder</span>
            </div>
            <span className="text-xs text-[#8E918F]">Alt+C then F</span>
          </button>
          <div className="border-t border-[#444746] my-1"></div>
        </>
      )}
      {/* --- FILE ONLY: Open with --- */}
      {!isFolder && !multiple && (
        <>
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('openWith')}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveSubmenu(prev => prev === 'openWith' ? null : 'openWith');
              }}
              className={`cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none ${
                activeSubmenu === 'openWith' ? 'bg-[#333538]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <Maximize2 size={18} className="text-[#C4C7C5]" />
                <span className="font-normal text-[14px]">Open with</span>
              </div>
              <ChevronRight size={16} className="text-[#C4C7C5]" />
            </button>

            {activeSubmenu === 'openWith' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute ${submenuPosClass} w-48 bg-[#1e1f20] border border-[#444746] rounded-xl shadow-2xl py-1.5 z-50 text-sm text-[#E8EAED]`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (handleDownload) handleDownload(targetItem);
                    onClose();
                  }}
                  className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center gap-3 text-slate-200 transition-colors select-none"
                >
                  <Eye size={18} className="text-[#C4C7C5]" />
                  <span className="font-normal text-[14px]">Preview / Open</span>
                </button>
              </div>
            )}
          </div>
          <div className="border-t border-[#444746] my-1"></div>
        </>
      )}

      {/* --- Download --- */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (downloading) return;
          if (multiple && !targetItem?.id) {
            if (showToast) showToast("Batch download is coming soon");
            setTimeout(() => onClose(), 10);
            return;
          }
          if (isFolder) {
            if (handleDownloadFolder) {
              handleDownloadFolder(e, targetItem);
            } else if (showToast) {
              showToast("Folder downloading is coming soon");
            }
          } else {
            if (handleDownload && targetItem) {
              handleDownload(targetItem);
            }
          }
          setTimeout(() => onClose(), 10);
        }}
        disabled={downloading}
        onMouseEnter={() => setActiveSubmenu(null)}
        className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors select-none ${
          downloading
            ? "text-[#8E918F] opacity-40 cursor-not-allowed"
            : "cursor-pointer hover:bg-[#333538] text-slate-200"
        }`}
        title={downloading ? "Download in progress" : "Download"}
      >
        <Download size={18} className={`pointer-events-none ${downloading ? "text-[#8E918F]" : "text-[#C4C7C5]"}`} />
        <span className="font-normal text-[14px] pointer-events-none">Download</span>
      </button>

      {/* --- Save to Google Drive --- */}
      {driveEnabled && !isFolder && !multiple && (
        <button
          disabled={isDriveBusy}
          onClick={(e) => {
            if (isDriveBusy) return;
            e.stopPropagation();
            if (handleSaveToDrive && targetItem) {
              handleSaveToDrive(targetItem);
            }
            setTimeout(() => onClose(), 10);
          }}
          onMouseEnter={() => setActiveSubmenu(null)}
          className={`w-full text-left px-4 py-2 flex items-center justify-between transition-colors select-none ${
            isDriveBusy
              ? "opacity-50 cursor-not-allowed text-[#8E918F]"
              : "cursor-pointer hover:bg-[#333538] text-[#A8C7FA]"
          }`}
          title={
            isDriveBusy
              ? "Transfer in progress (Concurrent Drive transfers coming soon)"
              : "Save to Google Drive via Colab"
          }
        >
          <div className="flex items-center gap-3">
            <HardDrive size={18} className={`pointer-events-none ${isDriveBusy ? "text-[#8E918F]" : "text-[#A8C7FA]"}`} />
            <span className="font-normal text-[14px] pointer-events-none">Save to Drive</span>
          </div>
          {isDriveBusy && (
            <span className="text-[10px] bg-[#3C4043] text-[#9AA0A6] px-1.5 py-0.5 rounded font-medium">
              Busy
            </span>
          )}
        </button>
      )}


      {/* --- Rename --- */}
      <button
        disabled={multiple}
        onClick={(e) => {
          if (multiple) return;
          e.stopPropagation();
          if (isFolder) {
            if (handleRenameFolder) handleRenameFolder(targetItem);
          } else {
            if (handleRename) handleRename(targetItem);
          }
          onClose();
        }}
        onMouseEnter={() => setActiveSubmenu(null)}
        className={`w-full text-left px-4 py-2 flex items-center justify-between transition-colors select-none ${
          multiple
            ? 'opacity-40 cursor-default text-[#8E918F]'
            : 'cursor-pointer hover:bg-[#333538] text-slate-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <Edit2 size={18} className={multiple ? 'text-[#8E918F]' : 'text-[#C4C7C5]'} />
          <span className="font-normal text-[14px]">Rename</span>
        </div>
        <span className="text-xs text-[#8E918F]">Ctrl+Alt+E</span>
      </button>

      {/* --- FILE ONLY: Make a copy --- */}
      {!isFolder && !multiple && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (handleMakeCopy) handleMakeCopy(targetItem);
            onClose();
          }}
          onMouseEnter={() => setActiveSubmenu(null)}
          className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <Copy size={18} className="text-[#C4C7C5]" />
            <span className="font-normal text-[14px]">Make a copy</span>
          </div>
          <span className="text-xs text-[#8E918F]">Ctrl+C then Ctrl+V</span>
        </button>
      )}

      <div className="border-t border-[#444746] my-1"></div>

      {/* --- Ask Gemini --- */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (showToast) showToast(`Ask Gemini: ${name}`);
          onClose();
        }}
        onMouseEnter={() => setActiveSubmenu(null)}
        className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-[#8AB4F8]"
          >
            <path d="M12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24Z" />
          </svg>
          <span className="font-normal text-[14px]">Ask Gemini</span>
        </div>
        <span className="px-2 py-0.5 text-xs font-medium bg-[#0B57D0] text-white rounded-full">New</span>
      </button>



      <div className="border-t border-[#444746] my-1"></div>

      {/* --- Share (Submenu) --- */}
      <div
        className="relative"
        onMouseEnter={() => setActiveSubmenu('share')}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveSubmenu(prev => prev === 'share' ? null : 'share');
          }}
          className={`cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none ${
            activeSubmenu === 'share' ? 'bg-[#333538]' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <UserPlus size={18} className="text-[#C4C7C5]" />
            <span className="font-normal text-[14px]">Share</span>
          </div>
          <ChevronRight size={16} className="text-[#C4C7C5]" />
        </button>

        {activeSubmenu === 'share' && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute ${submenuPosClass} w-56 bg-[#1e1f20] border border-[#444746] rounded-xl shadow-2xl py-1.5 z-50 text-sm text-[#E8EAED]`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (handleShare) handleShare(e, targetItem, type || (isFolder ? 'folder' : 'file'));
                onClose();
              }}
              className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <UserPlus size={18} className="text-[#C4C7C5]" />
                <span className="font-normal text-[14px]">Share</span>
              </div>
              <span className="text-xs text-[#8E918F]">Ctrl+Alt+A</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (handleShare) handleShare(e, targetItem, type || (isFolder ? 'folder' : 'file'));
                onClose();
              }}
              className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center gap-3 text-slate-200 transition-colors select-none"
            >
              <Link2 size={18} className="text-[#C4C7C5]" />
              <span className="font-normal text-[14px]">Copy link</span>
            </button>
          </div>
        )}
      </div>

      {/* --- Organise (Submenu) --- */}
      <div
        className="relative"
        onMouseEnter={() => setActiveSubmenu('organise')}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveSubmenu(prev => prev === 'organise' ? null : 'organise');
          }}
          className={`cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none ${
            activeSubmenu === 'organise' ? 'bg-[#333538]' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <FolderIcon size={18} className="text-[#C4C7C5]" />
            <span className="font-normal text-[14px]">Organise</span>
          </div>
          <ChevronRight size={16} className="text-[#C4C7C5]" />
        </button>

        {activeSubmenu === 'organise' && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute ${submenuPosClass} ${isFolder ? 'w-64' : 'w-56'} bg-[#1e1f20] border border-[#444746] rounded-xl shadow-2xl py-1.5 z-50 text-sm text-[#E8EAED]`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (handleCut) handleCut([{ type: type || (isFolder ? 'folder' : 'file'), item: targetItem }]);
                onClose();
              }}
              className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <FolderInput size={18} className="text-[#C4C7C5]" />
                <span className="font-normal text-[14px]">Move</span>
              </div>
              <span className="text-xs text-[#8E918F]">Ctrl+Alt+M</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (showToast) showToast(`Added shortcut for "${name}"`);
                onClose();
              }}
              className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <CornerUpRight size={18} className="text-[#C4C7C5]" />
                <span className="font-normal text-[14px]">Add shortcut</span>
              </div>
              <span className="text-xs text-[#8E918F]">Ctrl+Alt+R</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (handleToggleStar) handleToggleStar(e, targetItem, type || (isFolder ? 'folder' : 'file'));
                onClose();
              }}
              className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <Star
                  size={18}
                  className={isStarred ? "text-yellow-400 fill-yellow-400" : "text-[#C4C7C5]"}
                />
                <span className="font-normal text-[14px]">
                  {isStarred ? 'Remove from starred' : 'Add to starred'}
                </span>
              </div>
              <span className="text-xs text-[#8E918F]">Ctrl+Alt+S</span>
            </button>

            {/* Folder colour section ONLY FOR FOLDERS */}
            {isFolder && (
              <>
                <div className="border-t border-[#444746] my-1.5"></div>
                <div className="px-4 py-1 text-xs font-normal text-[#C4C7C5]">
                  Folder colour
                </div>
                <div className="grid grid-cols-8 gap-2 px-4 py-2">
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (showToast) showToast(`Updated folder colour`);
                        onClose();
                      }}
                      style={{ backgroundColor: color }}
                      className="w-5 h-5 rounded-full hover:scale-125 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
                      title={color}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* --- Folder/File Information (Submenu) --- */}
      <div
        className="relative"
        onMouseEnter={() => !multiple && setActiveSubmenu('info')}
      >
        <button
          disabled={multiple}
          onClick={(e) => {
            if (multiple) return;
            e.stopPropagation();
            setActiveSubmenu(prev => prev === 'info' ? null : 'info');
          }}
          className={`w-full text-left px-4 py-2 flex items-center justify-between transition-colors select-none ${
            multiple
              ? 'opacity-40 cursor-default text-[#8E918F]'
              : `cursor-pointer hover:bg-[#333538] text-slate-200 ${activeSubmenu === 'info' ? 'bg-[#333538]' : ''}`
          }`}
        >
          <div className="flex items-center gap-3">
            <Info size={18} className={multiple ? 'text-[#8E918F]' : 'text-[#C4C7C5]'} />
            <span className="font-normal text-[14px]">
              {infoLabel}
            </span>
          </div>
          {!multiple && <ChevronRight size={16} className="text-[#C4C7C5]" />}
        </button>

        {!multiple && activeSubmenu === 'info' && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute ${submenuPosClass} w-48 bg-[#1e1f20] border border-[#444746] rounded-xl shadow-2xl py-1.5 z-50 text-sm text-[#E8EAED]`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                if (showToast) showToast(`${isFolder ? 'Folder' : 'File'} details: ${name}`);
              }}
              className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center gap-3 text-slate-200 transition-colors select-none"
            >
              <Info size={18} className="text-[#C4C7C5]" />
              <span className="font-normal text-[14px]">Details</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                if (showToast) showToast(`Activity for: ${name}`);
              }}
              className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center gap-3 text-slate-200 transition-colors select-none"
            >
              <Clock size={18} className="text-[#C4C7C5]" />
              <span className="font-normal text-[14px]">Activity</span>
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[#444746] my-1"></div>

      {/* --- Move to bin --- */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (multiple && handleBatchDelete) {
            handleBatchDelete();
          } else if (isFolder) {
            if (handleDeleteFolder) handleDeleteFolder(targetItem);
          } else {
            if (handleDelete) handleDelete(targetItem);
          }
          onClose();
        }}
        onMouseEnter={() => setActiveSubmenu(null)}
        className="cursor-pointer w-full text-left px-4 py-2 hover:bg-[#333538] flex items-center justify-between text-slate-200 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <Trash2 size={18} className="text-[#C4C7C5]" />
          <span className="font-normal text-[14px]">Move to bin</span>
        </div>
        <span className="text-xs text-[#8E918F]">Delete</span>
      </button>
    </div>
  );
}
