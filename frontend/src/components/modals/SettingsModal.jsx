import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../../constants';
import {
  X,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Check,
  ExternalLink,
  ShieldCheck,
  Globe,
  Database,
  Download,
  Upload
} from 'lucide-react';
import TelegramGuideModal from './TelegramGuideModal';

export default function SettingsModal({
  show,
  onClose,
  driveEnabled,
  onConnectDrive,
  onDisconnectDrive,
  onSettingsUpdated,
  onDataRestored
}) {
  const [botToken, setBotToken] = useState('');
  const [targetChatId, setTargetChatId] = useState('');
  const [isTelegramConfigured, setIsTelegramConfigured] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [detectAttempts, setDetectAttempts] = useState(0);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Data Backup & Restore states
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState(null);
  const restoreFileInputRef = React.useRef(null);

  useEffect(() => {
    if (show) {
      setStatusMsg(null);
      axios.get(`${API_BASE}/settings`)
        .then(res => {
          if (res.data) {
            setBotToken(res.data.bot_token || '');
            setTargetChatId(res.data.target_chat_id || '');
            setIsTelegramConfigured(Boolean(res.data.telegram_configured));
          }
        })
        .catch(() => {});
    }
  }, [show]);

  if (!show) return null;

  const handleSaveTelegram = async (e) => {
    e?.preventDefault();
    if (!botToken.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter your Bot Token from @BotFather.' });
      return;
    }
    if (!targetChatId.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter or auto-detect your Target Chat ID.' });
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    try {
      let res;
      try {
        res = await axios.post(`${API_BASE}/settings/telegram`, {
          bot_token: botToken.trim(),
          target_chat_id: targetChatId.trim()
        });
      } catch (firstErr) {
        if (firstErr.message === 'Network Error') {
          // Retry once after 1.5s in case backend was completing startup
          await new Promise(r => setTimeout(r, 1500));
          res = await axios.post(`${API_BASE}/settings/telegram`, {
            bot_token: botToken.trim(),
            target_chat_id: targetChatId.trim()
          });
        } else {
          throw firstErr;
        }
      }

      if (res.data?.status === 'success') {
        setIsTelegramConfigured(true);
        setStatusMsg({
          type: 'success',
          text: res.data.message || 'Telegram configured and verified successfully!'
        });
        if (onSettingsUpdated) {
          onSettingsUpdated(res.data);
        }
      }
    } catch (err) {
      let detail = err.response?.data?.detail || err.message || 'Failed to save Telegram settings.';
      if (err.message === 'Network Error' || detail === 'Network Error') {
        detail = 'Local backend server is unreachable. Please restart the application.';
      }
      setStatusMsg({ type: 'error', text: detail });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDetect = async () => {
    if (!botToken.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter your Bot Token first to detect chat ID.' });
      return;
    }

    setDetecting(true);
    setStatusMsg({
      type: 'info',
      text: '🟢 Listening... Go to your channel and post a message NOW.'
    });

    try {
      let res;
      try {
        res = await axios.post(`${API_BASE}/settings/detect-chat-id`, {
          bot_token: botToken.trim()
        }, { timeout: 35000 });
      } catch (firstErr) {
        if (firstErr.message === 'Network Error') {
          // Retry once after 1.5s in case backend was completing startup
          await new Promise(r => setTimeout(r, 1500));
          res = await axios.post(`${API_BASE}/settings/detect-chat-id`, {
            bot_token: botToken.trim()
          }, { timeout: 35000 });
        } else {
          throw firstErr;
        }
      }

      if (res.data?.success && res.data.chat_id) {
        setTargetChatId(res.data.chat_id);
        setDetectAttempts(0);
        setStatusMsg({
          type: 'success',
          text: `Found chat: "${res.data.title}" (ID: ${res.data.chat_id})!`
        });
      }
    } catch (err) {
      setDetectAttempts(prev => prev + 1);
      let detail = err.response?.data?.detail || err.message || 'Could not auto-detect chat ID.';
      if (err.message === 'Network Error' || detail === 'Network Error') {
        detail = 'Local backend server is unreachable. Please restart the application.';
      } else if (detail === 'Not Found' || err.response?.status === 404 || detail.includes('Listening timed out')) {
        detail = 'Listening timed out or no message detected. If this happens repeatedly, try turning ON a VPN (Telegram API may be restricted by your ISP) or enter your Chat ID manually.';
      }
      setStatusMsg({ type: 'error', text: detail });
    } finally {
      setDetecting(false);
    }
  };

  const handleExportBackup = async () => {
    setBackupLoading(true);
    setBackupMsg(null);
    try {
      const res = await axios.get(`${API_BASE}/settings/export-data`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      link.download = `unlim_clout_backup_${dateStr}_${timeStr}.clout`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setBackupMsg({ type: 'success', text: 'Backup exported successfully!' });
    } catch (err) {
      setBackupMsg({ type: 'error', text: err.response?.data?.detail || err.message || 'Failed to export backup.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSelectRestoreFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result);
        if (parsed?.app !== 'unlim-clout' || !parsed?.database) {
          setBackupMsg({ type: 'error', text: 'Invalid backup file. Must be an Unlim Clout backup archive.' });
          return;
        }
        setPendingRestoreData(parsed);
        setShowRestoreConfirm(true);
      } catch (jsonErr) {
        setBackupMsg({ type: 'error', text: 'Failed to read JSON: ' + jsonErr.message });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestoreData) return;
    setBackupLoading(true);
    setBackupMsg(null);
    try {
      const res = await axios.post(`${API_BASE}/settings/import-data`, pendingRestoreData);
      if (res.data?.status === 'success') {
        setBackupMsg({ type: 'success', text: res.data.message });
        setShowRestoreConfirm(false);
        setPendingRestoreData(null);

        // Re-read settings from backend
        try {
          const settingsRes = await axios.get(`${API_BASE}/settings`);
          if (settingsRes.data) {
            setBotToken(settingsRes.data.bot_token || '');
            setTargetChatId(settingsRes.data.target_chat_id || '');
            setIsTelegramConfigured(Boolean(settingsRes.data.telegram_configured));
          }
        } catch (_) {}

        if (onSettingsUpdated) {
          onSettingsUpdated(res.data);
        }
        if (onDataRestored) {
          onDataRestored();
        }
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to restore backup.';
      setBackupMsg({ type: 'error', text: detail });
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-[2px] select-none p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="bg-[#1e1f20] border border-[#444746] rounded-[24px] p-6 w-[580px] max-w-[94vw] max-h-[92vh] shadow-2xl relative text-[#E8EAED] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#333538] mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#004A77] text-[#C2E7FF]">
                <HardDrive size={22} />
              </div>
              <div>
                <h2 className="text-[19px] font-medium text-[#E3E3E3]">Settings & Storage</h2>
                <p className="text-[12px] text-[#A8C7FA]">Configure your Cloud Storage & Integrations</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[#333538] text-[#C4C7C5] transition-colors cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="overflow-y-auto overflow-x-hidden pr-1 flex flex-col gap-4 my-1 custom-scrollbar text-[13px]">
            {/* 1. DISCLAIMER: 80GB MAX COLAB LIMIT */}
            <div className="bg-[#3E2723]/40 border border-[#F28B82]/40 rounded-2xl p-3.5 flex items-start gap-3 text-[12px] text-[#F6AEA9]">
              <AlertTriangle size={18} className="text-[#F28B82] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-[#F28B82] text-[13px] mb-0.5">
                  Colab Storage Notice
                </span>
                <span>
                  Folders of any size can be transferred because files and temporary chunks are deleted after upload. Individual single files must not exceed <strong>80 GB</strong> due to Google Colab ephemeral VM storage limits.
                </span>
              </div>
            </div>

            {/* 2. TELEGRAM CLOUD STORAGE CONFIGURATION */}
            <div className="bg-[#282a2c] border border-[#3c4043] rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#002D4C] text-[#2AABEE]">
                    <Send size={18} />
                  </div>
                  <div>
                    <span className="font-medium text-[#E3E3E3] text-[14px] block">Telegram Cloud Storage</span>
                    <span className="text-[11px] text-[#9AA0A6]">
                      Encrypted multi-part cloud storage via your Telegram bot
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1e1f20] hover:bg-[#333538] text-[#A8C7FA] border border-[#444746] text-[11px] font-medium transition-colors cursor-pointer"
                    title="View step-by-step setup guide"
                  >
                    <HelpCircle size={13} />
                    <span>Setup Guide</span>
                  </button>
                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                      isTelegramConfigured
                        ? 'bg-[#0E3A24] text-[#81C995]'
                        : 'bg-[#3E2723] text-[#F28B82]'
                    }`}
                  >
                    {isTelegramConfigured ? (
                      <>
                        <CheckCircle2 size={12} /> Configured
                      </>
                    ) : (
                      'Not Configured'
                    )}
                  </span>
                </div>
              </div>

              {/* Bot Token Field */}
              <div className="flex flex-col gap-1 mt-1">
                <label className="text-[12px] font-medium text-[#C4C7C5] flex items-center justify-between">
                  <span>Telegram Bot Token</span>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-[11px] text-[#A8C7FA] hover:text-[#C2E7FF] flex items-center gap-1 cursor-pointer"
                  >
                    {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>{showToken ? 'Hide' : 'Show'}</span>
                  </button>
                </label>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="e.g. 8512507717:AAGVF3P5OO06ph3QZJTpK2NfI..."
                  className="bg-[#1e1f20] border border-[#444746] focus:border-[#A8C7FA] text-[#E8EAED] px-3 py-2 rounded-xl text-[12px] font-mono outline-none transition-colors w-full"
                />
                <span className="text-[11px] text-[#80868B]">
                  Obtained from @BotFather on Telegram.
                </span>
              </div>

              {/* Target Chat ID Field + Auto Detect Button */}
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-[#C4C7C5]">
                  Target Chat / Channel ID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={targetChatId}
                    onChange={(e) => setTargetChatId(e.target.value)}
                    placeholder="e.g. -1002944096759"
                    className="bg-[#1e1f20] border border-[#444746] focus:border-[#A8C7FA] text-[#E8EAED] px-3 py-2 rounded-xl text-[12px] font-mono outline-none transition-colors flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAutoDetect}
                    disabled={detecting || !botToken.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#004A77] hover:bg-[#005B94] disabled:opacity-50 text-[#C2E7FF] rounded-xl text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                    title="Auto-detect chat ID from recent messages in channel or DM"
                  >
                    {detecting ? (
                      <Loader2 size={14} className="animate-spin text-[#C2E7FF]" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>{detecting ? 'Detecting...' : 'Auto-Detect'}</span>
                  </button>
                </div>
                <span className="text-[11px] text-[#80868B]">
                  ID of your private channel (e.g. -100...) or user chat where files will be stored.
                </span>

                {/* VPN Suggestion Callout if auto-detection times out or is attempted multiple times */}
                {detectAttempts >= 1 && (
                  <div className="bg-[#002D4C]/50 border border-[#7CBBFF]/40 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-[#C2E7FF] animate-in fade-in duration-200 mt-0.5">
                    <Globe size={14} className="text-[#7CBBFF] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[#7CBBFF] block">Detection Taking Multiple Attempts?</span>
                      <span>
                        Try turning <strong>ON a VPN</strong> (or switching location). Many local internet providers throttle or block Telegram Bot API connections. You can also paste your Channel ID directly.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button & Status Feedback */}
              <div className="flex items-center justify-between pt-1 mt-1">
                <div className="flex-1 mr-3">
                  {statusMsg && (
                    <div
                      className={`text-[11px] px-3 py-1.5 rounded-lg leading-snug flex items-center gap-1.5 ${
                        statusMsg.type === 'success'
                          ? 'bg-[#0E3A24] text-[#81C995] border border-[#34A853]/40'
                          : statusMsg.type === 'info'
                            ? 'bg-[#002D4C] text-[#C2E7FF] border border-[#7CBBFF]/40 animate-pulse'
                            : 'bg-[#3E2723] text-[#F28B82] border border-[#F28B82]/40'
                      }`}
                    >
                      {statusMsg.type === 'success' ? (
                        <Check size={12} />
                      ) : statusMsg.type === 'info' ? (
                        <Loader2 size={12} className="animate-spin text-[#C2E7FF]" />
                      ) : (
                        <AlertTriangle size={12} />
                      )}
                      <span>{statusMsg.text}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveTelegram}
                  disabled={loading || !botToken.trim() || !targetChatId.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#A8C7FA] hover:bg-[#8AB4F8] disabled:opacity-50 text-[#003354] rounded-xl text-[12px] font-medium transition-colors cursor-pointer shadow-md"
                >
                  {loading && <Loader2 size={14} className="animate-spin text-[#003354]" />}
                  <span>{loading ? 'Verifying...' : 'Save Telegram Settings'}</span>
                </button>
              </div>
            </div>

            {/* 3. GOOGLE DRIVE STORAGE INTEGRATION */}
            <div className="bg-[#282a2c] border border-[#3c4043] rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#0E3A24] text-[#81C995]">
                    <HardDrive size={18} />
                  </div>
                  <div>
                    <span className="font-medium text-[#E3E3E3] text-[14px] block">Google Drive Storage</span>
                    <span className="text-[11px] text-[#9AA0A6]">
                      {driveEnabled ? 'Mounted at /content/drive/MyDrive' : 'Bridge your own Google Drive account via Colab'}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                    driveEnabled ? 'bg-[#0E3A24] text-[#81C995]' : 'bg-[#3c4043] text-[#9AA0A6]'
                  }`}
                >
                  {driveEnabled ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between bg-[#1e1f20] border border-[#333538] rounded-xl p-3 mt-1">
                <div className="text-[12px] text-[#C4C7C5]">
                  {driveEnabled ? (
                    <span className="text-[#81C995] flex items-center gap-1.5 font-medium">
                      <CheckCircle2 size={14} /> Drive Bridge is active and ready for transfers.
                    </span>
                  ) : (
                    <span>Click below to authorize and mount your Google Drive account.</span>
                  )}
                </div>

                {driveEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onDisconnectDrive) onDisconnectDrive();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3E2723] hover:bg-[#4E2F2B] text-[#F28B82] border border-[#F28B82]/30 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onConnectDrive) onConnectDrive();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0E3A24] hover:bg-[#12472C] text-[#81C995] border border-[#34A853]/40 text-[11px] font-medium transition-colors cursor-pointer shadow-sm"
                  >
                    <HardDrive size={13} />
                    <span>Connect to Google Drive</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4. DATA BACKUP & RESTORE */}
            <div className="bg-[#282a2c] border border-[#3c4043] rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#004A77] text-[#C2E7FF]">
                    <Database size={18} />
                  </div>
                  <div>
                    <span className="font-medium text-[#E3E3E3] text-[14px] block">Data Backup & Restore</span>
                    <span className="text-[11px] text-[#9AA0A6]">
                      Export catalog and Telegram credentials to a portable file or restore
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#1e1f20] border border-[#333538] rounded-xl p-3 flex flex-col gap-3">
                <div className="text-[12px] text-[#C4C7C5] leading-relaxed">
                  Export your full file catalog (folders, multi-part chunks, file sizes) and linked channel credentials into an integrity-verified <code className="text-[#A8C7FA]">.clout</code> file. Restoring will overwrite existing data and reconnect your channel.
                </div>

                {backupMsg && (
                  <div
                    className={`text-[11px] px-3 py-1.5 rounded-lg leading-snug flex items-center gap-1.5 ${
                      backupMsg.type === 'success'
                        ? 'bg-[#0E3A24] text-[#81C995] border border-[#34A853]/40'
                        : 'bg-[#3E2723] text-[#F28B82] border border-[#F28B82]/40'
                    }`}
                  >
                    {backupMsg.type === 'success' ? <Check size={12} /> : <AlertTriangle size={12} />}
                    <span>{backupMsg.text}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    disabled={backupLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#004A77] hover:bg-[#005B94] disabled:opacity-50 text-[#C2E7FF] rounded-xl text-[12px] font-medium transition-colors cursor-pointer shadow-sm"
                  >
                    {backupLoading ? <Loader2 size={14} className="animate-spin text-[#C2E7FF]" /> : <Download size={14} />}
                    <span>Export Backup</span>
                  </button>

                  <input
                    ref={restoreFileInputRef}
                    type="file"
                    accept=".clout,.json"
                    className="hidden"
                    onChange={handleSelectRestoreFile}
                  />

                  <button
                    type="button"
                    onClick={() => restoreFileInputRef.current?.click()}
                    disabled={backupLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#333538] hover:bg-[#444746] disabled:opacity-50 text-[#E8EAED] rounded-xl text-[12px] font-medium transition-colors cursor-pointer shadow-sm"
                  >
                    <Upload size={14} />
                    <span>Import Backup...</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Overwrite & Restore Confirmation Dialog */}
          {showRestoreConfirm && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-[2px] p-4">
              <div className="bg-[#282A2C] border border-[#444746] rounded-[28px] p-6 w-[430px] max-w-full shadow-2xl text-[#E8EAED] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-[#5C1D1D] text-[#F28B82]">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-medium text-[#E3E3E3]">Overwrite & Restore?</h3>
                    <p className="text-[12px] text-[#F28B82]">Complete Database Overwrite</p>
                  </div>
                </div>
                <p className="text-[13px] text-[#C4C7C5] leading-relaxed">
                  Importing this backup will completely <strong>overwrite and replace</strong> all current files, folders, and Telegram credentials with the imported backup data. This action cannot be undone.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRestoreConfirm(false);
                      setPendingRestoreData(null);
                    }}
                    className="px-4 py-2 hover:bg-[#333538] text-[#C4C7C5] rounded-full text-[13px] font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRestore}
                    disabled={backupLoading}
                    className="flex items-center gap-1.5 px-5 py-2 bg-[#B3261E] hover:bg-[#8C1D18] text-white rounded-full text-[13px] font-medium transition-colors cursor-pointer shadow-md"
                  >
                    {backupLoading && <Loader2 size={13} className="animate-spin text-white" />}
                    <span>Overwrite & Restore</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#333538] mt-4">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-5 py-2 bg-[#333538] hover:bg-[#444746] text-[#E8EAED] rounded-full text-[13px] font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Telegram Setup Guide Modal */}
      <TelegramGuideModal
        show={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />
    </>
  );
}
