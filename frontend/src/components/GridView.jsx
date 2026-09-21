import React from 'react';
import {
  Folder as FolderIcon,
  Download,
  Trash2,
  Edit2,
  MoreVertical,
  Scissors
} from 'lucide-react';
import FileIcon from './FileIcon';
import ItemActionMenu from './ItemActionMenu';
import { formatSize, formatDate, formatDateTime } from '../utils/formatters';

function WindowsFolderShape({ isSelected }) {
  return (
    <div className="w-[94px] h-[74px] relative flex items-center justify-center select-none transition-transform duration-200 group-hover:scale-[1.03]">
      <svg
        viewBox="0 0 100 78"
        className="w-full h-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Back Plate Gradient */}
          <linearGradient id={isSelected ? "winFolderBackSel" : "winFolderBack"} x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor={isSelected ? "#1D5BB5" : "#3C4046"} />
            <stop offset="100%" stopColor={isSelected ? "#143D7A" : "#2A2D32"} />
          </linearGradient>

          {/* Front Flap Gradient */}
          <linearGradient id={isSelected ? "winFolderFrontSel" : "winFolderFront"} x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor={isSelected ? "#2270DB" : "#4A4F57"} />
            <stop offset="100%" stopColor={isSelected ? "#1854A6" : "#363A40"} />
          </linearGradient>

          {/* Sheet Dog-Ear Gradient */}
          <linearGradient id="winDogEarGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E2E5E9" />
            <stop offset="100%" stopColor="#9AA0A6" />
          </linearGradient>
        </defs>

        {/* Back Plate with Top-Left Tab */}
        <path
          d="M 10,13 L 10,5 C 10,2.8 11.8,1 14,1 L 36,1 C 38.5,1 40.5,2.4 42,4.5 L 48,13 Z"
          fill={isSelected ? "url(#winFolderBackSel)" : "url(#winFolderBack)"}
        />
        <path
          d="M 10,10 L 10,5 C 10,2.8 11.8,1 14,1 L 36,1 C 38.5,1 40.5,2.4 42,4.5 L 48,13"
          stroke={isSelected ? "#7cacf8" : "#636872"}
          strokeWidth="0.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />

        {/* Back Main Body */}
        <rect
          x="7"
          y="12"
          width="86"
          height="62"
          rx="6"
          fill={isSelected ? "url(#winFolderBackSel)" : "url(#winFolderBack)"}
          stroke={isSelected ? "#2563EB" : "#454950"}
          strokeWidth="0.7"
        />

        {/* Inner Document Sheet (peeking out from the pocket, lifts smoothly on card hover) */}
        <g className="transition-transform duration-200 group-hover:-translate-y-1.5">
          {/* Sheet with Top-Right Dog-Ear Cutout */}
          <path
            d="M 30,13 H 58 L 68,23 V 54 H 30 Z"
            fill="#F0F2F5"
            stroke="#BDC1C6"
            strokeWidth="0.5"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
          />
          {/* Folded Dog-Ear Triangle */}
          <path
            d="M 58,13 V 23 H 68 Z"
            fill="url(#winDogEarGrad)"
            stroke="#BDC1C6"
            strokeWidth="0.5"
          />
          {/* Document lines */}
          <line x1="36" y1="28" x2="62" y2="28" stroke={isSelected ? "#2563EB" : "#9AA0A6"} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          <line x1="36" y1="35" x2="56" y2="35" stroke={isSelected ? "#60A5FA" : "#BDC1C6"} strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
          <line x1="36" y1="42" x2="60" y2="42" stroke={isSelected ? "#60A5FA" : "#BDC1C6"} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
        </g>

        {/* Front Pocket / Flap with gentle center dip */}
        <path
          d="M 7,33 C 7,31 8.5,29.5 10.5,29.5 L 34,29.5 C 40,29.5 44,32 50,32 C 56,32 60,29.5 66,29.5 L 89.5,29.5 C 91.5,29.5 93,31 93,33 L 93,68 C 93,71.5 90,74 86.5,74 L 13.5,74 C 10,74 7,71.5 7,68 Z"
          fill={isSelected ? "url(#winFolderFrontSel)" : "url(#winFolderFront)"}
          stroke={isSelected ? "#3B82F6" : "#555A63"}
          strokeWidth="0.8"
        />

        {/* Front flap top edge highlight */}
        <path
          d="M 8.5,30.5 L 34,30.5 C 40,30.5 44,33 50,33 C 56,33 60,30.5 66,30.5 L 91.5,30.5"
          stroke={isSelected ? "#93C5FD" : "#727782"}
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}

export default function GridView({
  isLoading = false,
  sortedFolders = [],
  sortedFiles = [],
  sortBy = 'name',
  setSortBy,
  sortAsc = true,
  setSortAsc,
  selectedItems = [],
  clipboard = [],
  starredItems,
  activeRowMenu,
  setActiveRowMenu,
  handleItemClick,
  handleNavigate,
  downloading = false,
  handleDownload,
  handleDownloadFolder,
  handleRename,
  handleRenameFolder,
  handleCut,
  handleShare,
  handleToggleStar,
  handleBatchDelete,
  handleDeleteFile,
  handleDeleteFolderItem,
  handleMakeCopy,
  showToast,
  setSelectedItems,
  onItemContextMenu,
  driveEnabled = false,
  handleSaveToDrive,
  isDriveTransferDisabled = false
}) {

  const handleSortToggle = () => {
    if (setSortAsc) {
      setSortAsc(!sortAsc);
    }
  };

  const hasItems = sortedFolders.length > 0 || sortedFiles.length > 0;
  const sortLabel = sortBy === 'date' ? 'Date created' : sortBy === 'size' ? 'File size' : 'Name';
  const sortDirectionText = sortBy === 'name'
    ? (sortAsc ? 'A to Z' : 'Z to A')
    : sortBy === 'date'
      ? (sortAsc ? 'Oldest first' : 'Newest first')
      : (sortAsc ? 'Smallest first' : 'Largest first');

  return (
    <div className="flex flex-col select-none">
      {/* Dynamic Sort Header matching Google Drive */}
      {hasItems && (
        <div data-no-drag="true" className="flex items-center mb-3 px-1">
          <button
            onClick={handleSortToggle}
            className="flex items-center gap-2 group cursor-pointer text-sm font-medium text-[#C4C7C5] hover:text-[#E8EAED] transition-colors select-none focus:outline-none"
            title={`Sort by ${sortLabel.toLowerCase()} (${sortDirectionText})`}
          >
            <span>{sortLabel}</span>
            <div
              className="rounded-full bg-[#004A77] flex items-center justify-center text-[#C2E7FF] flex-shrink-0 group-hover:brightness-110 transition-transform"
              style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px' }}
            >
              <svg
                style={{
                  width: '12px',
                  height: '13px',
                  transform: !sortAsc ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'block'
                }}
                viewBox="240 -760 480 520"
                fill="currentColor"
              >
                <path d="M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z" />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Folders Section - Full cards matching files with tabbed pocket structure */}
      {sortedFolders.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4 mb-4">
          {sortedFolders.map((folder, index) => {
            const isSelected = selectedItems.some(i => i.type === 'folder' && i.item.id === folder.id);
            const isCut = clipboard.some(i => i.type === 'folder' && i.item.id === folder.id);
            return (
              <div
                id={`grid-folder-item-${folder.id}`}
                key={`grid-folder-${folder.id}`}
                data-selectable="true"
                data-item-type="folder"
                data-item-id={folder.id}
                onClick={(e) => handleItemClick(e, 'folder', folder, index)}
                onDoubleClick={(e) => { e.stopPropagation(); handleNavigate(folder); }}
                onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, 'folder', folder)}
                className={`group flex flex-col rounded-[16px] border cursor-pointer transition-colors relative ${
                  activeRowMenu?.id === folder.id && activeRowMenu?.type === 'folder' ? 'z-50' : 'z-0'
                } ${
                  isSelected
                    ? 'bg-[#004A77] border-[#004A77]'
                    : 'bg-[#1E1F22] border-[#444746]/60 hover:bg-[#282A2C]'
                } ${isCut ? 'opacity-50' : ''}`}
              >
                <div className="p-3 pb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FolderIcon size={18} fill={isSelected ? "#7cacf8" : "#C4C7C5"} className={isSelected ? "text-[#7cacf8] flex-shrink-0" : "text-[#C4C7C5] flex-shrink-0"} />
                    <span className={`truncate text-sm font-medium ${isSelected ? 'text-[#C2E7FF]' : 'text-[#E3E3E3]'}`}>{folder.name}</span>
                  </div>
                  <div className="relative">
                    <button
                      data-more-actions-btn="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRowMenu(prev => (prev?.id === folder.id && prev?.type === 'folder') ? null : { id: folder.id, type: 'folder' });
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043] transition-colors cursor-pointer flex-shrink-0"
                      title="More actions (Alt + A)"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {activeRowMenu?.id === folder.id && activeRowMenu?.type === 'folder' && (
                      <ItemActionMenu
                        item={folder}
                        type="folder"
                        align="auto"
                        onClose={() => setActiveRowMenu(null)}
                        downloading={downloading}
                        handleDownload={handleDownload}
                        handleDownloadFolder={handleDownloadFolder}
                        handleRenameFolder={handleRenameFolder}
                        handleDeleteFolder={handleDeleteFolderItem}
                        handleCut={handleCut}
                        handleShare={handleShare}
                        handleToggleStar={handleToggleStar}
                        handleBatchDelete={handleBatchDelete}
                        isMultiple={false}
                        selectedItems={selectedItems}
                        starredItems={starredItems}
                        showToast={showToast}
                        isDriveTransferDisabled={isDriveTransferDisabled}
                      />
                    )}
                  </div>
                </div>

                <div className="h-[120px] bg-[#131314] mx-2 mb-2 rounded-[10px] flex items-center justify-center overflow-hidden">
                  <WindowsFolderShape isSelected={isSelected} />
                </div>

                <div className="px-3 py-2 text-xs text-[#C4C7C5] flex items-center justify-between border-t border-[#444746]/40">
                  <span title={formatDateTime(folder.created_at)}>{formatDate(folder.created_at)}</span>
                  <span>Folder</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Files Section - No "Files" text, just grid with clean spacing */}
      {sortedFiles.length > 0 && (
        <div className={`grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4 ${sortedFolders.length > 0 ? 'mt-4' : ''}`}>
          {sortedFiles.map((file, index) => {
            const isSelected = selectedItems.some(i => i.type === 'file' && i.item.id === file.id);
            const isCut = clipboard.some(i => i.type === 'file' && i.item.id === file.id);
            return (
              <div
                id={`grid-file-item-${file.id}`}
                key={`grid-file-${file.id}`}
                data-selectable="true"
                data-item-type="file"
                data-item-id={file.id}
                onClick={(e) => handleItemClick(e, 'file', file, index)}
                onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, 'file', file)}
                className={`group flex flex-col rounded-[16px] border cursor-pointer transition-colors relative ${
                  activeRowMenu?.id === file.id && activeRowMenu?.type === 'file' ? 'z-50' : 'z-0'
                } ${
                  isSelected
                    ? 'bg-[#004A77] border-[#004A77]'
                    : 'bg-[#1E1F22] border-[#444746]/60 hover:bg-[#282A2C]'
                } ${isCut ? 'opacity-50' : ''}`}
              >
                <div className="p-3 pb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileIcon filename={file.filename} size={18} />
                    <span className={`truncate text-sm font-medium ${isSelected ? 'text-[#C2E7FF]' : 'text-[#E3E3E3]'}`}>{file.filename}</span>
                  </div>
                  <div className="relative">
                    <button
                      data-more-actions-btn="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRowMenu(prev => (prev?.id === file.id && prev?.type === 'file') ? null : { id: file.id, type: 'file' });
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043] transition-colors cursor-pointer flex-shrink-0"
                      title="More actions (Alt + A)"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {activeRowMenu?.id === file.id && activeRowMenu?.type === 'file' && (
                      <ItemActionMenu
                        item={file}
                        type="file"
                        align="auto"
                        onClose={() => setActiveRowMenu(null)}
                        downloading={downloading}
                        handleDownload={handleDownload}
                        handleDownloadFolder={handleDownloadFolder}
                        handleRename={handleRename}
                        handleDelete={handleDeleteFile}
                        handleCut={handleCut}
                        handleShare={handleShare}
                        handleToggleStar={handleToggleStar}
                        handleMakeCopy={handleMakeCopy}
                        handleBatchDelete={handleBatchDelete}
                        isMultiple={false}
                        selectedItems={selectedItems}
                        starredItems={starredItems}
                        showToast={showToast}
                        driveEnabled={driveEnabled}
                        handleSaveToDrive={handleSaveToDrive}
                        isDriveTransferDisabled={isDriveTransferDisabled}
                      />

                    )}
                  </div>
                </div>

                <div className="h-[120px] bg-[#131314] mx-2 mb-2 rounded-[10px] flex items-center justify-center">
                  <FileIcon filename={file.filename} size={48} />
                </div>

                <div className="px-3 py-2 text-xs text-[#C4C7C5] flex items-center justify-between border-t border-[#444746]/40">
                  <span title={formatDateTime(file.created_at)}>{formatDate(file.created_at)}</span>
                  <span>{formatSize(file.file_size)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading or Empty State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#C4C7C5]">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#747775] border-t-[#C2E7FF] mb-4"></div>
          <p>Loading files and folders...</p>
        </div>
      ) : !hasItems ? (
        <div className="flex flex-col items-center justify-center py-20 text-center select-none">
          <div className="w-16 h-16 rounded-full bg-[#282A2C] flex items-center justify-center mb-4 text-[#8AB4F8]">
            <FolderIcon size={32} />
          </div>
          <div className="text-lg font-medium text-[#E8EAED] mb-1">A place for all of your files</div>
          <div className="text-sm text-[#9AA0A6] max-w-sm">
            Use the "New" button to upload your documents, images, and other files.
          </div>
        </div>
      ) : null}
    </div>
  );
}
