import React from 'react';
import {
  Folder as FolderIcon,
  Download,
  Trash2,
  Edit2,
  MoreVertical,
  Star,
  UserPlus,
  Scissors,
  Check
} from 'lucide-react';
import FileIcon from './FileIcon';
import ItemActionMenu from './ItemActionMenu';
import { formatSize, formatDate, formatDateTime } from '../utils/formatters';

export default function TableView({
  isLoading,
  sortedFolders,
  sortedFiles,
  sortBy,
  setSortBy,
  sortAsc,
  setSortAsc,
  showHeaderSortDropdown,
  setShowHeaderSortDropdown,
  headerSortDropdownRef,
  selectedItems,
  clipboard,
  starredItems,
  activeRowMenu,
  setActiveRowMenu,
  handleItemClick,
  handleNavigate,
  handleShare,
  downloading = false,
  handleDownload,
  handleDownloadFolder,
  handleRename,
  handleRenameFolder,
  handleToggleStar,
  handleCut,
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

  return (
    <div className="w-full">
      {/* Table Header */}
      <div data-no-drag="true" className="grid grid-cols-[minmax(200px,_1fr)_200px_195px_88px] gap-4 items-center px-4 h-[47px] border-b border-[#444746] text-sm font-medium text-[#C4C7C5] sticky top-0 bg-[#131314] z-10 select-none">
        <div
          onClick={() => {
            if (sortBy === 'name') {
              setSortAsc(!sortAsc);
            } else {
              setSortBy('name');
              setSortAsc(true);
            }
          }}
          className={`flex items-center gap-2 cursor-pointer ${sortBy === 'name' ? 'text-[#E8EAED]' : 'text-[#C4C7C5]'} hover:text-white w-full h-full select-none`}
          title={sortBy === 'name' ? `Sort by name (${sortAsc ? 'A to Z' : 'Z to A'})` : 'Sort by name'}
        >
          <span>Name</span>
          {sortBy === 'name' && (
            <div
              className="rounded-full bg-[#004A77] flex items-center justify-center text-[#C2E7FF] flex-shrink-0"
              style={{ width: '25px', height: '25px', minWidth: '25px', minHeight: '25px' }}
            >
              <svg
                style={{
                  width: '12.5px',
                  height: '13.54px',
                  transform: sortAsc ? 'none' : 'rotate(180deg)',
                  transition: 'transform 0.2s ease',
                  display: 'block'
                }}
                viewBox="240 -760 480 520"
                fill="currentColor"
              >
                <path d="M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z" />
              </svg>
            </div>
          )}
        </div>

        <div
          onClick={() => {
            if (sortBy === 'date') {
              setSortAsc(!sortAsc);
            } else {
              setSortBy('date');
              setSortAsc(false);
            }
          }}
          className={`flex items-center gap-2 cursor-pointer ${sortBy === 'date' ? 'text-[#E8EAED]' : 'text-[#C4C7C5]'} hover:text-white w-full h-full select-none`}
          title={sortBy === 'date' ? `Sort by date created (${sortAsc ? 'Oldest first' : 'Newest first'})` : 'Sort by date created'}
        >
          <span>Date created</span>
          {sortBy === 'date' && (
            <div
              className="rounded-full bg-[#004A77] flex items-center justify-center text-[#C2E7FF] flex-shrink-0"
              style={{ width: '25px', height: '25px', minWidth: '25px', minHeight: '25px' }}
            >
              <svg
                style={{
                  width: '12.5px',
                  height: '13.54px',
                  transform: sortAsc ? 'none' : 'rotate(180deg)',
                  transition: 'transform 0.2s ease',
                  display: 'block'
                }}
                viewBox="240 -760 480 520"
                fill="currentColor"
              >
                <path d="M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z" />
              </svg>
            </div>
          )}
        </div>

        <div
          onClick={() => {
            if (sortBy === 'size') {
              setSortAsc(!sortAsc);
            } else {
              setSortBy('size');
              setSortAsc(false);
            }
          }}
          className={`flex items-center gap-2 cursor-pointer ${sortBy === 'size' ? 'text-[#E8EAED]' : 'text-[#C4C7C5]'} hover:text-white w-full h-full select-none`}
          title={sortBy === 'size' ? `Sort by file size (${sortAsc ? 'Smallest first' : 'Largest first'})` : 'Sort by file size'}
        >
          <span>File size</span>
          {sortBy === 'size' && (
            <div
              className="rounded-full bg-[#004A77] flex items-center justify-center text-[#C2E7FF] flex-shrink-0"
              style={{ width: '25px', height: '25px', minWidth: '25px', minHeight: '25px' }}
            >
              <svg
                style={{
                  width: '12.5px',
                  height: '13.54px',
                  transform: sortAsc ? 'none' : 'rotate(180deg)',
                  transition: 'transform 0.2s ease',
                  display: 'block'
                }}
                viewBox="240 -760 480 520"
                fill="currentColor"
              >
                <path d="M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z" />
              </svg>
            </div>
          )}
        </div>

        <div className="relative flex items-center justify-end pr-3 w-full" ref={headerSortDropdownRef}>
          <button
            id="header-sort-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowHeaderSortDropdown(prev => !prev);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full transition-colors cursor-pointer select-none ${
              showHeaderSortDropdown
                ? 'bg-[#004A77] text-[#C2E7FF]'
                : 'text-[#C4C7C5] hover:bg-[#393c40] hover:text-[#E8EAED]'
            }`}
            title="Sort options"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="14" y2="12" />
              <line x1="4" y1="18" x2="9" y2="18" />
            </svg>
            <span className="text-sm font-medium">Sort</span>
          </button>

          {showHeaderSortDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#1e1f20] border border-[#444746] rounded-xl shadow-2xl py-1.5 z-50 text-sm text-[#E8EAED]">
              <div className="px-3.5 py-1 text-xs font-medium text-[#8E918F] uppercase tracking-wider">
                Sort by
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSortBy('name');
                  setShowHeaderSortDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-[#333538] transition-colors"
              >
                <span className={sortBy === 'name' ? 'text-[#C2E7FF] font-medium' : ''}>Name</span>
                {sortBy === 'name' && <Check size={16} className="text-[#C2E7FF]" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSortBy('date');
                  setShowHeaderSortDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-[#333538] transition-colors"
              >
                <span className={sortBy === 'date' ? 'text-[#C2E7FF] font-medium' : ''}>Date created</span>
                {sortBy === 'date' && <Check size={16} className="text-[#C2E7FF]" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSortBy('size');
                  setShowHeaderSortDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-[#333538] transition-colors"
              >
                <span className={sortBy === 'size' ? 'text-[#C2E7FF] font-medium' : ''}>File size</span>
                {sortBy === 'size' && <Check size={16} className="text-[#C2E7FF]" />}
              </button>

              <div className="my-1.5 border-t border-[#444746]"></div>

              <div className="px-3.5 py-1 text-xs font-medium text-[#8E918F] uppercase tracking-wider">
                Order
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSortAsc(true);
                  setShowHeaderSortDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-[#333538] transition-colors"
              >
                <span className={sortAsc ? 'text-[#C2E7FF] font-medium' : ''}>Ascending</span>
                {sortAsc && <Check size={16} className="text-[#C2E7FF]" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSortAsc(false);
                  setShowHeaderSortDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-[#333538] transition-colors"
              >
                <span className={!sortAsc ? 'text-[#C2E7FF] font-medium' : ''}>Descending</span>
                {!sortAsc && <Check size={16} className="text-[#C2E7FF]" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#C4C7C5]">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#747775] border-t-[#C2E7FF] mb-4"></div>
          <p>Loading...</p>
        </div>
      ) : sortedFolders.length === 0 && sortedFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#C4C7C5]">
          <p>This folder is empty.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {sortedFolders.map((folder, index) => {
            const isSelected = selectedItems.some(i => i.type === 'folder' && i.item.id === folder.id);
            const isCut = clipboard.some(i => i.type === 'folder' && i.item.id === folder.id);
            return (
              <div
                id={`folder-item-${folder.id}`}
                key={`folder-${folder.id}`}
                data-selectable="true"
                data-item-type="folder"
                data-item-id={folder.id}
                onClick={(e) => handleItemClick(e, 'folder', folder, index)}
                onDoubleClick={(e) => { e.stopPropagation(); handleNavigate(folder); }}
                onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, 'folder', folder)}
                className={`group grid grid-cols-[minmax(200px,_1fr)_200px_195px_88px] gap-4 items-center px-4 h-[47px] cursor-pointer transition-colors border-b border-[#444746] ${
                  isSelected ? 'bg-[#004A77] text-[#C2E7FF]' : 'hover:bg-[#202124]'
                } ${isCut ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3 overflow-hidden pl-3">
                  <FolderIcon size={20} fill={isSelected ? "#7cacf8" : "#C4C7C5"} className={isSelected ? "text-[#7cacf8] flex-shrink-0" : "text-[#C4C7C5] flex-shrink-0"} />
                  <span className={`truncate font-medium ${isSelected ? 'text-[#C2E7FF]' : 'text-[#E3E3E3]'}`}>{folder.name}</span>
                </div>
                <div className="text-sm text-[#C4C7C5]" title={formatDateTime(folder.created_at)}>
                  {formatDate(folder.created_at)}
                </div>
                <div className="text-sm text-[#C4C7C5]">—</div>

                <div className="relative flex items-center justify-end pr-3 w-full">
                  {/* Hover Action Buttons */}
                  <div className="flex items-center gap-0.5 absolute right-10 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto">
                    <button
                      onClick={(e) => handleShare(e, folder, 'folder')}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043] transition-colors cursor-pointer"
                      title="Share"
                    >
                      <UserPlus size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!downloading) handleDownloadFolder(e, folder);
                      }}
                      disabled={downloading}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        downloading
                          ? "opacity-30 cursor-not-allowed text-[#707375]"
                          : "text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043] cursor-pointer"
                      }`}
                      title={downloading ? "Download in progress" : "Download"}
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043] transition-colors cursor-pointer"
                      title="Rename"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => handleToggleStar(e, folder, 'folder')}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043] transition-colors cursor-pointer"
                      title={starredItems.has(`folder-${folder.id}`) ? "Starred" : "Star"}
                    >
                      <Star
                        size={16}
                        className={starredItems.has(`folder-${folder.id}`) ? "text-[#C2E7FF] fill-[#C2E7FF]" : ""}
                      />
                    </button>
                  </div>

                  {/* Three Dots Button */}
                  <div className="relative">
                    <button
                      data-more-actions-btn="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRowMenu(prev => (prev?.id === folder.id && prev?.type === 'folder') ? null : { id: folder.id, type: 'folder' });
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        activeRowMenu?.id === folder.id && activeRowMenu?.type === 'folder'
                          ? 'bg-[#3C4043] text-[#E8EAED]'
                          : 'text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043]'
                      }`}
                      title="More actions (Alt + A)"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {activeRowMenu?.id === folder.id && activeRowMenu?.type === 'folder' && (
                      <ItemActionMenu
                        item={folder}
                        type="folder"
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
              </div>
            );
          })}

          {sortedFiles.map((file, index) => {
            const isSelected = selectedItems.some(i => i.type === 'file' && i.item.id === file.id);
            const isCut = clipboard.some(i => i.type === 'file' && i.item.id === file.id);
            return (
              <div
                id={`file-item-${file.id}`}
                key={`file-${file.id}`}
                data-selectable="true"
                data-item-type="file"
                data-item-id={file.id}
                onClick={(e) => handleItemClick(e, 'file', file, index)}
                onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, 'file', file)}
                className={`group grid grid-cols-[minmax(200px,_1fr)_200px_195px_88px] gap-4 items-center px-4 h-[47px] cursor-pointer transition-colors border-b border-[#444746] ${
                  isSelected ? 'bg-[#004A77] text-[#C2E7FF]' : 'hover:bg-[#202124]'
                } ${isCut ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3 overflow-hidden pl-3">
                  <FileIcon filename={file.filename} size={20} />
                  <span className={`truncate font-medium ${isSelected ? 'text-[#C2E7FF]' : 'text-[#E3E3E3]'}`}>{file.filename}</span>
                </div>
                <div className="text-sm text-[#C4C7C5]" title={formatDateTime(file.created_at)}>
                  {formatDate(file.created_at)}
                </div>
                <div className="text-sm text-[#C4C7C5]">{formatSize(file.file_size)}</div>

                <div className="relative flex items-center justify-end pr-3 w-full">
                  {/* Hover Action Buttons */}
                  <div className="flex items-center gap-0.5 absolute right-10 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto">
                    <button
                      onClick={(e) => handleShare(e, file, 'file')}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043] transition-colors cursor-pointer"
                      title="Share"
                    >
                      <UserPlus size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!downloading) handleDownload(file);
                      }}
                      disabled={downloading}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        downloading
                          ? "opacity-30 cursor-not-allowed text-[#707375]"
                          : "text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043] cursor-pointer"
                      }`}
                      title={downloading ? "Download in progress" : "Download"}
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRename(file); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043] transition-colors cursor-pointer"
                      title="Rename"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => handleToggleStar(e, file, 'file')}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043] transition-colors cursor-pointer"
                      title={starredItems.has(`file-${file.id}`) ? "Starred" : "Star"}
                    >
                      <Star
                        size={16}
                        className={starredItems.has(`file-${file.id}`) ? "text-[#C2E7FF] fill-[#C2E7FF]" : ""}
                      />
                    </button>
                  </div>

                  {/* Three Dots Button */}
                  <div className="relative">
                    <button
                      data-more-actions-btn="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRowMenu(prev => (prev?.id === file.id && prev?.type === 'file') ? null : { id: file.id, type: 'file' });
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        activeRowMenu?.id === file.id && activeRowMenu?.type === 'file'
                          ? 'bg-[#3C4043] text-[#E8EAED]'
                          : 'text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043]'
                      }`}
                      title="More actions (Alt + A)"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {activeRowMenu?.id === file.id && activeRowMenu?.type === 'file' && (
                      <ItemActionMenu
                        item={file}
                        type="file"
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
