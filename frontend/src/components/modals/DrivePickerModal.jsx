import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../../constants';
import { formatSize } from '../../utils/formatters';
import { X, Folder, File, ChevronRight, HardDrive, RefreshCw, AlertCircle } from 'lucide-react';

export default function DrivePickerModal({
  show,
  onClose,
  mode = 'import', // 'import' (pick file) | 'export' (pick folder)
  onSelectFile,    // (fileObj) => void
  onSelectFolder,  // (folderPath) => void
  onOpenSettings,
  onMountDrive,
  onDriveUnmounted,
  showToast
}) {

  const [currentPath, setCurrentPath] = useState('');
  const [pathStack, setPathStack] = useState([{ name: 'My Drive', path: '' }]);
  const [contents, setContents] = useState({ folders: [], files: [], exists: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null); // folder or file object

  const fetchDriveContents = async (subpath) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/drive/browse`, {
        params: { subpath }
      });
      setContents(res.data);
      if (res.data && res.data.exists === false && res.data.reason === 'not_mounted') {
        if (onDriveUnmounted) onDriveUnmounted();
      }
      setCurrentPath(subpath || '');
      setSelectedItem(null);
    } catch (err) {
      console.error("Error fetching drive contents:", err);
      setError(err.response?.data?.detail || "Could not fetch Drive contents. Ensure worker is running and Drive is mounted.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      setCurrentPath('');
      setPathStack([{ name: 'My Drive', path: '' }]);
      fetchDriveContents('');
    }
  }, [show]);

  const handleOpenFolder = (folder) => {
    const newPath = folder.path;
    setPathStack(prev => [...prev, { name: folder.name, path: newPath }]);
    fetchDriveContents(newPath);
  };

  const handleBreadcrumbClick = (index) => {
    const target = pathStack[index];
    const newStack = pathStack.slice(0, index + 1);
    setPathStack(newStack);
    fetchDriveContents(target.path);
  };

  const handleConfirm = () => {
    if (mode === 'import') {
      if (!selectedItem || selectedItem.type !== 'file') {
        if (showToast) showToast("Please select a file to import");
        return;
      }
      onSelectFile(selectedItem);
      onClose();
    } else if (mode === 'import_folder') {
      const folderToImport = selectedItem?.type === 'folder'
        ? selectedItem
        : (pathStack.length > 1 ? pathStack[pathStack.length - 1] : null);
      if (!folderToImport || (!folderToImport.path && !folderToImport.name)) {
        if (showToast) showToast("Please select a specific folder inside My Drive to upload");
        return;
      }
      onSelectFolder(folderToImport);
      onClose();
    } else if (mode === 'export') {
      const folderPath = selectedItem?.type === 'folder' ? selectedItem.path : currentPath;
      onSelectFolder(folderPath);
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1f20] border border-[#444746] rounded-[24px] p-6 w-[680px] max-w-[94vw] shadow-2xl relative text-[#E8EAED] select-none flex flex-col h-[580px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#333538]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#004A77] text-[#C2E7FF]">
              <HardDrive size={20} />
            </div>
            <div>
              <h2 className="text-[18px] font-medium text-[#E3E3E3]">
                {mode === 'import' ? 'Import from Google Drive' : mode === 'import_folder' ? 'Upload Folder from Google Drive' : 'Save to Google Drive'}
              </h2>
              <p className="text-[12px] text-[#A8C7FA]">
                {mode === 'import' ? 'Select a file to transfer to Clout' : mode === 'import_folder' ? 'Select a folder to recursively transfer to Clout' : 'Choose a destination Drive folder'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#333538] text-[#C4C7C5] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 py-3 px-1 text-[13px] text-[#C4C7C5] overflow-x-auto select-none border-b border-[#282a2c] custom-scrollbar">
          {pathStack.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight size={14} className="text-[#686b6d] flex-shrink-0" />}
              <button
                onClick={() => handleBreadcrumbClick(idx)}
                className={`px-2 py-0.5 rounded-md hover:bg-[#333538] transition-colors whitespace-nowrap cursor-pointer ${
                  idx === pathStack.length - 1 ? 'font-medium text-[#A8C7FA]' : 'text-[#C4C7C5]'
                }`}
              >
                {item.name}
              </button>
            </React.Fragment>
          ))}
          <button
            onClick={() => fetchDriveContents(currentPath)}
            className="ml-auto p-1 text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#333538] rounded-full transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* File and Folder List */}
        <div className="flex-1 overflow-y-auto py-2 pr-1 custom-scrollbar">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
              <AlertCircle size={36} className="text-amber-400" />
              <div className="text-[14px] text-[#E3E3E3]">{error}</div>
              <span className="text-[12px] text-[#9AA0A6]">
                Make sure Docker worker is running (`docker compose -f docker-compose.worker.yml up -d`) and Drive is mounted.
              </span>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-[#9AA0A6] text-[14px]">
              Loading Drive contents...
            </div>
          ) : contents.exists === false ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
              <AlertCircle size={36} className="text-amber-400" />
              <div className="text-[14px] text-[#E3E3E3]">
                {contents.message || "Google Drive is not mounted yet."}
              </div>
              <span className="text-[12px] text-[#9AA0A6] max-w-[400px]">
                Sign in to your Google account and mount Drive in Settings.
              </span>
              {onMountDrive ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onMountDrive();
                  }}
                  className="mt-2 flex items-center gap-2 px-5 py-2 bg-[#004A77] hover:bg-[#005c94] text-[#C2E7FF] rounded-full text-[13px] font-medium transition-colors cursor-pointer"
                >
                  <HardDrive size={15} />
                  Mount Google Drive
                </button>
              ) : onOpenSettings ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="mt-2 px-4 py-2 bg-[#004A77] hover:bg-[#005c94] text-[#C2E7FF] rounded-full text-[13px] font-medium transition-colors cursor-pointer"
                >
                  Open Settings
                </button>
              ) : null}
            </div>
          ) : contents.folders.length === 0 && contents.files.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#9AA0A6] text-[14px]">
              This Google Drive folder is empty.
            </div>

          ) : (
            <div className="flex flex-col gap-1">
              {/* Folders */}
              {contents.folders.map((folder, idx) => {
                const isSelected = selectedItem?.type === 'folder' && selectedItem?.path === folder.path;
                return (
                  <div
                    key={`folder-${idx}`}
                    onClick={() => setSelectedItem({ type: 'folder', ...folder })}
                    onDoubleClick={() => handleOpenFolder(folder)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#004A77] text-[#C2E7FF]' : 'hover:bg-[#282a2c] text-[#E3E3E3]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Folder size={18} className={isSelected ? "text-[#C2E7FF]" : "text-[#A8C7FA]"} />
                      <span className="text-[14px] font-medium">{folder.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {mode === 'import_folder' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFolder(folder);
                            onClose();
                          }}
                          className="text-[12px] bg-[#004A77] hover:bg-[#005c94] text-[#C2E7FF] px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                        >
                          Upload this
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFolder(folder);
                        }}
                        className="text-[12px] text-[#A8C7FA] hover:underline px-2 py-1 rounded cursor-pointer"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Files (shown if mode is import or browse) */}
              {contents.files.map((file, idx) => {
                const isSelected = selectedItem?.type === 'file' && selectedItem?.full_path === file.full_path;
                return (
                  <div
                    key={`file-${idx}`}
                    onClick={() => mode === 'import' && setSelectedItem({ type: 'file', ...file })}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                      mode === 'import' ? 'cursor-pointer' : 'opacity-60 cursor-default'
                    } ${
                      isSelected ? 'bg-[#004A77] text-[#C2E7FF]' : 'hover:bg-[#282a2c] text-[#E3E3E3]'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <File size={18} className={isSelected ? "text-[#C2E7FF]" : "text-[#C4C7C5]"} />
                      <span className="text-[14px] truncate">{file.name}</span>
                    </div>
                    <span className="text-[12px] text-[#9AA0A6] flex-shrink-0 ml-4">
                      {formatSize(file.size)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Selection Info & Actions */}
        <div className="pt-3 border-t border-[#333538] flex items-center justify-between mt-auto">
          <div className="text-[13px] text-[#C4C7C5] truncate max-w-[340px]">
            {selectedItem ? (
              <span>Selected: <strong className="text-[#E3E3E3]">{selectedItem.name}</strong></span>
            ) : mode === 'import_folder' ? (
              <span>Current Folder: <strong className="text-[#E3E3E3]">{pathStack[pathStack.length - 1].name}</strong></span>
            ) : mode === 'export' ? (
              <span>Destination: <strong className="text-[#E3E3E3]">{pathStack[pathStack.length - 1].name}</strong></span>
            ) : (
              <span className="text-[#9AA0A6]">Select a file from list above</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="cursor-pointer px-4 py-2 hover:bg-[#333538] text-[#C4C7C5] rounded-full text-[14px] font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={
                mode === 'import'
                  ? (!selectedItem || selectedItem.type !== 'file')
                  : mode === 'import_folder'
                    ? (!selectedItem && pathStack.length <= 1)
                    : false
              }
              className="cursor-pointer px-5 py-2 bg-[#A8C7FA] hover:bg-[#8AB4F8] disabled:opacity-40 disabled:hover:bg-[#A8C7FA] text-[#003354] rounded-full text-[14px] font-medium transition-colors"
            >
              {mode === 'import' ? 'Import to Clout' : mode === 'import_folder' ? 'Upload Folder to Clout' : 'Export Here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
