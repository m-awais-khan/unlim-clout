import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  Check,
  AlertCircle,
  HardDrive,
  Loader2,
  XCircle
} from 'lucide-react';
import { formatSize } from '../utils/formatters';

export default function DriveTransferWidget({
  job,
  isOpen,
  setIsOpen,
  isMinimized,
  setIsMinimized,
  onCancel,
  offsetRight = false,
  onOuterClose
}) {
  if (!isOpen || !job) return null;

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelled = job.status === 'cancelled';
  const isRunning = !isCompleted && !isFailed && !isCancelled;
  const isFolder = job.job_type === 'drive_folder_to_telegram';

  const handleCloseClick = () => {
    if (onOuterClose) {
      onOuterClose();
    } else if (isRunning) {
      if (onCancel) onCancel();
      setIsOpen(false);
    } else {
      setIsOpen(false);
    }
  };

  const formatErrorMessage = (msg) => {
    if (!msg) return 'An error occurred during transfer';
    const lower = msg.toLowerCase();
    if (lower.includes('peer id invalid') || lower.includes('peer_id_invalid') || lower.includes('id not found')) {
      return 'Bot cannot access channel. Ensure bot is an Admin in your Telegram channel.';
    }
    if (lower.includes('not mounted') || (lower.includes('filenotfounderror') && lower.includes('drive'))) {
      return 'Google Drive is not mounted in Colab. Please toggle Google Drive above to mount.';
    }
    if (lower.includes('session') && (lower.includes('lost') || lower.includes('404') || lower.includes('not found'))) {
      return 'Google Colab session disconnected. Please check Colab status in Settings.';
    }
    if (lower.includes('connection failed') || lower.includes('connect call failed')) {
      return 'Connection timed out. Please check network/VPN.';
    }
    return msg;
  };

  const getStatusText = () => {
    if (isCompleted) return isFolder ? 'Folder transfer complete' : 'Transfer complete';
    if (isCancelled) return 'Transfer cancelled';
    if (isFailed) return `Transfer failed: ${formatErrorMessage(job.error_message)}`;

    if (isFolder) {
      if (job.status === 'pending') return 'Queuing folder transfer in Colab...';
      if (job.status === 'connecting') return 'Connecting to Telegram...';
      if (job.total_files > 0) {
        const fileNum = Math.min(job.total_files, (job.completed_files || 0) + 1);
        return `File ${fileNum} of ${job.total_files}: ${job.current_file || 'Uploading...'}`;
      }
      return 'Scanning folder and uploading files...';
    }

    if (job.status === 'pending') return 'Queuing transfer in Colab...';
    if (job.status === 'connecting') return 'Connecting to Telegram...';
    if (job.status === 'chunking') {
      return `Buffering part ${job.current_part} of ${job.total_parts}...`;
    }
    if (job.status === 'transferring') {
      if (job.total_parts > 1) {
        return `Uploading part ${job.current_part} of ${job.total_parts} to Telegram...`;
      }
      return 'Uploading to Telegram via Colab...';
    }
    if (job.status === 'downloading') {
      if (job.total_parts > 1) {
        return `Downloading part ${job.current_part} of ${job.total_parts}...`;
      }
      return 'Downloading from Telegram to Drive...';
    }
    if (job.status === 'merging') return 'Merging parts in Google Drive...';
    return 'Processing transfer...';
  };

  return (
    <div
      className={`fixed bottom-4 ${
        offsetRight ? 'right-[400px]' : 'right-6'
      } w-[360px] bg-[#202124] border border-[#3C4043] rounded-xl shadow-2xl overflow-hidden z-50 text-[#E8EAED] select-none transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#202124]">
        <div className="flex items-center gap-2">
          <HardDrive size={16} className={isCancelled ? "text-[#F28B82]" : "text-[#A8C7FA]"} />
          <span className="text-sm font-medium truncate max-w-[200px]">
            {isCompleted
              ? 'Drive transfer complete'
              : isCancelled
                ? 'Transfer cancelled'
                : isFailed
                  ? 'Transfer failed'
                  : 'Drive ⇄ Telegram'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="cursor-pointer p-1 hover:bg-[#3C4043] rounded-full text-[#C4C7C5] transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            onClick={handleCloseClick}
            className="cursor-pointer p-1 hover:bg-[#3C4043] rounded-full text-[#C4C7C5] transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div>
          {/* Status message bar */}
          <div className="bg-[#2B2C2F] px-4 py-2 flex items-center justify-between text-xs text-[#C4C7C5]">
            <span className="truncate pr-2">{getStatusText()}</span>
            {isRunning && onCancel && (
              <button
                onClick={onCancel}
                className="cursor-pointer text-[#8AB4F8] hover:underline font-medium flex-shrink-0"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Item details row */}
          <div className="px-4 py-3 bg-[#202124] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 rounded-lg bg-[#282a2c] flex-shrink-0">
                {isCompleted ? (
                  <Check size={18} className="text-emerald-400" />
                ) : isCancelled ? (
                  <XCircle size={18} className="text-[#F28B82]" />
                ) : isFailed ? (
                  <AlertCircle size={18} className="text-red-400" />
                ) : (
                  <Loader2 size={18} className="text-[#A8C7FA] animate-spin" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm text-[#E3E3E3] font-normal truncate">
                  {job.source_name || 'File transfer'}
                </span>
                <span className="text-xs text-[#9AA0A6]">
                  {formatSize(job.transferred_bytes || 0)}
                  {job.total_bytes > 0 && ` / ${formatSize(job.total_bytes)}`}
                  {isFolder && job.total_files > 0 && ` • ${job.completed_files || 0}/${job.total_files} files`}
                  {!isFolder && job.total_parts > 1 && ` • Part ${job.current_part || 1}/${job.total_parts}`}
                </span>
              </div>
            </div>

            {/* Circular or percentage badge */}
            <div className={`text-xs font-medium flex-shrink-0 ${isCancelled ? 'text-[#F28B82]' : 'text-[#A8C7FA]'}`}>
              {isCompleted ? '100%' : isCancelled ? 'Cancelled' : `${job.percent || 0}%`}
            </div>
          </div>

          {/* Progress bar line */}
          {isRunning && (
            <div className="w-full bg-[#303134] h-1">
              <div
                className="bg-[#A8C7FA] h-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(3, job.percent || 0)}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
