import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  HardDrive,
  Folder as FolderIcon,
  Download,
  FolderInput,
  Trash2,
  Link2,
  MoreVertical,
  X,
  UserPlus
} from 'lucide-react';
import { formatSize } from '../utils/formatters';
import ItemActionMenu from './ItemActionMenu';
import NewItemMenu from './NewItemMenu';

export default function Toolbar({
  breadcrumbs = [],
  showFolderMenu,
  setShowFolderMenu,
  folderMenuRef,
  onCreateFolder,
  fileInputRef,
  folderInputRef,
  uploading,
  viewMode,
  setViewMode,
  selectedItems = [],
  setSelectedItems,
  showToast,
  clipboard = [],
  handlePaste,
  handleNavigate,
  downloading = false,
  handleDownload,
  handleDownloadFolder,
  handleRenameFolder,
  handleDeleteFolder,
  handleCut,
  handleShare,
  handleToggleStar,
  starredItems,
  driveEnabled = false,
  handleSaveToDrive,
  onUploadFromDrive,
  onUploadFolderFromDrive,
  isDriveTransferDisabled = false
}) {
  const [showEllipsisDropdown, setShowEllipsisDropdown] = useState(false);
  const ellipsisMenuRef = useRef(null);

  useEffect(() => {
    const handleEllipsisClickOutside = (e) => {
      if (ellipsisMenuRef.current && !ellipsisMenuRef.current.contains(e.target)) {
        setShowEllipsisDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleEllipsisClickOutside);
    return () => document.removeEventListener('mousedown', handleEllipsisClickOutside);
  }, []);

  const isCollapsed = breadcrumbs.length > 3;
  const collapsedItems = isCollapsed ? breadcrumbs.slice(0, breadcrumbs.length - 2) : [];
  const visibleParents = isCollapsed
    ? [breadcrumbs[breadcrumbs.length - 2]]
    : breadcrumbs.slice(0, -1);
  const currentFolder = breadcrumbs[breadcrumbs.length - 1] || { id: null, name: 'My Clout' };
  const isRoot = currentFolder.id === null;

  return (
    <>
      {/* Header Row */}
      <div data-no-drag="true" className="flex items-center justify-between mb-4">
        {/* Breadcrumb Navigation Path */}
        <div className="flex items-center gap-1.5 select-none -ml-3 flex-wrap">
          {/* Collapsed Ellipsis Button if depth > 3 */}
          {isCollapsed && (
            <div className="relative flex items-center" ref={ellipsisMenuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEllipsisDropdown(prev => !prev);
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer select-none ${
                  showEllipsisDropdown
                    ? 'border-2 border-[#8AB4F8] bg-[#004A77]/40 text-[#8AB4F8]'
                    : 'text-[#C4C7C5] hover:bg-[#282A2C] hover:text-[#E8EAED]'
                }`}
                title="Previous folders"
              >
                <MoreHorizontal size={18} />
              </button>

              {/* Collapsed Breadcrumbs Dropdown */}
              {showEllipsisDropdown && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full left-0 mt-1.5 min-w-[200px] max-w-[280px] bg-[#1e1f20] border border-[#444746] rounded-xl shadow-2xl py-1.5 z-50 text-sm text-[#E8EAED]"
                >
                  {collapsedItems.map((item) => (
                    <button
                      key={`collapsed-${item.id ?? 'root'}`}
                      onClick={() => {
                        setShowEllipsisDropdown(false);
                        if (handleNavigate) handleNavigate(item);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-[#333538] text-[#E8EAED] transition-colors cursor-pointer select-none"
                    >
                      {item.id === null ? (
                        <HardDrive size={18} className="text-[#C4C7C5] flex-shrink-0" />
                      ) : (
                        <FolderIcon size={18} fill="#C4C7C5" className="text-[#C4C7C5] flex-shrink-0" />
                      )}
                      <span className="truncate font-normal text-[14px]">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Chevron Separator after Ellipsis */}
              <ChevronRight size={16} className="text-[#8E918F] flex-shrink-0 ml-1.5" />
            </div>
          )}

          {/* Visible Parent Folders */}
          {visibleParents.map((parent) => (
            <div key={`parent-${parent.id ?? 'root'}`} className="flex items-center gap-1.5">
              <button
                onClick={() => handleNavigate && handleNavigate(parent)}
                className="text-[24px] font-normal text-[#E3E3E3] hover:text-white px-3 py-1 rounded-full hover:bg-[#282A2C] transition-colors cursor-pointer select-none"
                title={`Go to ${parent.name}`}
              >
                <span>{parent.name}</span>
              </button>
              <ChevronRight size={16} className="text-[#8E918F] flex-shrink-0" />
            </div>
          ))}

          {/* Current Active Folder with Options Menu */}
          <div className="relative flex flex-col" ref={folderMenuRef}>
            <h1
              onClick={() => setShowFolderMenu(prev => !prev)}
              className={`text-[24px] font-normal text-[#E3E3E3] flex items-center gap-1 cursor-pointer ${
                showFolderMenu ? 'bg-[#282A2C]' : 'hover:bg-[#282A2C]'
              } w-max px-3 py-1 rounded-full transition-colors select-none`}
              title="Folder options"
            >
              <span>{currentFolder.name}</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-[#C4C7C5] flex-shrink-0"
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </h1>

            {/* FOLDER OPTIONS DROPDOWN */}
            {showFolderMenu && (
              isRoot ? (
                /* Root (My Clout) Menu - Shared NewItemMenu */
                <NewItemMenu
                  className="absolute top-full left-0 mt-1.5"
                  onCreateFolder={onCreateFolder}
                  onUploadFile={() => {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    fileInputRef.current?.click();
                  }}
                  onUploadFolder={() => {
                    if (folderInputRef.current) folderInputRef.current.value = '';
                    folderInputRef.current?.click();
                  }}
                  onUploadFromDrive={onUploadFromDrive}
                  onUploadFolderFromDrive={onUploadFolderFromDrive}
                  driveEnabled={driveEnabled}
                  uploading={uploading}
                  isDriveTransferDisabled={isDriveTransferDisabled}
                  onClose={() => setShowFolderMenu(false)}
                />
              ) : (
                /* Subfolder Options Menu - Shared ItemActionMenu */
                <ItemActionMenu
                  item={currentFolder}
                  type="folder"
                  onClose={() => setShowFolderMenu(false)}
                  align="left"
                  showNewFolder={true}
                  onCreateFolder={onCreateFolder}
                  downloading={downloading}
                  isDriveTransferDisabled={isDriveTransferDisabled}
                  handleDownload={handleDownload}
                  handleDownloadFolder={handleDownloadFolder}
                  handleRenameFolder={handleRenameFolder}
                  handleDeleteFolder={handleDeleteFolder}
                  handleCut={handleCut}
                  handleShare={handleShare}
                  handleToggleStar={handleToggleStar}
                  starredItems={starredItems}
                  showToast={showToast}
                  driveEnabled={driveEnabled}
                  handleSaveToDrive={handleSaveToDrive}
                />
              )
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* List / Grid Segmented Control */}
          <div
            className="relative inline-flex items-center border border-[#747775] rounded-full h-[32px] w-[116px] overflow-hidden select-none bg-[#131314]"
            role="radiogroup"
            aria-label="List or grid layout (Alt+V then L)"
          >
            {/* Sliding Active Pill Background */}
            <div
              className="absolute top-0 left-0 w-[58px] h-full bg-[#004A77] transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none z-0"
              style={{
                transform: viewMode === 'list' ? 'translateX(0px)' : 'translateX(58px)',
              }}
            />

            {/* Vertical Middle Divider */}
            <div className="absolute left-[58px] top-0 bottom-0 w-[1px] bg-[#747775] pointer-events-none z-10" />

            {/* Smooth Moving Tick Indicator */}
            <div
              className="absolute top-0 bottom-0 flex items-center pointer-events-none z-20 text-[#C2E7FF] transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
              style={{
                left: '12px',
                transform: viewMode === 'list' ? 'translateX(0px)' : 'translateX(58px)',
              }}
            >
              <svg
                viewBox="0 0 18 18"
                className="w-[14px] h-[14px] flex-shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px', flexShrink: 0, display: 'block' }}
              >
                <path d="M3 9.23529L6.84 13L15 5" />
              </svg>
            </div>

            {/* List Icon */}
            <div
              className="absolute top-0 bottom-0 flex items-center pointer-events-none z-20 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
              style={{
                left: viewMode === 'list' ? '32px' : '22px',
                color: viewMode === 'list' ? '#C2E7FF' : '#C4C7C5',
              }}
            >
              <svg
                width="14"
                height="12"
                viewBox="0 0 14 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-[14px] h-[12px] flex-shrink-0"
                style={{ width: '14px', height: '12px', minWidth: '14px', minHeight: '12px', flexShrink: 0, display: 'block' }}
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M1 0C0.447715 0 0 0.447715 0 1C0 1.55228 0.447715 2 1 2H13C13.5523 2 14 1.55228 14 1C14 0.447715 13.5523 0 13 0H1ZM0 6C0 5.44772 0.447715 5 1 5H13C13.5523 5 14 5.44772 14 6C14 6.55228 13.5523 7 13 7H1C0.447715 7 0 6.55228 0 6ZM1 10C0.447715 10 0 10.4477 0 11C0 11.5523 0.447715 12 1 12H13C13.5523 12 14 11.5523 14 11C14 10.4477 13.5523 10 13 10H1Z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Grid Icon */}
            <div
              className="absolute top-0 bottom-0 flex items-center pointer-events-none z-20 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
              style={{
                left: viewMode === 'grid' ? '90px' : '80px',
                color: viewMode === 'grid' ? '#C2E7FF' : '#C4C7C5',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-[14px] h-[14px] flex-shrink-0"
                style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px', flexShrink: 0, display: 'block' }}
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M0 1C0 0.447715 0.447715 0 1 0H5C5.55228 0 6 0.447715 6 1V5C6 5.55228 6 6 5 6H1C0.447715 6 0 5.55228 0 5V1ZM2 2H4V4H2V2ZM0 9C0 8.44772 0.447715 8 1 8H5C5.55228 8 6 8.44772 6 9V13C6 13.5523 5.55228 14 1 14H1C0.447715 14 0 13.5523 0 13V9ZM2 10H4V12H2V10ZM9 0C8.44772 0 8 0.447715 8 1V5C8 5.55228 8 6 9 6H13C13.5523 6 14 5.55228 14 5V1C14 0.447715 13.5523 0 13 0H9ZM12 2H10V4H12V2ZM8 9C8 8.44772 8.44772 8 9 8H13C13.5523 8 14 8.44772 14 9V13C14 13.5523 13.5523 14 13 14H9C8.44772 14 8 13.5523 8 13V9ZM10 10H12V12H10V10Z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Interactive Button: List */}
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'list'}
              data-tooltip="List layout (Alt+V then L)"
              aria-label="Lists"
              title="List layout (Alt+V then L)"
              onClick={() => setViewMode('list')}
              className="absolute left-0 top-0 w-[58px] h-full z-30 cursor-pointer rounded-l-full hover:bg-white/[0.06] transition-colors focus:outline-none"
            />

            {/* Interactive Button: Grid */}
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'grid'}
              data-tooltip="Grid layout (Alt+V then L)"
              aria-label="Grid"
              title="Grid layout (Alt+V then L)"
              onClick={() => setViewMode('grid')}
              className="absolute left-[58px] top-0 w-[58px] h-full z-30 cursor-pointer rounded-r-full hover:bg-white/[0.06] transition-colors focus:outline-none"
            />
          </div>

          {/* View Details Button */}
          <button
            type="button"
            data-tooltip="View details (Alt+V then D)"
            aria-label="View details (Alt+V then D)"
            title="View details (Alt+V then D)"
            onClick={() => {
              if (selectedItems.length === 1) {
                const item = selectedItems[0].item;
                showToast(`Details: ${item.name || item.filename} • ${selectedItems[0].type === 'folder' ? 'Folder' : formatSize(item.file_size)}`);
              } else {
                showToast(`Details: ${breadcrumbs[breadcrumbs.length - 1]?.name || 'My Clout'}`);
              }
            }}
            className="cursor-pointer w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#282A2C] text-[#C4C7C5] hover:text-[#E3E3E3] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 0h24v24H0z" fill="none" />
              <path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Action Row: Filter Pills (Normal) OR Selection Action Bar (When selected) */}
      <div data-no-drag="true" className="mb-6 min-h-[38px] flex items-center">
        {selectedItems && selectedItems.length > 0 ? (
          /* Contextual Selection Action Bar matching Google Drive */
          <div className="inline-flex items-center gap-1 sm:gap-1.5 bg-[#282a2c] border border-[#444746]/60 rounded-full px-2 py-1 text-sm text-[#E8EAED] shadow-md transition-all duration-150 select-none">
            {/* Clear Selection Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (setSelectedItems) setSelectedItems([]);
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#3C4043] text-[#C4C7C5] hover:text-[#E8EAED] transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X size={16} />
            </button>

            {/* Selected Count */}
            <span className="text-sm font-medium text-[#E8EAED] px-1 whitespace-nowrap">
              {selectedItems.length} selected
            </span>

            {/* Ask Gemini Button */}
            <button
              onClick={(e) => e.stopPropagation()}
              className="group flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#444746] hover:border-[#7b87f7]/60 hover:bg-[#282A2C] text-xs text-[#E8EAED] transition-all whitespace-nowrap cursor-pointer ml-1 mr-0.5"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-[#A8C7FA] group-hover:text-white transition-colors flex-shrink-0"
              >
                <path d="M12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24Z" />
              </svg>
              <span>Ask Gemini</span>
            </button>

            {/* Action Icons (Visual only for now, functionality to be added one by one later) */}
            <button
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3C4043] text-[#C4C7C5] hover:text-[#E8EAED] transition-colors cursor-pointer"
              title="Share"
            >
              <UserPlus size={18} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (downloading) return;
                if (selectedItems.length === 1) {
                  if (selectedItems[0].type === 'file' && handleDownload) {
                    handleDownload(selectedItems[0].item);
                  } else if (selectedItems[0].type === 'folder' && handleDownloadFolder) {
                    handleDownloadFolder(e, selectedItems[0].item);
                  }
                } else if (selectedItems.length > 1) {
                  if (showToast) showToast("Batch download is coming soon");
                }
              }}
              disabled={downloading}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                downloading
                  ? "opacity-30 cursor-not-allowed text-[#707375]"
                  : "hover:bg-[#3C4043] text-[#C4C7C5] hover:text-[#E8EAED] cursor-pointer"
              }`}
              title={downloading ? "Download in progress" : "Download"}
            >
              <Download size={18} />
            </button>

            <button
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3C4043] text-[#C4C7C5] hover:text-[#E8EAED] transition-colors cursor-pointer"
              title="Move"
            >
              <FolderInput size={18} />
            </button>

            <button
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3C4043] text-[#C4C7C5] hover:text-[#E8EAED] transition-colors cursor-pointer"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>

            <button
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3C4043] text-[#C4C7C5] hover:text-[#E8EAED] transition-colors cursor-pointer"
              title="Copy link"
            >
              <Link2 size={18} />
            </button>

            <button
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3C4043] text-[#C4C7C5] hover:text-[#E8EAED] transition-colors cursor-pointer"
              title="More actions"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        ) : (
          /* Normal Filter Pills Row */
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide select-none">
            {/* Ask Gemini Pill */}
            <button
              className="cursor-pointer group flex items-center gap-2 gemini-flow-btn text-white px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-white flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
              >
                <path d="M12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24Z" />
              </svg>
              <span>Ask Gemini</span>
            </button>

            {/* Vertical Divider */}
            <div className="h-4 w-[1px] bg-[#444746] mx-0.5" />

            {/* Type Filter */}
            <button className="cursor-pointer flex items-center gap-2 border border-[#747775] hover:bg-[#282A2C] px-3 py-1.5 rounded-lg text-sm text-[#E3E3E3] transition-colors whitespace-nowrap">
              Type <ChevronDown size={16} />
            </button>

            {/* Created Filter */}
            <button className="cursor-pointer flex items-center gap-2 border border-[#747775] hover:bg-[#282A2C] px-3 py-1.5 rounded-lg text-sm text-[#E3E3E3] transition-colors whitespace-nowrap">
              Created <ChevronDown size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
