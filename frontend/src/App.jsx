import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from './constants';
import { formatSize, formatDate } from './utils/formatters';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import TableView from './components/TableView';
import GridView from './components/GridView';
import UploadWidget from './components/UploadWidget';
import DownloadWidget from './components/DownloadWidget';
import NewItemMenu from './components/NewItemMenu';
import ItemActionMenu from './components/ItemActionMenu';
import NewFolderModal from './components/modals/NewFolderModal';
import ReplaceModal from './components/modals/ReplaceModal';
import DeleteModal from './components/modals/DeleteModal';
import RenameModal from './components/modals/RenameModal';
import CancelUploadModal from './components/modals/CancelUploadModal';
import CancelDownloadModal from './components/modals/CancelDownloadModal';
import CancelDriveTransferModal from './components/modals/CancelDriveTransferModal';
import DriveConnectionModal from './components/modals/DriveConnectionModal';
import SettingsModal from './components/modals/SettingsModal';
import DrivePickerModal from './components/modals/DrivePickerModal';
import DriveTransferWidget from './components/DriveTransferWidget';
import useMarqueeSelection from './hooks/useMarqueeSelection';



function App() {
  const [connectionStatus, setConnectionStatus] = useState('uninitialized');
  const [connectionError, setConnectionError] = useState(null);
  const [telegramConfigured, setTelegramConfigured] = useState(false);

  const [currentFolderId, setCurrentFolderId] = useState(null);
  const currentFolderIdRef = useRef(null);
  const [contents, setContents] = useState({ folders: [], files: [] });
  const [totalStorageUsed, setTotalStorageUsed] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Clout' }]);
  const [viewMode, setViewMode] = useState('list');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [sortBy, setSortBy] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [showHeaderSortDropdown, setShowHeaderSortDropdown] = useState(false);
  const headerSortDropdownRef = useRef(null);
  const [selectedItems, setSelectedItems] = useState([]); // Array of { type, item }
  const [starredItems, setStarredItems] = useState(() => new Set());
  const [activeRowMenu, setActiveRowMenu] = useState(null);
  const [mainContextMenu, setMainContextMenu] = useState(null); // { x: number, y: number } | null
  const [itemContextMenu, setItemContextMenu] = useState(null); // { x: number, y: number, type: 'folder' | 'file', item: object } | null
  const [clipboard, setClipboard] = useState([]); // Array of { type, item }
  const [toastMessage, setToastMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const folderMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [uploadStats, setUploadStats] = useState({ current: 0, total: 0 });
  const [uploadWidgetOpen, setUploadWidgetOpen] = useState(false);
  const [uploadMinimized, setUploadMinimized] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadCancelled, setUploadCancelled] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [uploadItemName, setUploadItemName] = useState('');
  const [timeLeftText, setTimeLeftText] = useState('');
  const [isFolderUploadState, setIsFolderUploadState] = useState(false);
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState(null);
  const [uploadTargetBreadcrumbs, setUploadTargetBreadcrumbs] = useState([{ id: null, name: 'My Clout' }]);
  const [uploadedFolderId, setUploadedFolderId] = useState(null);
  const [uploadedFolder, setUploadedFolder] = useState(null);

  // Custom Delete & Rename Modal states
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    itemName: '',
    itemCount: 0,
    onConfirm: () => {}
  });

  const [renameModal, setRenameModal] = useState({
    isOpen: false,
    initialName: '',
    itemType: 'file',
    onConfirm: () => {}
  });

  // Download state
  const [downloadWidgetOpen, setDownloadWidgetOpen] = useState(false);
  const [downloadMinimized, setDownloadMinimized] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [downloadCancelled, setDownloadCancelled] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('downloading'); // 'downloading' | 'merging' | 'ready' | 'cancelled' | 'failed'
  const [downloadStats, setDownloadStats] = useState({ currentBytes: 0, totalBytes: 0 });
  const [downloadItemName, setDownloadItemName] = useState('');
  const [downloadTimeLeftText, setDownloadTimeLeftText] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const activeDownloadIdRef = useRef(null);
  const downloadIntervalRef = useRef(null);
  const downloadStartTimeRef = useRef(0);
  const [showCancelDownloadModal, setShowCancelDownloadModal] = useState(false);

  // Drive & Colab state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDriveConnectionModal, setShowDriveConnectionModal] = useState(false);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveEnabled, setDriveEnabled] = useState(false);
  const [driveMounted, setDriveMounted] = useState(false);
  const isDriveActive = Boolean(driveEnabled && driveMounted);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [drivePickerMode, setDrivePickerMode] = useState('import');
  const [activeDriveJob, setActiveDriveJob] = useState(null);
  const [driveWidgetOpen, setDriveWidgetOpen] = useState(false);
  const [driveWidgetMinimized, setDriveWidgetMinimized] = useState(false);
  const [showCancelDriveModal, setShowCancelDriveModal] = useState(false);
  const [exportTargetFile, setExportTargetFile] = useState(null);
  const drivePollIntervalRef = useRef(null);

  const isDriveTransferActive = Boolean(
    activeDriveJob &&
    ['pending', 'started', 'connecting', 'transferring', 'merging'].includes(activeDriveJob.status)
  );
  const isDriveTransferDisabled = Boolean(downloading || uploading || isDriveTransferActive);


  // If upload completes while cancel confirmation modal is open, close modal immediately
  useEffect(() => {
    if (uploadComplete) {
      setShowCancelModal(false);
    }
  }, [uploadComplete]);

  // If download completes while cancel confirmation modal is open, close modal immediately
  useEffect(() => {
    if (downloadComplete) {
      setShowCancelDownloadModal(false);
    }
  }, [downloadComplete]);

  // If drive transfer completes while cancel confirmation modal is open, close modal immediately
  useEffect(() => {
    if (activeDriveJob?.status === 'completed' || activeDriveJob?.status === 'failed' || activeDriveJob?.status === 'cancelled') {
      setShowCancelDriveModal(false);
    }
  }, [activeDriveJob?.status]);
  const [replaceModal, setReplaceModal] = useState({
    open: false,
    type: 'folder',
    name: '',
    existingItems: [],
    filesToUpload: null
  });
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('Untitled folder');
  const newFolderInputRef = useRef(null);

  useEffect(() => {
    if (showNewFolderModal) {
      setNewFolderName('Untitled folder');
      setTimeout(() => {
        if (newFolderInputRef.current) {
          newFolderInputRef.current.focus();
          newFolderInputRef.current.select();
        }
      }, 50);
    }
  }, [showNewFolderModal]);

  const cancelUploadRef = useRef(false);
  const activeUploadIdRef = useRef(null);
  const abortControllerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNewDropdown(false);
      }
      if (folderMenuRef.current && !folderMenuRef.current.contains(event.target)) {
        setShowFolderMenu(false);
      }
      if (headerSortDropdownRef.current && !headerSortDropdownRef.current.contains(event.target)) {
        setShowHeaderSortDropdown(false);
      }
      // Do not close context menu or active row menu if clicking inside an item action menu or more-actions button
      if (event.target.closest('[data-item-action-menu="true"]') || event.target.closest('[data-more-actions-btn="true"]')) {
        return;
      }
      setActiveRowMenu(null);
      setItemContextMenu(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchStorage = async () => {
    try {
      const res = await axios.get(`${API_BASE}/storage`);
      if (res.data && typeof res.data.used_bytes === 'number') {
        setTotalStorageUsed(res.data.used_bytes);
      }
    } catch (err) {
      console.error("Error fetching storage:", err);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedInitialContentsRef = useRef(false);

  const fetchContents = async (folderId, isManualRefresh = false) => {
    const targetId = folderId !== undefined ? folderId : currentFolderIdRef.current;
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const url = targetId ? `${API_BASE}/folders/${targetId}` : `${API_BASE}/folders`;
      const response = await axios.get(url);
      setContents(response.data);
      hasLoadedInitialContentsRef.current = true;
      fetchStorage();
      return true;
    } catch (error) {
      console.error("Error fetching contents:", error);
      return false;
    } finally {
      // If we haven't loaded initial contents yet and this was a background failure, keep loading true for retry
      if (hasLoadedInitialContentsRef.current || isManualRefresh) {
        setIsLoading(false);
      }
      if (isManualRefresh) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const success = await fetchContents(currentFolderIdRef.current, true);
    setIsLoading(false);
    if (success) {
      showToast("Files and folders refreshed");
    } else {
      showToast("Could not reach backend. Retrying...");
    }
  };

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId;
    fetchContents(currentFolderId);
    fetchStorage();
    setSelectedItems([]);
  }, [currentFolderId]);

  // Startup resilience: auto-retry loading contents if backend sidecar is still booting
  useEffect(() => {
    let active = true;
    let attempts = 0;
    const maxAttempts = 15;

    const autoRetryStartupLoad = async () => {
      if (!active || hasLoadedInitialContentsRef.current) {
        if (active) setIsLoading(false);
        return;
      }
      const ok = await fetchContents(currentFolderIdRef.current);
      if (ok) {
        hasLoadedInitialContentsRef.current = true;
        if (active) setIsLoading(false);
        return;
      }
      attempts++;
      if (attempts < maxAttempts && active && !hasLoadedInitialContentsRef.current) {
        const delay = Math.min(500 + attempts * 250, 2000);
        setTimeout(autoRetryStartupLoad, delay);
      } else if (active) {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(autoRetryStartupLoad, 600);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  // Keyboard shortcut: F5 or Ctrl+R to refresh
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault();
        handleManualRefresh();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Google Drive defaults to OFF on initial launch to preserve resources
  useEffect(() => {
    setDriveEnabled(false);
  }, []);

  // Gracefully notify backend to terminate when window closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`${API_BASE}/system/shutdown`);
        }
      } catch (_) {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleUploadFromDrive = () => {
    if (isDriveTransferDisabled) {
      showToast("A transfer is already in progress. Concurrent transfers are coming soon!");
      return;
    }
    if (!isDriveActive) {
      showToast("Please connect Google Drive first to upload files from Drive.");
      setShowDriveConnectionModal(true);
      return;
    }
    setDrivePickerMode('import');
    setShowDrivePicker(true);
  };

  const handleUploadFolderFromDrive = () => {
    if (isDriveTransferDisabled) {
      showToast("A transfer is already in progress. Concurrent transfers are coming soon!");
      return;
    }
    if (!isDriveActive) {
      showToast("Please connect Google Drive first to upload folders from Drive.");
      setShowDriveConnectionModal(true);
      return;
    }
    setDrivePickerMode('import_folder');
    setShowDrivePicker(true);
  };

  const handleSaveToDrive = (fileItem) => {
    if (isDriveTransferDisabled) {
      showToast("A transfer is already in progress. Concurrent transfers are coming soon!");
      return;
    }
    if (!isDriveActive) {
      showToast("Please connect Google Drive first to save files to Drive.");
      setShowDriveConnectionModal(true);
      return;
    }
    setExportTargetFile(fileItem);
    setDrivePickerMode('export');
    setShowDrivePicker(true);
  };

  const pollDriveJob = (jobId) => {
    if (drivePollIntervalRef.current) clearInterval(drivePollIntervalRef.current);
    drivePollIntervalRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/drive/jobs/${jobId}`);
        if (res.data) {
          setActiveDriveJob(res.data);
          if (res.data.status === 'completed') {
            clearInterval(drivePollIntervalRef.current);
            fetchContents(currentFolderIdRef.current);
            fetchStorage();
            showToast("Drive transfer completed successfully!");
          } else if (res.data.status === 'failed' || res.data.status === 'cancelled') {
            clearInterval(drivePollIntervalRef.current);
            if (res.data.status === 'failed') {
              const errorMsg = res.data.error_message || 'Unknown error';
              showToast(`Drive transfer failed: ${errorMsg}`);
              const errLower = errorMsg.toLowerCase();
              if (errLower.includes('not mounted') || errLower.includes('unmounted') || errLower.includes('please mount') || errLower.includes('filenotfounderror')) {
                setDriveMounted(false);
                setDriveEnabled(false);
                prevDriveMountedRef.current = false;
                consecutiveDriveFailuresRef.current = 3;
              }
            }
          }
        }
      } catch (err) {
        console.error("Error polling drive job:", err);
      }
    }, 1200);
  };

  const executeDriveImport = async (fileObj) => {
    if (isDriveTransferDisabled) {
      showToast("A transfer is already in progress. Concurrent transfers are coming soon!");
      return;
    }
    try {
      showToast(`Initiating Colab transfer for ${fileObj.name}...`);
      const targetPath = fileObj.full_path || (fileObj.path ? `/content/drive/MyDrive/${fileObj.path.replace(/^\//, '')}` : fileObj.name);
      const res = await axios.post(`${API_BASE}/drive/upload`, {
        drive_file_path: targetPath,
        destination_folder_id: currentFolderIdRef.current,
        custom_filename: fileObj.name
      });
      if (res.data && res.data.job_id) {
        setActiveDriveJob({
          id: res.data.job_id,
          source_name: fileObj.name,
          status: 'pending',
          transferred_bytes: 0,
          total_bytes: fileObj.size || 0,
          percent: 0,
          job_type: 'drive_to_telegram'
        });
        setDriveWidgetOpen(true);
        setDriveWidgetMinimized(false);
        pollDriveJob(res.data.job_id);
      }
    } catch (err) {
      console.error("Drive upload failed:", err);
      const detail = err.response?.data?.detail;
      const msg = (detail && detail !== "Not Found") ? detail : "Failed to start Drive upload. Please ensure Google Drive is connected.";
      showToast(msg);
    }
  };

  const executeDriveFolderImport = async (folderObj) => {
    if (isDriveTransferDisabled) {
      showToast("A transfer is already in progress. Concurrent transfers are coming soon!");
      return;
    }
    try {
      const folderName = (typeof folderObj === 'object' ? folderObj.name : folderObj) || 'Imported Folder';
      const rawPath = typeof folderObj === 'object' ? (folderObj.path || folderObj.name) : folderObj;
      const cleanRel = (rawPath || '').replace(/^(\/content\/drive\/MyDrive\/|\/content\/drive\/|MyDrive\/|\/)/g, '');
      const targetPath = `/content/drive/MyDrive/${cleanRel}`;

      showToast(`Initiating Drive folder transfer for "${folderName}"...`);
      const res = await axios.post(`${API_BASE}/drive/import-folder`, {
        drive_folder_path: targetPath,
        destination_folder_id: currentFolderIdRef.current,
        custom_folder_name: folderName
      });
      if (res.data && res.data.job_id) {
        setActiveDriveJob({
          id: res.data.job_id,
          source_name: folderName,
          status: 'pending',
          transferred_bytes: 0,
          total_bytes: 0,
          percent: 0,
          job_type: 'drive_folder_to_telegram',
          total_files: 0,
          completed_files: 0,
          current_file: ''
        });
        setDriveWidgetOpen(true);
        setDriveWidgetMinimized(false);
        pollDriveJob(res.data.job_id);
      }
    } catch (err) {
      console.error("Drive folder upload failed:", err);
      const detail = err.response?.data?.detail;
      const msg = (detail && detail !== "Not Found") ? detail : "Failed to start Drive folder upload. Please ensure Google Drive is connected.";
      showToast(msg);
    }
  };

  const handleConfirmDriveImport = async (fileObj) => {
    if (!fileObj || !fileObj.name) return;

    // Check for collision with existing items in the destination folder
    try {
      const url = currentFolderIdRef.current ? `${API_BASE}/folders/${currentFolderIdRef.current}` : `${API_BASE}/folders`;
      const freshRes = await axios.get(url);
      const currentFiles = freshRes.data.files || [];

      const match = currentFiles.find(cf => cf.filename.toLowerCase() === fileObj.name.toLowerCase());
      if (match) {
        setReplaceModal({
          open: true,
          type: 'file',
          name: match.filename,
          existingItems: [match],
          filesToUpload: null,
          uploadSource: 'drive',
          driveFileToImport: fileObj
        });
        return;
      }
    } catch (err) {
      console.error("Error checking Drive file collisions:", err);
    }

    executeDriveImport(fileObj);
  };

  const handleConfirmDriveExport = async (folderPath) => {
    if (!exportTargetFile) return;
    if (isDriveTransferDisabled) {
      showToast("A transfer is already in progress. Concurrent transfers are coming soon!");
      return;
    }
    try {
      showToast(`Initiating Colab download for ${exportTargetFile.filename}...`);
      const res = await axios.post(`${API_BASE}/drive/export/${exportTargetFile.id}`, {
        destination_drive_dir: folderPath
      });
      if (res.data && res.data.job_id) {
        setActiveDriveJob({
          id: res.data.job_id,
          source_name: exportTargetFile.filename,
          status: 'pending',
          transferred_bytes: 0,
          total_bytes: exportTargetFile.file_size || 0,
          percent: 0,
          job_type: 'telegram_to_drive'
        });
        setDriveWidgetOpen(true);
        setDriveWidgetMinimized(false);
        pollDriveJob(res.data.job_id);
      }
    } catch (err) {
      console.error("Drive export failed:", err);
      showToast(err.response?.data?.detail || "Failed to start Drive export");
    } finally {
      setExportTargetFile(null);
    }
  };

  const handleCancelDriveJob = async () => {
    setShowCancelDriveModal(false);
    if (activeDriveJob?.id) {
      try {
        await axios.post(`${API_BASE}/drive/jobs/${activeDriveJob.id}/cancel`);
        setActiveDriveJob(prev => prev ? { ...prev, status: 'cancelled' } : null);
        showToast("Drive transfer cancelled");
      } catch (err) {
        console.error("Error cancelling drive job:", err);
      }
    }
  };

  const isConnectingRef = useRef(false);
  const prevConnectionStatusRef = useRef(connectionStatus);
  const prevDriveMountedRef = useRef(driveMounted);
  const consecutiveDriveFailuresRef = useRef(0);
  const activeDriveJobRef = useRef(activeDriveJob);
  activeDriveJobRef.current = activeDriveJob;

  const startConnection = async (retryCount = 0) => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    setConnectionStatus('connecting');
    setConnectionError(null);
    try {
      const res = await axios.post(`${API_BASE}/connection/start`);
      if (res.data?.configured !== undefined) {
        setTelegramConfigured(Boolean(res.data.configured));
      }
      if (res.data?.status) {
        setConnectionStatus(res.data.status);
      }
      if (res.data?.error) {
        setConnectionError(res.data.error);
      }
    } catch (err) {
      if (err.message === 'Network Error' && retryCount < 2) {
        isConnectingRef.current = false;
        setTimeout(() => startConnection(retryCount + 1), 1500);
        return;
      }
      setConnectionStatus('failed');
      const msg = err.message === 'Network Error'
        ? 'Local backend server is unreachable. Please restart the application.'
        : (err.response?.data?.detail || err.message);
      setConnectionError(msg);
    } finally {
      isConnectingRef.current = false;
    }
  };

  const handleRetryTelegram = async () => {
    if (!telegramConfigured) {
      setShowSettingsModal(true);
      return;
    }
    if (connectionStatus === 'connected') {
      showToast("Telegram storage is connected and active.");
    } else {
      startConnection();
      showToast("Connecting to Telegram...");
    }
  };

  const handleToggleDrive = async (enable) => {
    if (enable) {
      if (!telegramConfigured) {
        showToast("Please configure Telegram in Settings first before connecting Google Drive.");
        setShowSettingsModal(true);
        return;
      }
      setShowDriveConnectionModal(true);
    } else {
      setDriveConnecting(true);
      try {
        showToast("Disconnecting Google Drive & stopping Docker container...");
        await axios.post(`${API_BASE}/drive/lifecycle/stop`);
        setDriveEnabled(false);
        setDriveMounted(false);
        showToast("Google Drive disconnected. Docker container and Colab notebook stopped to save resources.");
      } catch (err) {
        console.error("Error stopping drive lifecycle:", err);
        setDriveEnabled(false);
        setDriveMounted(false);
      } finally {
        setDriveConnecting(false);
      }
    }
  };

  const handleDriveConnectionComplete = () => {
    setDriveEnabled(true);
    setDriveMounted(true);
    if (connectionStatus === 'connected') {
      axios.post(`${API_BASE}/drive/telegram/warmup`).catch(() => {});
    }
  };

  useEffect(() => {
    let connectionInterval = null;
    let driveInterval = null;

    const pollConnection = async () => {
      try {
        const res = await axios.get(`${API_BASE}/connection/status`);
        // If initial load hasn't succeeded yet, backend is now online so load immediately
        if (!hasLoadedInitialContentsRef.current) {
          fetchContents(currentFolderIdRef.current);
        }
        const status = res.data?.status;
        if (res.data?.configured !== undefined) {
          setTelegramConfigured(Boolean(res.data.configured));
        }
        if (status) {
          if (prevConnectionStatusRef.current === 'connected' && status === 'failed') {
            const errDetail = res.data?.error || "Telegram connection lost. Please check your network or VPN.";
            showToast(errDetail);
          }
          prevConnectionStatusRef.current = status;
          setConnectionStatus(status);
        }
        if (res.data?.error) {
          setConnectionError(res.data.error);
        }
      } catch (err) {
        if (prevConnectionStatusRef.current === 'connected') {
          setConnectionStatus('failed');
          prevConnectionStatusRef.current = 'failed';
          showToast("Network connection lost. Please check your internet or VPN.");
        }
      }
    };

    const pollDriveStatus = async () => {
      if (!driveEnabled) {
        setDriveMounted(false);
        prevDriveMountedRef.current = false;
        consecutiveDriveFailuresRef.current = 0;
        return;
      }

      // If a Drive transfer job is actively executing, Colab and Drive are guaranteed working
      const currentJob = activeDriveJobRef.current;
      const isJobActive = currentJob && ['running', 'uploading', 'downloading', 'in_progress'].includes(currentJob.status);
      if (isJobActive) {
        setDriveMounted(true);
        prevDriveMountedRef.current = true;
        consecutiveDriveFailuresRef.current = 0;
        return;
      }

      try {
        const res = await axios.get(`${API_BASE}/drive/status`);
        const isMounted = Boolean(res.data?.drive_mounted);
        if (isMounted) {
          consecutiveDriveFailuresRef.current = 0;
          setDriveMounted(true);
          prevDriveMountedRef.current = true;
        } else {
          consecutiveDriveFailuresRef.current += 1;
          // Require 4 consecutive unmounted responses (~20s) before confirming disconnected
          if (consecutiveDriveFailuresRef.current >= 4) {
            if (prevDriveMountedRef.current) {
              showToast("Google Drive disconnected or unmounted in Colab.");
            }
            prevDriveMountedRef.current = false;
            setDriveMounted(false);
            setDriveEnabled(false);
          }
        }
      } catch (err) {
        consecutiveDriveFailuresRef.current += 1;
        // Require 4 consecutive network failures (~20s) before dropping status
        if (consecutiveDriveFailuresRef.current >= 4) {
          if (prevDriveMountedRef.current) {
            setDriveMounted(false);
            setDriveEnabled(false);
            prevDriveMountedRef.current = false;
            showToast("Colab connection dropped. Google Drive is disconnected.");
          }
        }
      }
    };

    pollConnection();
    connectionInterval = setInterval(pollConnection, 3500);

    pollDriveStatus();
    driveInterval = setInterval(pollDriveStatus, 5000);

    return () => {
      if (connectionInterval) clearInterval(connectionInterval);
      if (driveInterval) clearInterval(driveInterval);
    };
  }, [driveEnabled]);

  const parseDate = (d) => {
    if (!d) return 0;
    if (typeof d === 'string') {
      const s = d.includes(' ') && !d.includes('T') ? d.replace(' ', 'T') : d;
      const t = new Date(s).getTime();
      return isNaN(t) ? 0 : t;
    }
    const t = new Date(d).getTime();
    return isNaN(t) ? 0 : t;
  };

  const sortedFolders = [...contents.folders].sort((a, b) => {
    if (sortBy === 'size') {
      // Folders have no file size, keep alphabetical
      return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
    }
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortBy === 'date') {
      const timeA = parseDate(a.created_at);
      const timeB = parseDate(b.created_at);
      cmp = timeA - timeB;
      if (cmp === 0) {
        cmp = (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
      }
    }
    return sortAsc ? cmp : -cmp;
  });

  const sortedFiles = [...contents.files].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = (a.filename || '').localeCompare(b.filename || '', undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortBy === 'date') {
      const timeA = parseDate(a.created_at);
      const timeB = parseDate(b.created_at);
      cmp = timeA - timeB;
      if (cmp === 0) {
        cmp = (a.filename || '').localeCompare(b.filename || '', undefined, { numeric: true, sensitivity: 'base' });
      }
    } else if (sortBy === 'size') {
      const sizeA = a.file_size || 0;
      const sizeB = b.file_size || 0;
      cmp = sizeA - sizeB;
      if (cmp === 0) {
        cmp = (a.filename || '').localeCompare(b.filename || '', undefined, { numeric: true, sensitivity: 'base' });
      }
    }
    return sortAsc ? cmp : -cmp;
  });

  const allItems = [
    ...sortedFolders.map(f => ({ type: 'folder', item: f })),
    ...sortedFiles.map(f => ({ type: 'file', item: f }))
  ];

  const contentAreaRef = useRef(null);
  const { dragBox, handleMouseDown: handleMarqueeMouseDown } = useMarqueeSelection({
    containerRef: contentAreaRef,
    allItems,
    selectedItems,
    setSelectedItems
  });

  const handleItemClick = (e, type, item, index) => {
    e.stopPropagation();
    const clickedObj = { type, item };

    if (e.shiftKey && selectedItems.length > 0) {
      // Find last selected item index
      const lastSelected = selectedItems[selectedItems.length - 1];
      const lastIdx = allItems.findIndex(i => i.type === lastSelected.type && i.item.id === lastSelected.item.id);
      if (lastIdx !== -1) {
        const start = Math.min(lastIdx, index);
        const end = Math.max(lastIdx, index);
        const newSelection = allItems.slice(start, end + 1);
        setSelectedItems(newSelection);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      const isSelected = selectedItems.find(i => i.type === type && i.item.id === item.id);
      if (isSelected) {
        setSelectedItems(selectedItems.filter(i => !(i.type === type && i.item.id === item.id)));
      } else {
        setSelectedItems([...selectedItems, clickedObj]);
      }
    } else {
      setSelectedItems([clickedObj]);
    }
  };

  const handleNavigate = (folder) => {
    setCurrentFolderId(folder.id);
    currentFolderIdRef.current = folder.id;
    if (folder.id === null) {
      setBreadcrumbs([{ id: null, name: 'My Clout' }]);
    } else {
      const idx = breadcrumbs.findIndex(b => b.id === folder.id);
      if (idx >= 0) {
        setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
      } else {
        setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
      }
    }
  };

  const createFolder = () => {
    setShowNewFolderModal(true);
  };

  const handleCreateFolderSubmit = async (e) => {
    if (e) e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await axios.post(`${API_BASE}/folders`, {
        name,
        parent_id: currentFolderId
      });
      setShowNewFolderModal(false);
      fetchContents(currentFolderId);
    } catch (error) {
      console.error("Error creating folder:", error);
      showToast(error.response?.data?.detail || "Failed to create folder");
    }
  };

  const handleCancelReplaceModal = () => {
    setReplaceModal({
      open: false,
      type: 'folder',
      name: '',
      existingItems: [],
      filesToUpload: null,
      uploadSource: 'local',
      driveFileToImport: null
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleConfirmReplace = async () => {
    const { existingItems, filesToUpload, type, uploadSource, driveFileToImport } = replaceModal;
    setReplaceModal({
      open: false,
      type: 'folder',
      name: '',
      existingItems: [],
      filesToUpload: null,
      uploadSource: 'local',
      driveFileToImport: null
    });

    // Delete existing items before proceeding with upload
    try {
      if (existingItems && existingItems.length > 0) {
        for (const item of existingItems) {
          if (type === 'folder') {
            await axios.delete(`${API_BASE}/folders/${item.id}`);
          } else {
            await axios.delete(`${API_BASE}/files/${item.id}`);
          }
        }
        await fetchContents(currentFolderIdRef.current);
        await fetchStorage();
      }
    } catch (err) {
      console.error("Error deleting existing item for replacement:", err);
    }

    if (uploadSource === 'drive' && driveFileToImport) {
      executeDriveImport(driveFileToImport);
    } else if (filesToUpload && filesToUpload.length > 0) {
      executeUpload(filesToUpload);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target?.files || []);
    if (event.target) {
      event.target.value = '';
    }
    if (files.length === 0) return;

    if (!telegramConfigured) {
      showToast("Please configure Telegram in Settings before uploading files.");
      setShowSettingsModal(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
      return;
    }

    if (connectionStatus !== 'connected') {
      showToast(connectionStatus === 'connecting'
        ? "Connecting to Telegram... please wait a moment."
        : "Telegram is not connected. Please check connection.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
      return;
    }

    const hasRelativePath = files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));

    // Check for collision with existing items in the current folder
    try {
      const url = currentFolderIdRef.current ? `${API_BASE}/folders/${currentFolderIdRef.current}` : `${API_BASE}/folders`;
      const freshRes = await axios.get(url);
      const currentFolders = freshRes.data.folders || [];
      const currentFiles = freshRes.data.files || [];

      if (hasRelativePath) {
        const rootFolderName = files[0].webkitRelativePath.split('/')[0];
        const existingFolder = currentFolders.find(f => f.name.toLowerCase() === rootFolderName.toLowerCase());
        if (existingFolder) {
          setReplaceModal({
            open: true,
            type: 'folder',
            name: rootFolderName,
            existingItems: [existingFolder],
            filesToUpload: files
          });
          return;
        }
      } else {
        const duplicateFiles = [];
        for (const f of files) {
          const match = currentFiles.find(cf => cf.filename.toLowerCase() === f.name.toLowerCase());
          if (match && !duplicateFiles.some(d => d.id === match.id)) {
            duplicateFiles.push(match);
          }
        }
        if (duplicateFiles.length > 0) {
          setReplaceModal({
            open: true,
            type: 'file',
            name: duplicateFiles[0].filename + (duplicateFiles.length > 1 ? ` and ${duplicateFiles.length - 1} other file(s)` : ''),
            existingItems: duplicateFiles,
            filesToUpload: files
          });
          return;
        }
      }
    } catch (err) {
      console.error("Error checking folder/file collisions:", err);
    }

    executeUpload(files);
  };

  const executeUpload = async (files) => {
    cancelUploadRef.current = false;
    setUploading(true);
    setUploadComplete(false);
    setUploadCancelled(false);
    setUploadWidgetOpen(true);
    setUploadMinimized(false);
    setUploadTargetFolderId(currentFolderIdRef.current);
    setUploadTargetBreadcrumbs([...breadcrumbs]);
    setUploadedFolderId(null);
    setUploadedFolder(null);

    const hasRelativePath = files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    setIsFolderUploadState(hasRelativePath);

    let displayName = files[0].name;
    if (hasRelativePath) {
      displayName = files[0].webkitRelativePath.split('/')[0] || files[0].name;
    }
    setUploadItemName(displayName);
    setUploadStats({ current: 0, total: files.length });
    setTimeLeftText('Starting upload...');
    setOverallProgress(3);

    // If uploading a folder, instantly show it in the UI and create it on the backend immediately!
    if (hasRelativePath) {
      const rootFolderName = files[0].webkitRelativePath.split('/')[0];
      if (rootFolderName) {
        // Instantly display the folder in UI with zero delay (optimistic update)
        setContents(prev => {
          if (prev.folders.some(f => f.name === rootFolderName)) return prev;
          return {
            ...prev,
            folders: [
              ...prev.folders,
              {
                id: 'temp-' + Date.now(),
                name: rootFolderName,
                parent_id: currentFolderIdRef.current,
                created_at: new Date().toISOString()
              }
            ]
          };
        });

        // Persist the root folder to backend immediately so it exists in DB
        try {
          const res = await axios.post(`${API_BASE}/folders`, {
            name: rootFolderName,
            parent_id: currentFolderIdRef.current
          });
          if (res.data && res.data.id) {
            setUploadedFolderId(res.data.id);
            setUploadedFolder(res.data);
          }
          fetchContents(currentFolderIdRef.current);
        } catch (err) {
          fetchContents(currentFolderIdRef.current);
        }
      }
    }

    const totalBatchBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    const batchStartTime = Date.now();
    let completedBatchBytes = 0;
    let successfulUploads = 0;
    let failedUploads = 0;

    for (let i = 0; i < files.length; i++) {
      if (cancelUploadRef.current) break;

      const file = files[i];
      const uploadId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      activeUploadIdRef.current = uploadId;
      const relativePath = file.webkitRelativePath || "";

      setUploadStats(prev => ({ ...prev, current: i + 1 }));
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file, file.name);
      if (currentFolderIdRef.current) {
        formData.append('folder_id', currentFolderIdRef.current);
      }
      formData.append('upload_id', uploadId);
      if (relativePath) {
        formData.append('relative_path', relativePath);
      }

      const progressInterval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/progress/${uploadId}`);
          if (res.data && typeof res.data.percent === 'number') {
            const pct = Math.round(res.data.percent);
            setUploadProgress(pct);

            const activeCurrentBytes = res.data.current || Math.round((file.size * pct) / 100);
            const totalUploadedBytes = completedBatchBytes + activeCurrentBytes;
            const elapsedSec = (Date.now() - batchStartTime) / 1000;

            // Calculate overall progress percentage for the entire folder
            if (totalBatchBytes > 0) {
              const currentOverall = Math.min(99, Math.round((totalUploadedBytes / totalBatchBytes) * 100));
              setOverallProgress(Math.max(3, currentOverall));
            } else {
              const currentOverall = Math.min(99, Math.round(((i + (pct / 100)) / files.length) * 100));
              setOverallProgress(Math.max(3, currentOverall));
            }

            if (elapsedSec > 1.5 && totalUploadedBytes > 0) {
              const speed = totalUploadedBytes / elapsedSec; // bytes per second
              const remainingBytes = Math.max(0, totalBatchBytes - totalUploadedBytes);
              const secLeft = remainingBytes / speed;

              if (secLeft < 45) {
                setTimeLeftText('Less than a minute left...');
              } else if (secLeft < 3600) {
                const mins = Math.ceil(secLeft / 60);
                setTimeLeftText(`${mins} min left...`);
              } else {
                const hrs = Math.floor(secLeft / 3600);
                const mins = Math.ceil((secLeft % 3600) / 60);
                setTimeLeftText(`${hrs} hr ${mins} min left...`);
              }
            } else {
              setTimeLeftText('Estimating time left...');
            }
          }
        } catch (err) { }
      }, 500);

      abortControllerRef.current = new AbortController();
      try {
        await axios.post(`${API_BASE}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: abortControllerRef.current.signal
        });
        if (cancelUploadRef.current) {
          break;
        }
        successfulUploads++;
        completedBatchBytes += file.size || 0;
        const finishedOverall = Math.min(99, Math.round(((i + 1) / files.length) * 100));
        setOverallProgress(Math.max(3, finishedOverall));
        fetchContents(currentFolderIdRef.current);
      } catch (error) {
        if (!axios.isCancel(error) && error.name !== 'CanceledError' && error.response?.status !== 499) {
          console.error(`Error uploading file ${file.name}:`, error);
          failedUploads++;
        }
      } finally {
        clearInterval(progressInterval);
      }
    }

    setUploading(false);
    activeUploadIdRef.current = null;
    if (cancelUploadRef.current) {
      setUploadCancelled(true);
      setTimeLeftText('Upload cancelled');
    } else if (successfulUploads > 0) {
      setOverallProgress(100);
      setUploadComplete(true);
      setShowCancelModal(false);
      if (hasRelativePath) {
        const rootFolderName = files[0].webkitRelativePath.split('/')[0];
        try {
          const allRes = await axios.get(`${API_BASE}/all-folders`);
          const match = allRes.data.find(f => f.name === rootFolderName && f.parent_id === currentFolderIdRef.current)
            || allRes.data.find(f => f.name === rootFolderName);
          if (match) {
            setUploadedFolderId(match.id);
            setUploadedFolder(match);
          }
        } catch (e) { }
      }
    } else {
      // If 0 files succeeded, do NOT mark complete!
      setUploadCancelled(true);
      setTimeLeftText('Upload failed');
    }
    fetchContents(currentFolderIdRef.current);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleCancelUpload = () => {
    setShowCancelModal(false);
    if (uploadComplete) return;
    cancelUploadRef.current = true;
    const activeUploadId = activeUploadIdRef.current;
    if (activeUploadId) {
      axios.post(`${API_BASE}/upload/cancel/${activeUploadId}`).catch(() => {});
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    setUploadCancelled(true);
    setTimeLeftText('Upload cancelled');
    setTimeout(() => {
      fetchContents(currentFolderIdRef.current);
      fetchStorage();
    }, 400);
  };

  const handleDirectCancelItem = () => {
    cancelUploadRef.current = true;
    const activeUploadId = activeUploadIdRef.current;
    if (activeUploadId) {
      axios.post(`${API_BASE}/upload/cancel/${activeUploadId}`).catch(() => {});
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    setUploadCancelled(true);
    setTimeLeftText('Upload cancelled');
    setTimeout(() => {
      fetchContents(currentFolderIdRef.current);
      fetchStorage();
    }, 400);
  };

  const handleLocateUploadedItem = async () => {
    try {
      const targetFolderId = uploadTargetFolderId;
      if (currentFolderIdRef.current !== targetFolderId) {
        setCurrentFolderId(targetFolderId);
        currentFolderIdRef.current = targetFolderId;
        setBreadcrumbs(uploadTargetBreadcrumbs);
      }

      const url = targetFolderId ? `${API_BASE}/folders/${targetFolderId}` : `${API_BASE}/folders`;
      const res = await axios.get(url);
      setContents(res.data);

      const items = isFolderUploadState ? res.data.folders : res.data.files;
      const target = items.find(i => {
        const itemName = isFolderUploadState ? i.name : i.filename;
        return itemName === uploadItemName || itemName.toLowerCase() === uploadItemName.toLowerCase();
      });

      if (target) {
        setSelectedItems([{ type: isFolderUploadState ? 'folder' : 'file', item: target }]);
        setTimeout(() => {
          const el = document.getElementById(`${isFolderUploadState ? 'folder' : 'file'}-item-${target.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    } catch (err) {
      console.error("Error locating uploaded item:", err);
    }
  };

  const handleOpenUploadedFolder = async () => {
    if (!isFolderUploadState) return;

    try {
      let folderToOpen = uploadedFolder;

      if (!folderToOpen || !folderToOpen.id) {
        folderToOpen = contents.folders.find(f => f.name === uploadItemName || f.id === uploadedFolderId);
      }

      if (!folderToOpen || !folderToOpen.id) {
        const allRes = await axios.get(`${API_BASE}/all-folders`);
        folderToOpen = allRes.data.find(f => f.name === uploadItemName && f.parent_id === uploadTargetFolderId)
          || allRes.data.find(f => f.name === uploadItemName);
      }

      if (folderToOpen && folderToOpen.id) {
        setUploadedFolderId(folderToOpen.id);
        setUploadedFolder(folderToOpen);

        const parentCrumbs = uploadTargetBreadcrumbs && uploadTargetBreadcrumbs.length > 0
          ? uploadTargetBreadcrumbs
          : [{ id: null, name: 'My Clout' }];

        const newBreadcrumbs = [
          ...parentCrumbs.filter(b => b.id !== folderToOpen.id),
          { id: folderToOpen.id, name: folderToOpen.name }
        ];

        setCurrentFolderId(folderToOpen.id);
        currentFolderIdRef.current = folderToOpen.id;
        setBreadcrumbs(newBreadcrumbs);
        fetchContents(folderToOpen.id);
      }
    } catch (err) {
      console.error("Error opening uploaded folder:", err);
    }
  };

  const handleCancelDownload = async () => {
    setShowCancelDownloadModal(false);
    if (downloadComplete) return;
    if (activeDownloadIdRef.current) {
      try {
        await axios.post(`${API_BASE}/download/cancel/${activeDownloadIdRef.current}`);
      } catch (e) {
        console.error("Error cancelling download:", e);
      }
    }
    if (downloadIntervalRef.current) {
      clearInterval(downloadIntervalRef.current);
    }
    setDownloading(false);
    setDownloadCancelled(true);
    setDownloadTimeLeftText('Download cancelled');
  };

  const handleDirectCancelDownload = async () => {
    setShowCancelDownloadModal(false);
    if (downloadComplete) return;
    if (activeDownloadIdRef.current) {
      try {
        await axios.post(`${API_BASE}/download/cancel/${activeDownloadIdRef.current}`);
      } catch (e) {
        console.error("Error cancelling download:", e);
      }
    }
    if (downloadIntervalRef.current) {
      clearInterval(downloadIntervalRef.current);
    }
    setDownloading(false);
    setDownloadCancelled(true);
    setDownloadTimeLeftText('Download cancelled');
  };

  const handleDownload = async (rawFile) => {
    if (downloading) {
      showToast("A download is already in progress.");
      return;
    }

    const file = rawFile?.item || rawFile;
    if (!file || !file.id) {
      console.error("Invalid file passed to handleDownload:", rawFile);
      showToast("Cannot download: file not found.");
      return;
    }

    // Verify Telegram connection: if local state is not connected, check backend status directly
    let currentStatus = connectionStatus;
    if (currentStatus !== 'connected') {
      try {
        const checkRes = await axios.get(`${API_BASE}/connection/status`);
        if (checkRes.data?.status === 'connected') {
          currentStatus = 'connected';
          setConnectionStatus('connected');
        } else {
          startConnection();
          showToast(checkRes.data?.status === 'connecting'
            ? "Connecting to Telegram... please wait a moment."
            : "Telegram is connecting, please try again in a few moments.");
          return;
        }
      } catch (err) {
        console.warn("Connection verification failed:", err);
      }
    }

    if (downloadIntervalRef.current) {
      clearInterval(downloadIntervalRef.current);
    }

    const downloadId = 'dl_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    activeDownloadIdRef.current = downloadId;

    setShowCancelDownloadModal(false);
    setDownloadWidgetOpen(true);
    setDownloadMinimized(false);
    setDownloadCancelled(false);
    setDownloadComplete(false);
    setDownloading(true);
    setDownloadStatus('downloading');
    setDownloadItemName(file.filename || 'File');
    setDownloadStats({ currentBytes: 0, totalBytes: file.file_size || 0 });
    setDownloadTimeLeftText('Starting download...');
    setDownloadProgress(3);
    downloadStartTimeRef.current = Date.now();

    try {
      const startRes = await axios.post(`${API_BASE}/download/start/${file.id}?download_id=${downloadId}`);
      if (!startRes.data || !startRes.data.download_id) {
        throw new Error("Failed to start download");
      }

      const totalBytes = startRes.data.file_size || file.file_size || 0;
      setDownloadStats({ currentBytes: 0, totalBytes });

      downloadIntervalRef.current = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/download/progress/${downloadId}`);
          const data = res.data;
          if (!data) return;

          if (data.status === 'cancelled') {
            clearInterval(downloadIntervalRef.current);
            setShowCancelDownloadModal(false);
            setDownloading(false);
            setDownloadCancelled(true);
            setDownloadTimeLeftText('Download cancelled');
            return;
          }

          if (data.status === 'failed') {
            clearInterval(downloadIntervalRef.current);
            setShowCancelDownloadModal(false);
            setDownloading(false);
            setDownloadCancelled(true);
            const failMsg = typeof data.error === 'string' ? data.error : 'Download failed';
            setDownloadTimeLeftText(failMsg);
            showToast(failMsg);
            return;
          }

          if (data.status === 'merging') {
            setDownloadStatus('merging');
            setDownloadProgress(100);
            setDownloadTimeLeftText('Doing final steps...');
            return;
          }

          if (data.status === 'ready') {
            clearInterval(downloadIntervalRef.current);
            setDownloadStatus('ready');
            setDownloadProgress(100);
            setDownloading(false);
            setDownloadComplete(true);
            setShowCancelDownloadModal(false);
            setDownloadTimeLeftText('');

            // Automatically trigger the native browser download without opening any blank tabs!
            const downloadUrl = `${API_BASE}/download/file/${downloadId}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', file.filename || 'download');
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
          }

          // status === 'downloading'
          setDownloadStatus('downloading');
          const currentBytes = data.current || 0;
          const pct = Math.max(3, Math.min(99, Math.round(data.percent || 0)));
          setDownloadProgress(pct);
          setDownloadStats({ currentBytes, totalBytes });

          const elapsedSec = (Date.now() - downloadStartTimeRef.current) / 1000;
          if (elapsedSec > 1.5 && currentBytes > 0) {
            const speed = currentBytes / elapsedSec;
            const remainingBytes = Math.max(0, totalBytes - currentBytes);
            const secLeft = remainingBytes / speed;

            if (secLeft < 45) {
              setDownloadTimeLeftText('Less than a minute left...');
            } else if (secLeft < 3600) {
              const mins = Math.ceil(secLeft / 60);
              setDownloadTimeLeftText(`${mins} min left...`);
            } else {
              const hrs = Math.floor(secLeft / 3600);
              const mins = Math.ceil((secLeft % 3600) / 60);
              setDownloadTimeLeftText(`${hrs} hr ${mins} min left...`);
            }
          } else {
            setDownloadTimeLeftText('Estimating time left...');
          }
        } catch (pollErr) {
          console.error("Error polling download progress:", pollErr);
        }
      }, 500);

    } catch (err) {
      console.error("Error initiating download:", err);
      if (downloadIntervalRef.current) {
        clearInterval(downloadIntervalRef.current);
      }
      setDownloading(false);
      setDownloadCancelled(true);
      const detail = err.response?.data?.detail;
      const errorMsg = typeof detail === 'string'
        ? detail
        : (Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : 'Failed to start download');
      setDownloadTimeLeftText(errorMsg);
      showToast(errorMsg);
    }
  };

  const handleDelete = async (file) => {
    try {
      await axios.delete(`${API_BASE}/files/${file.id}`);
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleDeleteFile = (file) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete file?',
      itemName: file.filename,
      itemCount: 1,
      message: '',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_BASE}/files/${file.id}`);
          fetchContents(currentFolderIdRef.current);
          fetchStorage();
          showToast(`Moved "${file.filename}" to bin`);
        } catch (error) {
          console.error("Error deleting file:", error);
          showToast(error.response?.data?.detail || "Failed to delete file");
        }
      }
    });
  };

  const handleDeleteFolder = async (folder) => {
    try {
      await axios.delete(`${API_BASE}/folders/${folder.id}`);
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
  };

  const handleDeleteFolderItem = (folder) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete folder?',
      itemName: folder.name,
      itemCount: 1,
      message: '',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_BASE}/folders/${folder.id}`);
          fetchContents(currentFolderIdRef.current);
          fetchStorage();
          showToast(`Moved "${folder.name}" to bin`);
        } catch (error) {
          console.error("Error deleting folder:", error);
          showToast(error.response?.data?.detail || "Failed to delete folder");
        }
      }
    });
  };

  const handleMakeCopy = async (file) => {
    try {
      const res = await axios.post(`${API_BASE}/files/${file.id}/copy`);
      fetchContents(currentFolderIdRef.current);
      fetchStorage();
      showToast(`Created "${res.data.filename}"`);
    } catch (error) {
      console.error("Error copying file:", error);
      showToast(error.response?.data?.detail || "Failed to make a copy");
    }
  };

  const handleBatchDelete = () => {
    if (selectedItems.length === 0) return;
    if (connectionStatus !== 'connected') {
      showToast(connectionStatus === 'connecting'
        ? "Connecting to Telegram... please wait a moment."
        : "Telegram is not connected.");
      return;
    }
    const count = selectedItems.length;
    setDeleteModal({
      isOpen: true,
      title: `Delete ${count} items?`,
      itemCount: count,
      message: `Are you sure you want to delete ${count} items? This cannot be undone.`,
      onConfirm: async () => {
        for (const sel of selectedItems) {
          if (sel.type === 'file') await handleDelete(sel.item);
          else await handleDeleteFolder(sel.item);
        }
        setSelectedItems([]);
        fetchContents(currentFolderIdRef.current);
        fetchStorage();
        showToast(`Deleted ${count} items`);
      }
    });
  };

  const handleRenameFolder = (folder) => {
    setRenameModal({
      isOpen: true,
      initialName: folder.name,
      itemType: 'folder',
      onConfirm: async (newName) => {
        try {
          await axios.put(`${API_BASE}/folders/${folder.id}/rename`, { new_name: newName });
          fetchContents(currentFolderIdRef.current);
          setBreadcrumbs(prev => prev.map(b => b.id === folder.id ? { ...b, name: newName } : b));
          showToast(`Renamed to "${newName}"`);
        } catch (error) {
          console.error("Error renaming folder:", error);
          showToast(error.response?.data?.detail || "Failed to rename folder");
        }
      }
    });
  };

  const handleDeleteCurrentFolder = (folder) => {
    if (!folder || folder.id === null) return;
    setDeleteModal({
      isOpen: true,
      title: 'Delete folder?',
      itemName: folder.name,
      itemCount: 1,
      message: '',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_BASE}/folders/${folder.id}`);
          showToast(`Moved "${folder.name}" to bin`);
          const idx = breadcrumbs.findIndex(b => b.id === folder.id);
          const parentCrumb = idx > 0 ? breadcrumbs[idx - 1] : { id: null, name: 'My Clout' };
          handleNavigate(parentCrumb);
        } catch (error) {
          console.error("Error deleting folder:", error);
          showToast(error.response?.data?.detail || "Failed to delete folder");
        }
      }
    });
  };

  const handleRename = (file) => {
    setRenameModal({
      isOpen: true,
      initialName: file.filename,
      itemType: 'file',
      onConfirm: async (newName) => {
        try {
          await axios.put(`${API_BASE}/files/${file.id}/rename`, { new_name: newName });
          fetchContents(currentFolderIdRef.current);
          showToast(`Renamed to "${newName}"`);
        } catch (error) {
          console.error("Error renaming file:", error);
          showToast(error.response?.data?.detail || "Failed to rename file");
        }
      }
    });
  };

  const handleCut = (itemsToCut) => {
    setClipboard(itemsToCut);
    showToast(`Cut ${itemsToCut.length} items`);
  };

  const handlePaste = async () => {
    if (clipboard.length === 0) return;

    const targetFolderId = currentFolderIdRef.current;

    // Check if any item is being pasted into the same location or already exists here
    const alreadyExists = clipboard.some(c => {
      if (c.type === 'file') {
        const currentLoc = c.item.folder_id ?? null;
        const targetLoc = targetFolderId ?? null;
        const isSameLocation = currentLoc === targetLoc;
        const nameConflict = contents.files.some(f => f.filename === c.item.filename);
        return isSameLocation || nameConflict;
      } else {
        const currentLoc = c.item.parent_id ?? null;
        const targetLoc = targetFolderId ?? null;
        const isSameLocation = currentLoc === targetLoc;
        const nameConflict = contents.folders.some(f => f.name === c.item.name);
        return isSameLocation || nameConflict;
      }
    });

    if (alreadyExists) {
      showToast("The file or folder already exists in this location.");
      setClipboard([]);
      return;
    }

    let successCount = 0;
    try {
      await Promise.all(clipboard.map(async (c) => {
        const endpoint = c.type === 'file' ? `/files/${c.item.id}/move` : `/folders/${c.item.id}/move`;
        await axios.put(`${API_BASE}${endpoint}`, { new_folder_id: targetFolderId });
        successCount++;
      }));
      showToast(`Moved ${successCount} items`);
    } catch (error) {
      console.error("Error moving item:", error);
      const msg = error.response?.data?.detail || "The file or folder already exists in this location.";
      showToast(msg);
    } finally {
      setClipboard([]);
      fetchContents(targetFolderId);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+X (Cut)
      if (e.ctrlKey && e.key.toLowerCase() === 'x') {
        if (selectedItems.length > 0) {
          handleCut(selectedItems);
        }
      }
      // Ctrl+V (Paste)
      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        handlePaste();
      }
      // Delete (Delete key)
      if (e.key === 'Delete') {
        handleBatchDelete();
      }

      // Arrow keys navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (allItems.length === 0) return;

        let currentIndex = -1;
        if (selectedItems.length > 0) {
          const lastSelected = selectedItems[selectedItems.length - 1];
          currentIndex = allItems.findIndex(i => i.type === lastSelected.type && i.item.id === lastSelected.item.id);
        }

        let nextIndex = currentIndex;

        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          nextIndex = currentIndex < allItems.length - 1 ? currentIndex + 1 : allItems.length - 1;
        }

        if (nextIndex !== currentIndex) {
          e.preventDefault(); // Prevent scrolling
          const nextItem = allItems[nextIndex];
          if (e.shiftKey && currentIndex !== -1) {
            const start = Math.min(currentIndex, nextIndex);
            const end = Math.max(currentIndex, nextIndex);

            // To properly do shift selection, we should keep track of the original anchor, 
            // but for simplicity, we just add the next item to the selection.
            const isAlreadySelected = selectedItems.find(i => i.type === nextItem.type && i.item.id === nextItem.item.id);
            if (!isAlreadySelected) {
              setSelectedItems([...selectedItems, nextItem]);
            } else {
              // If reversing direction, we remove the current item
              setSelectedItems(selectedItems.filter(i => !(i.type === allItems[currentIndex].type && i.item.id === allItems[currentIndex].item.id)));
            }
          } else {
            setSelectedItems([nextItem]);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, clipboard, allItems]);

  const handleShare = (e, item, type) => {
    e.stopPropagation();
    const name = type === 'folder' ? item.name : item.filename;
    const shareUrl = window.location.href;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      showToast(`Link copied to clipboard`);
    }).catch(() => {
      showToast(`Link copied to clipboard`);
    });
  };

  const handleDownloadFolder = (e, rawFolder) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (downloading) {
      showToast("A download is already in progress.");
      return;
    }
    const folder = rawFolder?.item || rawFolder;
    showToast(`Folder downloading is coming soon`);
  };

  const handleToggleStar = (e, item, type) => {
    e.stopPropagation();
    const idKey = `${type}-${item.id}`;
    const name = type === 'folder' ? item.name : item.filename;
    setStarredItems(prev => {
      const next = new Set(prev);
      if (next.has(idKey)) {
        next.delete(idKey);
        showToast(`Removed "${name}" from Starred`);
      } else {
        next.add(idKey);
        showToast(`Added "${name}" to Starred`);
      }
      return next;
    });
  };

  const handleItemContextMenu = (e, type, item) => {
    e.preventDefault();
    e.stopPropagation();

    // If this item is not already part of selectedItems, select it:
    let isMulti = selectedItems && selectedItems.length > 1;
    const isAlreadySelected = selectedItems.some(i => i.type === type && i.item.id === item.id);
    if (!isAlreadySelected) {
      setSelectedItems([{ type, item }]);
      isMulti = false;
    }

    // Measure / clamp coordinates to viewport:
    const menuWidth = 260; // w-64 is 256px
    const menuHeight = type === 'file' ? 440 : 380;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = Math.max(10, window.innerWidth - menuWidth - 12);
    }
    if (y + menuHeight > window.innerHeight) {
      y = Math.max(10, window.innerHeight - menuHeight - 12);
    }

    setItemContextMenu({ x, y, type, item, isMultiple: isMulti });
    setMainContextMenu(null);
    setActiveRowMenu(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1B1B1B] text-white overflow-hidden font-sans text-[14px]">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#323232] text-[#E8EAED] px-6 py-3 rounded-full shadow-2xl border border-[#444746]/60 z-[200] flex items-center gap-3 animate-fade-in-up">
          <div className="w-2 h-2 bg-[#8AB4F8] rounded-full"></div>
          {toastMessage}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
      />
      <input
        type="file"
        className="hidden"
        ref={folderInputRef}
        onChange={handleFileUpload}
        webkitdirectory="true"
        directory="true"
        multiple
      />

      {/* TOP BAR */}
      <Header
        onNavigateRoot={() => handleNavigate({ id: null, name: 'My Clout' })}
        onOpenSettings={() => setShowSettingsModal(true)}
        telegramConfigured={telegramConfigured}
        telegramConnected={connectionStatus === 'connected'}
        telegramConnecting={connectionStatus === 'connecting'}
        onRetryTelegram={handleRetryTelegram}
        driveEnabled={isDriveActive}
        driveMounted={isDriveActive}
        driveConnected={isDriveActive}
        driveConnecting={driveConnecting}
        onToggleDrive={handleToggleDrive}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      {/* BODY (SIDEBAR + MAIN CONTENT BLACK BOX) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <Sidebar
          showNewDropdown={showNewDropdown}
          setShowNewDropdown={setShowNewDropdown}
          dropdownRef={dropdownRef}
          onCreateFolder={createFolder}
          fileInputRef={fileInputRef}
          folderInputRef={folderInputRef}
          uploading={uploading}
          onNavigateRoot={() => handleNavigate({ id: null, name: 'My Clout' })}
          totalStorageUsed={totalStorageUsed}
          onShowStorageToast={() => showToast(`Total storage used: ${formatSize(totalStorageUsed)}`)}
          driveEnabled={isDriveActive}
          onUploadFromDrive={handleUploadFromDrive}
          onUploadFolderFromDrive={handleUploadFolderFromDrive}
          isDriveTransferDisabled={isDriveTransferDisabled}
        />


        {/* MAIN VIEW CONTAINER (THE BLACK BOX) */}
        <div
          className="flex-1 flex flex-col bg-[#131314] rounded-[24px] mb-4 mr-4 overflow-hidden relative"
          onContextMenu={(e) => {
            e.preventDefault();
            setItemContextMenu(null);
            const menuWidth = 224; // w-56
            const menuHeight = 150;
            let x = e.clientX;
            let y = e.clientY;

            if (x + menuWidth > window.innerWidth) {
              x = Math.max(10, window.innerWidth - menuWidth - 12);
            }
            if (y + menuHeight > window.innerHeight) {
              y = Math.max(10, window.innerHeight - menuHeight - 12);
            }

            setMainContextMenu({ x, y });
          }}
        >
          {/* CONTENT AREA */}
          <div
            ref={contentAreaRef}
            className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar"
            onMouseDown={handleMarqueeMouseDown}
            onClick={() => {
              setSelectedItems([]);
              setActiveRowMenu(null);
              setMainContextMenu(null);
              setItemContextMenu(null);
            }}
          >
            {/* Toolbar: Breadcrumbs/Title, Google Drive Menu, View Switcher, Filter Pills & Paste */}
            <Toolbar
              breadcrumbs={breadcrumbs}
              showFolderMenu={showFolderMenu}
              setShowFolderMenu={setShowFolderMenu}
              folderMenuRef={folderMenuRef}
              onCreateFolder={createFolder}
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
              uploading={uploading}
              viewMode={viewMode}
              setViewMode={setViewMode}
              selectedItems={selectedItems}
              setSelectedItems={setSelectedItems}
              showToast={showToast}
              clipboard={clipboard}
              handlePaste={handlePaste}
              handleNavigate={handleNavigate}
              downloading={downloading}
              handleDownload={handleDownload}
              handleDownloadFolder={handleDownloadFolder}
              handleRenameFolder={handleRenameFolder}
              handleDeleteFolder={handleDeleteCurrentFolder}
              handleCut={handleCut}
              handleShare={handleShare}
              handleToggleStar={handleToggleStar}
              starredItems={starredItems}
              driveEnabled={isDriveActive}
              handleSaveToDrive={handleSaveToDrive}
              onUploadFromDrive={handleUploadFromDrive}
              onUploadFolderFromDrive={handleUploadFolderFromDrive}
              isDriveTransferDisabled={isDriveTransferDisabled}
            />

            {/* List or Grid View */}
            {viewMode === 'list' ? (
              <TableView
                isLoading={isLoading}
                sortedFolders={sortedFolders}
                sortedFiles={sortedFiles}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortAsc={sortAsc}
                setSortAsc={setSortAsc}
                showHeaderSortDropdown={showHeaderSortDropdown}
                setShowHeaderSortDropdown={setShowHeaderSortDropdown}
                headerSortDropdownRef={headerSortDropdownRef}
                selectedItems={selectedItems}
                clipboard={clipboard}
                starredItems={starredItems}
                activeRowMenu={activeRowMenu}
                setActiveRowMenu={setActiveRowMenu}
                handleItemClick={handleItemClick}
                handleNavigate={handleNavigate}
                handleShare={handleShare}
                downloading={downloading}
                handleDownload={handleDownload}
                handleDownloadFolder={handleDownloadFolder}
                handleRename={handleRename}
                handleRenameFolder={handleRenameFolder}
                handleToggleStar={handleToggleStar}
                handleCut={handleCut}
                handleBatchDelete={handleBatchDelete}
                handleDeleteFile={handleDeleteFile}
                handleDeleteFolderItem={handleDeleteFolderItem}
                handleMakeCopy={handleMakeCopy}
                showToast={showToast}
                setSelectedItems={setSelectedItems}
                onItemContextMenu={handleItemContextMenu}
                driveEnabled={isDriveActive}
                handleSaveToDrive={handleSaveToDrive}
                isDriveTransferDisabled={isDriveTransferDisabled}
              />
            ) : (
              <GridView
                isLoading={isLoading}
                sortedFolders={sortedFolders}
                sortedFiles={sortedFiles}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortAsc={sortAsc}
                setSortAsc={setSortAsc}
                selectedItems={selectedItems}
                clipboard={clipboard}
                starredItems={starredItems}
                activeRowMenu={activeRowMenu}
                setActiveRowMenu={setActiveRowMenu}
                handleItemClick={handleItemClick}
                handleNavigate={handleNavigate}
                downloading={downloading}
                handleDownload={handleDownload}
                handleDownloadFolder={handleDownloadFolder}
                handleRename={handleRename}
                handleRenameFolder={handleRenameFolder}
                handleCut={handleCut}
                handleShare={handleShare}
                handleToggleStar={handleToggleStar}
                handleBatchDelete={handleBatchDelete}
                handleDeleteFile={handleDeleteFile}
                handleDeleteFolderItem={handleDeleteFolderItem}
                handleMakeCopy={handleMakeCopy}
                showToast={showToast}
                setSelectedItems={setSelectedItems}
                onItemContextMenu={handleItemContextMenu}
                driveEnabled={isDriveActive}
                handleSaveToDrive={handleSaveToDrive}
                isDriveTransferDisabled={isDriveTransferDisabled}
              />
            )}

          </div>
        </div>
      </div>

      {/* FLOATING UPLOAD PROGRESS WIDGET */}
      <UploadWidget
        uploadWidgetOpen={uploadWidgetOpen}
        setUploadWidgetOpen={setUploadWidgetOpen}
        uploadMinimized={uploadMinimized}
        setUploadMinimized={setUploadMinimized}
        uploadCancelled={uploadCancelled}
        uploadComplete={uploadComplete}
        uploading={uploading}
        isFolderUploadState={isFolderUploadState}
        uploadStats={uploadStats}
        uploadItemName={uploadItemName}
        timeLeftText={timeLeftText}
        overallProgress={overallProgress}
        uploadedFolderId={uploadedFolderId}
        currentFolderId={currentFolderId}
        breadcrumbs={breadcrumbs}
        setShowCancelModal={setShowCancelModal}
        handleDirectCancelItem={handleDirectCancelItem}
        handleOpenUploadedFolder={handleOpenUploadedFolder}
        handleLocateUploadedItem={handleLocateUploadedItem}
      />

      {/* FLOATING DOWNLOAD PROGRESS WIDGET */}
      <DownloadWidget
        downloadWidgetOpen={downloadWidgetOpen}
        setDownloadWidgetOpen={setDownloadWidgetOpen}
        downloadMinimized={downloadMinimized}
        setDownloadMinimized={setDownloadMinimized}
        downloadCancelled={downloadCancelled}
        downloadComplete={downloadComplete}
        downloading={downloading}
        downloadStatus={downloadStatus}
        downloadStats={downloadStats}
        downloadItemName={downloadItemName}
        timeLeftText={downloadTimeLeftText}
        downloadProgress={downloadProgress}
        handleDirectCancelDownload={handleDirectCancelDownload}
        setShowCancelDownloadModal={setShowCancelDownloadModal}
        uploadWidgetOpen={uploadWidgetOpen}
      />

      {/* REPLACE CONFLICT MODAL */}
      <ReplaceModal
        replaceModal={replaceModal}
        onCancel={handleCancelReplaceModal}
        onConfirm={handleConfirmReplace}
      />

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      <DeleteModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.title}
        message={deleteModal.message}
        itemName={deleteModal.itemName}
        itemCount={deleteModal.itemCount}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModal.onConfirm}
      />

      {/* CUSTOM RENAME MODAL */}
      <RenameModal
        isOpen={renameModal.isOpen}
        initialName={renameModal.initialName}
        itemType={renameModal.itemType}
        onClose={() => setRenameModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={renameModal.onConfirm}
      />

      {/* CANCEL UPLOAD CONFIRMATION MODAL */}
      <CancelUploadModal
        show={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onCancelUpload={handleCancelUpload}
      />

      {/* CANCEL DOWNLOAD CONFIRMATION MODAL */}
      <CancelDownloadModal
        show={showCancelDownloadModal}
        onClose={() => setShowCancelDownloadModal(false)}
        onCancelDownload={handleCancelDownload}
      />

      {/* Right-Click Context Menu in Main Content Area (Empty space) */}
      {mainContextMenu && (
        <NewItemMenu
          className="fixed z-[100]"
          style={{ top: `${mainContextMenu.y}px`, left: `${mainContextMenu.x}px` }}
          onCreateFolder={createFolder}
          onUploadFile={() => fileInputRef.current?.click()}
          onUploadFolder={() => folderInputRef.current?.click()}
          onUploadFromDrive={handleUploadFromDrive}
          onUploadFolderFromDrive={handleUploadFolderFromDrive}
          driveEnabled={isDriveActive}
          uploading={uploading}
          isDriveTransferDisabled={isDriveTransferDisabled}
          onClose={() => setMainContextMenu(null)}
        />
      )}

      {/* Right-Click Context Menu for File or Folder (Shared ItemActionMenu) */}
      {itemContextMenu && (
        <ItemActionMenu
          item={itemContextMenu.item}
          type={itemContextMenu.type}
          isMultiple={itemContextMenu.isMultiple !== undefined ? itemContextMenu.isMultiple : (selectedItems && selectedItems.length > 1)}
          selectedItems={selectedItems}
          className="fixed z-[100]"
          style={{ top: `${itemContextMenu.y}px`, left: `${itemContextMenu.x}px` }}
          onClose={() => setItemContextMenu(null)}
          downloading={downloading}
          isDriveTransferDisabled={isDriveTransferDisabled}
          handleDownload={handleDownload}
          handleDownloadFolder={handleDownloadFolder}
          handleRename={handleRename}
          handleRenameFolder={handleRenameFolder}
          handleDelete={handleDeleteFile}
          handleDeleteFolder={handleDeleteFolderItem}
          handleBatchDelete={handleBatchDelete}
          handleCut={handleCut}
          handleShare={handleShare}
          handleToggleStar={handleToggleStar}
          handleMakeCopy={handleMakeCopy}
          starredItems={starredItems}
          showToast={showToast}
          driveEnabled={isDriveActive}
          handleSaveToDrive={handleSaveToDrive}
        />
      )}

      {/* FLOATING DRIVE TRANSFER PROGRESS WIDGET */}
      <DriveTransferWidget
        job={activeDriveJob}
        isOpen={driveWidgetOpen}
        setIsOpen={setDriveWidgetOpen}
        isMinimized={driveWidgetMinimized}
        setIsMinimized={setDriveWidgetMinimized}
        onCancel={handleCancelDriveJob}
        offsetRight={uploadWidgetOpen || downloadWidgetOpen}
        onOuterClose={() => {
          const isRunning = activeDriveJob && !['completed', 'failed', 'cancelled'].includes(activeDriveJob.status);
          if (isRunning) {
            setShowCancelDriveModal(true);
          } else {
            setDriveWidgetOpen(false);
          }
        }}
      />

      {/* CANCEL DRIVE TRANSFER CONFIRMATION MODAL */}
      <CancelDriveTransferModal
        show={showCancelDriveModal}
        onClose={() => setShowCancelDriveModal(false)}
        onCancelTransfer={handleCancelDriveJob}
      />

      {/* DRIVE CONNECTION FLOW MODAL */}
      <DriveConnectionModal
        show={showDriveConnectionModal}
        onClose={() => setShowDriveConnectionModal(false)}
        onComplete={handleDriveConnectionComplete}
        showToast={showToast}
      />

      {/* SETTINGS MODAL */}
      <SettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        driveEnabled={isDriveActive}
        onConnectDrive={() => {
          setShowSettingsModal(false);
          if (!telegramConfigured) {
            showToast("Please configure your Telegram bot in Settings first.");
            setShowSettingsModal(true);
            return;
          }
          setShowDriveConnectionModal(true);
        }}
        onDisconnectDrive={() => {
          handleToggleDrive(false);
        }}
        onSettingsUpdated={(settings) => {
          if (settings?.telegram_configured !== undefined) {
            setTelegramConfigured(Boolean(settings.telegram_configured));
          }
          axios.post(`${API_BASE}/connection/start`).catch(() => {});
        }}
        onDataRestored={() => {
          setCurrentFolderId(null);
          currentFolderIdRef.current = null;
          setBreadcrumbs([{ id: null, name: 'My Clout' }]);
          fetchContents(null);
          fetchStorage();
          showToast("Data backup successfully restored! Previous data was overwritten.");
        }}
      />

      {/* DRIVE FILE / FOLDER PICKER MODAL */}
      <DrivePickerModal
        show={showDrivePicker}
        onClose={() => {
          setShowDrivePicker(false);
          setExportTargetFile(null);
        }}
        mode={drivePickerMode}
        onSelectFile={handleConfirmDriveImport}
        onSelectFolder={(folderObjOrPath) => {
          if (drivePickerMode === 'import_folder') {
            executeDriveFolderImport(folderObjOrPath);
          } else {
            handleConfirmDriveExport(folderObjOrPath);
          }
        }}
        onOpenSettings={() => setShowSettingsModal(true)}
        onMountDrive={() => {
          setShowDrivePicker(false);
          setShowDriveConnectionModal(true);
        }}
        onDriveUnmounted={() => {
          setDriveMounted(false);
          setDriveEnabled(false);
        }}
        showToast={showToast}
      />


      {/* NEW FOLDER MODAL */}
      <NewFolderModal
        show={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        onSubmit={handleCreateFolderSubmit}
        inputRef={newFolderInputRef}
      />


      {/* Rubberband / Marquee Drag Selection Box matching Google Drive */}
      {dragBox && (
        <div
          className="fixed pointer-events-none z-[999] border border-white/60 bg-white/10 select-none rounded-[1px] shadow-sm"
          style={{
            left: `${dragBox.left}px`,
            top: `${dragBox.top}px`,
            width: `${dragBox.width}px`,
            height: `${dragBox.height}px`,
          }}
        />
      )}
    </div>
  );
}

export default App;
