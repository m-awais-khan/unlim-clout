import React from 'react';
import { Plus, Star, Trash, Cloud } from 'lucide-react';
import { formatSize } from '../utils/formatters';
import NewItemMenu from './NewItemMenu';

export default function Sidebar({
  showNewDropdown,
  setShowNewDropdown,
  dropdownRef,
  onCreateFolder,
  fileInputRef,
  folderInputRef,
  uploading,
  onNavigateRoot,
  totalStorageUsed,
  onShowStorageToast,
  driveEnabled = false,
  onUploadFromDrive,
  onUploadFolderFromDrive,
  isDriveTransferDisabled = false
}) {
  return (
    <aside
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="w-[256px] bg-[#1B1B1B] flex flex-col px-4 pb-4 pt-2 flex-shrink-0 select-none"
    >
      {/* New Button */}
      <div className="relative mb-[20px] w-max self-start" style={{ marginBottom: '20px' }} ref={dropdownRef}>
        <button
          onClick={() => setShowNewDropdown(!showNewDropdown)}
          className="cursor-pointer flex items-center justify-center gap-3 bg-[#37393b] text-white hover:bg-[#494d53] hover:shadow-md transition-all rounded-[16px] font-medium select-none"
          style={{ width: '101px', height: '56px', minWidth: '101px', minHeight: '56px' }}
        >
          <Plus size={24} />
          <span className="text-[14px]">New</span>
        </button>

        {showNewDropdown && (
          <NewItemMenu
            className="absolute top-0 left-0"
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
            onClose={() => setShowNewDropdown(false)}
          />
        )}
      </div>


      {/* Navigation Links */}
      <nav className="flex flex-col gap-1 w-full text-[14px]">
        <button
          onClick={onNavigateRoot}
          className="cursor-pointer flex items-center justify-between px-3 py-2 bg-[#004A77] text-[#C2E7FF] rounded-full w-full"
        >
          <div className="flex items-center gap-4">
            <svg
              viewBox="0 0 507.908 507.908"
              style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', display: 'block' }}
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M505.4,297.954c-0.1-0.2-82.4-217.9-82.7-218.4c-7.3-14-21.7-22.7-37.5-22.7H122.8c-15.8,0-30.2,8.7-37.5,22.7 c-0.3,0.5-82.7,218.2-82.7,218.4c-1.6,4.5-2.6,9.4-2.6,14.4v96.4c0,23.3,19,42.3,42.3,42.3h423.3c23.3,0,42.3-19,42.3-42.3v-96.4 C508,307.254,507.1,302.454,505.4,297.954z M68.8,202.454h40.9c7.8,0,14.1-6.3,14.1-14.1c0-7.8-6.3-14.1-14.1-14.1H79.5l10.7-28.3 h61.9c7.8,0,14.1-6.3,14.1-14.1c0-7.8-6.3-14.1-14.1-14.1h-51.2l9.7-25.8c2.5-4.3,7.1-6.9,12.2-6.9h262.5c5,0,9.6,2.6,12.2,7 l67.3,178H43.3L68.8,202.454z M465.7,422.854H42.3c-7.8,0-14.1-6.3-14.1-14.1v-96.4c0-7.8,6.3-14.1,14.1-14.1h423.3 c7.8,0,14.1,6.3,14.1,14.1v96.4h0.1C479.8,416.554,473.5,422.854,465.7,422.854z" />
              <path d="M277,346.454H67.3c-7.8,0-14.1,6.3-14.1,14.1s6.3,14.1,14.1,14.1H277c7.8,0,14.1-6.3,14.1-14.1 C291.1,352.754,284.8,346.454,277,346.454z" />
              <path d="M440.7,346.454h-21.6c-7.8,0-14.1,6.3-14.1,14.1s6.3,14.1,14.1,14.1h21.6c7.8,0,14.1-6.3,14.1-14.1 C454.8,352.754,448.5,346.454,440.7,346.454z" />
              <path d="M356,346.454h-21.6c-7.8,0-14.1,6.3-14.1,14.1s6.3,14.1,14.1,14.1H356c7.8,0,14.1-6.3,14.1-14.1 C370.1,352.754,363.8,346.454,356,346.454z" />
            </svg>
            <span>My Clout</span>
          </div>
        </button>
        <button className="cursor-pointer flex items-center justify-between px-3 py-2 text-slate-200 hover:bg-[#28292C] rounded-full w-full">
          <div className="flex items-center gap-4">
            <Star size={18} />
            <span>Starred</span>
          </div>
        </button>
        <button className="cursor-pointer flex items-center justify-between px-3 py-2 text-slate-200 hover:bg-[#28292C] rounded-full w-full">
          <div className="flex items-center gap-4">
            <Trash size={18} />
            <span>Bin</span>
          </div>
        </button>

        {/* Storage */}
        <button
          onClick={onShowStorageToast}
          className="cursor-pointer flex items-center justify-between px-3 py-2 text-slate-200 hover:bg-[#28292C] rounded-full w-full transition-colors"
        >
          <div className="flex items-center gap-4">
            <Cloud size={18} />
            <span>Storage</span>
          </div>
        </button>

        {/* Storage Info */}
        <div className="px-3 py-1 select-none">
          <span className="text-[13px] text-[#C4C7C5]">
            {formatSize(totalStorageUsed)} total used
          </span>
        </div>
      </nav>
    </aside>
  );
}
