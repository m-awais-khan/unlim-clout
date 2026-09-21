import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from '../../constants';
import {
  X,
  HardDrive,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ArrowDown,
  RefreshCw,
  KeyRound,
  Copy,
  Check
} from 'lucide-react';

/**
 * DriveConnectionModal
 * Animated directional flow modal for establishing the Colab Google Drive bridge.
 * Step 1: Docker Worker Service
 * Step 2: Google OAuth Authentication
 * Step 3: Colab Runtime & Drive Mount
 * Step 4: Ready & Auto-Dismiss
 */
export default function DriveConnectionModal({
  show,
  onClose,
  onComplete,
  showToast
}) {
  // Step status: 'pending' | 'doing' | 'done' | 'action_needed' | 'error'
  const [step1Status, setStep1Status] = useState('doing'); // Docker
  const [step1Message, setStep1Message] = useState('Checking Docker service...');
  const [step1DockerOffline, setStep1DockerOffline] = useState(false);
  const [step1DockerNotInstalled, setStep1DockerNotInstalled] = useState(false);

  const [step2Status, setStep2Status] = useState('pending'); // Google Auth
  const [step2Message, setStep2Message] = useState('Waiting for worker...');
  const [authUrl, setAuthUrl] = useState(null);
  const [authCode, setAuthCode] = useState('');
  const [verifyingAuth, setVerifyingAuth] = useState(false);

  const [step3Status, setStep3Status] = useState('pending'); // Drive Mount
  const [step3Message, setStep3Message] = useState('Waiting for authorization...');
  const [driveAuthUrl, setDriveAuthUrl] = useState(null);
  const [confirmingMount, setConfirmingMount] = useState(false);

  const [isCompleted, setIsCompleted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const isRunningRef = useRef(false);

  const copyToClipboard = async (text) => {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch (_) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (err) {
        console.warn('Copy failed:', err);
      }
    }
    setCopiedLink(true);
    if (showToast) showToast('Google authorization link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const openExternalUrl = async (url) => {
    if (!url) return;

    // 1. Try native Tauri IPC command (handles Windows rundll32 with CREATE_NO_WINDOW)
    try {
      if (window.__TAURI_INTERNALS__?.invoke) {
        await window.__TAURI_INTERNALS__.invoke('open_browser_url', { url });
        return;
      }
    } catch (e) {
      console.warn('Tauri invoke open_browser_url failed:', e);
    }

    // 2. Try FastAPI backend endpoint (uses os.startfile / rundll32 on Windows)
    try {
      const res = await axios.post(`${API_BASE}/drive/open-url`, { url }, { timeout: 3000 });
      if (res.data?.status === 'opened') return;
    } catch (e) {
      console.warn('Backend /open-url failed:', e);
    }

    // 3. Fallback to standard window.open
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (_) { }
  };

  // Auto-detect when Drive finishes mounting while OAuth consent prompt is active
  useEffect(() => {
    let interval = null;
    if (show && driveAuthUrl && step3Status === 'action_needed' && !isCompleted) {
      interval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API_BASE}/drive/lifecycle/status`);
          if (statusRes.data?.drive_mounted) {
            setStep3Status('done');
            setStep3Message('Google Drive successfully mounted at /content/drive/MyDrive');
            setDriveAuthUrl(null);
            triggerCompletion();
          }
        } catch (_) { }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [show, driveAuthUrl, step3Status, isCompleted]);

  useEffect(() => {
    if (show) {
      // Reset state on open
      setStep1Status('doing');
      setStep1Message('Checking Docker service and starting container...');
      setStep1DockerOffline(false);
      setStep2Status('pending');
      setStep2Message('Waiting for Docker worker...');
      setAuthUrl(null);
      setAuthCode('');
      setStep3Status('pending');
      setStep3Message('Waiting for authorization...');
      setDriveAuthUrl(null);
      setIsCompleted(false);
      isRunningRef.current = true;

      runConnectionFlow();
    } else {
      isRunningRef.current = false;
    }
  }, [show]);

  // Main automated step sequence
  const runConnectionFlow = async () => {
    // Keep subsequent steps strictly in pending state
    setStep2Status('pending');
    setStep2Message('Waiting for Docker worker...');
    setAuthUrl(null);
    setAuthCode('');
    setStep3Status('pending');
    setStep3Message('Waiting for authorization...');
    setDriveAuthUrl(null);
    setIsCompleted(false);

    // --- STEP 1: DOCKER SERVICE ---
    try {
      setStep1Status('doing');
      setStep1DockerOffline(false);
      setStep1DockerNotInstalled(false);

      const startRes = await axios.post(`${API_BASE}/drive/lifecycle/start`);

      if (startRes.data?.status === 'docker_not_installed') {
        setStep1Status('action_needed');
        setStep1DockerNotInstalled(true);
        setStep1Message('Docker Desktop is not installed on this computer.');
        return;
      }

      if (startRes.data?.status === 'docker_daemon_offline') {
        setStep1Status('action_needed');
        setStep1DockerOffline(true);
        setStep1Message(startRes.data.message || 'Docker Desktop is not running.');
        return; // STOP! Never proceed to Step 2 if Docker is offline
      }

      // Poll until worker reports online
      let workerReady = false;
      for (let i = 0; i < 10; i++) {
        if (!isRunningRef.current) return;
        try {
          const statusRes = await axios.get(`${API_BASE}/drive/lifecycle/status`);
          if (statusRes.data?.worker_online) {
            workerReady = true;
            break;
          }
        } catch (_) { }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!workerReady) {
        setStep1Status('action_needed');
        setStep1Message('Worker container is not responding on port 8001. Please make sure Docker Desktop is running.');
        return; // STOP! Never proceed to Step 2 if worker is not ready
      }

      setStep1Status('done');
      setStep1Message('Docker worker container is active and healthy on :8001');
    } catch (err) {
      setStep1Status('action_needed');
      setStep1Message('Could not connect to Docker service. Ensure Docker Desktop is running.');
      return; // STOP! Never proceed to Step 2 on error
    }

    if (!isRunningRef.current) return;

    // --- STEP 2: GOOGLE AUTHENTICATION ---
    try {
      setStep2Status('doing');
      setStep2Message('Checking Google credentials in worker...');
      const statusRes = await axios.get(`${API_BASE}/drive/lifecycle/status`);

      if (statusRes.data?.authenticated) {
        setStep2Status('done');
        setStep2Message('Google account credentials verified.');
      } else {
        // Need to initiate Google OAuth
        setStep2Status('action_needed');
        setStep2Message('Google sign-in required. Please authenticate below.');
        try {
          const authStartRes = await axios.post(`${API_BASE}/drive/auth/start`);
          if (authStartRes.data?.auth_url) {
            setAuthUrl(authStartRes.data.auth_url);
            openExternalUrl(authStartRes.data.auth_url);
          }
        } catch (authErr) {
          console.error("Failed to generate auth url:", authErr);
        }
        return; // Pause until user enters auth code!
      }
    } catch (err) {
      setStep2Status('action_needed');
      setStep2Message('Error verifying Google credentials. Please retry.');
      return; // STOP! Never proceed to Step 3 on error
    }

    if (!isRunningRef.current) return;

    // --- STEP 3: COLAB RUNTIME & DRIVE MOUNT ---
    await executeStep3DriveMount();
  };

  const executeStep3DriveMount = async () => {
    try {
      setStep3Status('doing');
      setStep3Message('Adopting Colab runtime & mounting /content/drive/MyDrive...');
      const mountRes = await axios.post(`${API_BASE}/drive/mount`);

      if (mountRes.data?.status === 'mounted') {
        setStep3Status('done');
        setStep3Message('Google Drive successfully mounted at /content/drive/MyDrive');
        setDriveAuthUrl(null);
        triggerCompletion();
      } else if (mountRes.data?.status === 'drive_auth_needed' && mountRes.data?.auth_url) {
        setStep3Status('action_needed');
        setDriveAuthUrl(mountRes.data.auth_url);
        setStep3Message('Browser authorization required to link Google Drive. Please grant access in your browser.');
        openExternalUrl(mountRes.data.auth_url);
      } else {
        setStep3Status('action_needed');
        let errMsg = mountRes.data?.error || 'Drive mount could not complete. Please click Retry Mount.';
        setStep3Message(errMsg);
      }
    } catch (err) {
      setStep3Status('action_needed');
      setStep3Message('Could not complete Drive mount. Click Retry below.');
    }
  };

  const handleVerifyAuthCode = async (e) => {
    e.preventDefault();
    if (!authCode.trim()) return;
    try {
      setVerifyingAuth(true);
      const res = await axios.post(`${API_BASE}/drive/auth/verify`, { code: authCode.trim() });
      if (res.data?.status === 'authenticated') {
        setStep2Status('done');
        setStep2Message('Google account authenticated successfully!');
        setAuthUrl(null);
        setAuthCode('');
        // Proceed automatically to Step 3
        await executeStep3DriveMount();
      } else {
        if (showToast) showToast(res.data?.error || 'Verification failed. Please check code.');
      }
    } catch (err) {
      if (showToast) showToast(err.response?.data?.detail || 'Verification request failed');
    } finally {
      setVerifyingAuth(false);
    }
  };

  const handleConfirmDriveMount = async () => {
    try {
      setConfirmingMount(true);
      setStep3Status('doing');
      setStep3Message('Finalizing Drive mount confirmation on Colab runtime...');
      const res = await axios.post(`${API_BASE}/drive/mount`, { action: 'confirm' });
      if (res.data?.status === 'mounted') {
        setStep3Status('done');
        setStep3Message('Google Drive mounted at /content/drive/MyDrive');
        setDriveAuthUrl(null);
        triggerCompletion();
      } else {
        setStep3Status('action_needed');
        let errMsg = res.data?.error || 'Confirmation incomplete. Please grant permission in browser and retry.';
        setStep3Message(errMsg);
      }
    } catch (err) {
      setStep3Status('action_needed');
      setStep3Message('Mount confirmation error. Please retry.');
    } finally {
      setConfirmingMount(false);
    }
  };

  const triggerCompletion = () => {
    setIsCompleted(true);
    if (showToast) showToast('Google Drive bridge is fully connected!');
    setTimeout(() => {
      if (onComplete) onComplete();
      onClose();
    }, 1200);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-[3px] select-none p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1f20] border border-[#444746] rounded-[24px] p-6 w-[620px] max-w-[94vw] max-h-[92vh] flex flex-col shadow-2xl relative text-[#E8EAED] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing Background Ambience */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#34A853]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#2AABEE]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#333538] mb-5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#0E3A24] text-[#81C995] border border-[#34A853]/40 shadow-sm">
              <HardDrive size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-[19px] font-semibold text-[#E3E3E3] flex items-center gap-2">
                <span>Connect Google Drive</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#004A77] text-[#C2E7FF] font-medium tracking-wide">
                  Colab Bridge
                </span>
              </h2>
              <p className="text-[12px] text-[#9AA0A6]">
                Automating cloud runtime container & 80GB high-speed storage
              </p>
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

        {/* DIRECTIONAL FLOW STEPPER */}
        <div className="flex flex-col gap-3 relative z-10 overflow-y-auto overflow-x-hidden custom-scrollbar pr-0.5">
          {/* --- STEP 1: DOCKER WORKER --- */}
          <div
            className={`p-4 rounded-2xl border transition-all duration-300 ${step1Status === 'done'
                ? 'bg-[#0E3A24]/30 border-[#34A853]/60 text-[#81C995]'
                : step1Status === 'doing'
                  ? 'bg-[#002D4C]/35 border-[#2AABEE]/60 text-[#8AB4F8] shadow-sm shadow-[#2AABEE]/10'
                  : step1Status === 'action_needed'
                    ? 'bg-[#3E2723]/35 border-[#F9AB00]/70 text-[#FFE082]'
                    : 'bg-[#282a2c]/30 border-[#3c4043] text-[#9AA0A6]'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step1Status === 'done'
                      ? 'bg-[#34A853] text-[#002D15]'
                      : step1Status === 'doing'
                        ? 'bg-[#2AABEE] text-[#00233B]'
                        : step1Status === 'action_needed'
                          ? 'bg-[#F9AB00] text-[#331E00]'
                          : 'bg-[#3c4043] text-[#C4C7C5]'
                    }`}
                >
                  {step1Status === 'done' ? (
                    <CheckCircle2 size={16} />
                  ) : step1Status === 'doing' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : step1Status === 'action_needed' ? (
                    <AlertCircle size={16} />
                  ) : (
                    '1'
                  )}
                </div>
                <div>
                  <h4 className="text-[14px] font-medium text-[#E3E3E3]">Docker Worker Service</h4>
                  <p className="text-[12px] opacity-90 mt-0.5">{step1Message}</p>
                </div>
              </div>

              {step1Status === 'action_needed' && (
                <button
                  onClick={runConnectionFlow}
                  className="cursor-pointer px-3 py-1.5 bg-[#F9AB00] hover:bg-[#F29900] text-[#331E00] rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={12} /> Retry Detection
                </button>
              )}
            </div>

            {step1DockerNotInstalled && (
              <div className="mt-3 p-3 rounded-xl bg-[#282a2c] border border-[#F9AB00]/50 text-[12px] text-[#E8EAED] flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span><b>Docker Desktop</b> is required for Google Drive integration.</span>
                  <button
                    onClick={() => openExternalUrl("https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe")}
                    className="px-3.5 py-1.5 bg-[#004A77] hover:bg-[#005B94] text-[#C2E7FF] rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                  >
                    Download Docker
                  </button>
                </div>
                <span className="text-[11px] text-[#9AA0A6]">
                  Install Docker Desktop, launch it on your PC, then click "Retry Detection".
                </span>
              </div>
            )}

            {step1DockerOffline && !step1DockerNotInstalled && (
              <div className="mt-3 p-2.5 rounded-xl bg-[#282a2c] border border-[#503522] text-[12px] text-[#E8EAED] flex items-center justify-between">
                <span>Please start <b>Docker Desktop</b> on your computer.</span>
                <button
                  onClick={() => axios.post(`${API_BASE}/drive/lifecycle/start`).catch(() => { })}
                  className="text-[#A8C7FA] underline hover:text-[#C2E7FF] text-[11px] font-medium cursor-pointer"
                >
                  Launch App
                </button>
              </div>
            )}
          </div>

          {/* Directional Connector 1 -> 2 */}
          <div className="flex items-center justify-center -my-1">
            <div
              className={`flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-medium transition-colors ${step1Status === 'done'
                  ? 'text-[#34A853] bg-[#0E3A24]/40 border border-[#34A853]/30'
                  : 'text-[#5f6368] bg-[#232426]'
                }`}
            >
              <ArrowDown size={12} className={step1Status === 'doing' ? 'animate-bounce' : ''} />
              <span>Next</span>
            </div>
          </div>

          {/* --- STEP 2: GOOGLE AUTHENTICATION --- */}
          <div
            className={`p-4 rounded-2xl border transition-all duration-300 ${step2Status === 'done'
                ? 'bg-[#0E3A24]/30 border-[#34A853]/60 text-[#81C995]'
                : step2Status === 'doing'
                  ? 'bg-[#002D4C]/35 border-[#2AABEE]/60 text-[#8AB4F8] shadow-sm shadow-[#2AABEE]/10'
                  : step2Status === 'action_needed'
                    ? 'bg-[#3E2723]/35 border-[#F9AB00]/70 text-[#FFE082]'
                    : 'bg-[#282a2c]/30 border-[#3c4043] text-[#9AA0A6]'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step2Status === 'done'
                      ? 'bg-[#34A853] text-[#002D15]'
                      : step2Status === 'doing'
                        ? 'bg-[#2AABEE] text-[#00233B]'
                        : step2Status === 'action_needed'
                          ? 'bg-[#F9AB00] text-[#331E00]'
                          : 'bg-[#3c4043] text-[#C4C7C5]'
                    }`}
                >
                  {step2Status === 'done' ? (
                    <CheckCircle2 size={16} />
                  ) : step2Status === 'doing' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : step2Status === 'action_needed' ? (
                    <KeyRound size={16} />
                  ) : (
                    '2'
                  )}
                </div>
                <div>
                  <h4 className="text-[14px] font-medium text-[#E3E3E3]">Google Account OAuth</h4>
                  <p className="text-[12px] opacity-90 mt-0.5">{step2Message}</p>
                </div>
              </div>
            </div>

            {/* In-Card Google Sign-in Prompt when action is needed */}
            {step2Status === 'action_needed' && (
              <div className="mt-3.5 p-3 rounded-xl bg-[#1e1f20] border border-[#3c4043] flex flex-col gap-2.5">
                {authUrl ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#C4C7C5]">Click below to authenticate in browser:</span>
                    <button
                      type="button"
                      onClick={() => openExternalUrl(authUrl)}
                      className="cursor-pointer px-3 py-1.5 bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#003354] rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink size={12} /> Open Sign-In Tab
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => axios.post(`${API_BASE}/drive/auth/start`).then(r => r.data?.auth_url && openExternalUrl(r.data.auth_url))}
                    className="cursor-pointer self-start px-3 py-1.5 bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#003354] rounded-lg text-[12px] font-semibold"
                  >
                    Generate Sign-In Link
                  </button>
                )}

                <form onSubmit={handleVerifyAuthCode} className="flex items-center gap-2 pt-2 border-t border-[#303134]">
                  <input
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="Paste authorization code here"
                    className="flex-1 bg-[#282a2c] border border-[#444746] rounded-lg px-3 py-1.5 text-xs text-[#E3E3E3] outline-none focus:border-[#A8C7FA]"
                  />
                  <button
                    type="submit"
                    disabled={verifyingAuth || !authCode.trim()}
                    className="cursor-pointer px-3.5 py-1.5 bg-[#A8C7FA] hover:bg-[#8AB4F8] disabled:opacity-40 text-[#003354] rounded-lg text-xs font-semibold"
                  >
                    {verifyingAuth ? 'Verifying...' : 'Verify Code'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Directional Connector 2 -> 3 */}
          <div className="flex items-center justify-center -my-1">
            <div
              className={`flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-medium transition-colors ${step2Status === 'done'
                  ? 'text-[#34A853] bg-[#0E3A24]/40 border border-[#34A853]/30'
                  : 'text-[#5f6368] bg-[#232426]'
                }`}
            >
              <ArrowDown size={12} className={step2Status === 'doing' ? 'animate-bounce' : ''} />
              <span>Next</span>
            </div>
          </div>

          {/* --- STEP 3: COLAB RUNTIME & DRIVE MOUNT --- */}
          <div
            className={`p-4 rounded-2xl border transition-all duration-300 ${step3Status === 'done'
                ? 'bg-[#0E3A24]/30 border-[#34A853]/60 text-[#81C995]'
                : step3Status === 'doing'
                  ? 'bg-[#002D4C]/35 border-[#2AABEE]/60 text-[#8AB4F8] shadow-sm shadow-[#2AABEE]/10'
                  : step3Status === 'action_needed'
                    ? 'bg-[#3E2723]/35 border-[#F9AB00]/70 text-[#FFE082]'
                    : 'bg-[#282a2c]/30 border-[#3c4043] text-[#9AA0A6]'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step3Status === 'done'
                      ? 'bg-[#34A853] text-[#002D15]'
                      : step3Status === 'doing'
                        ? 'bg-[#2AABEE] text-[#00233B]'
                        : step3Status === 'action_needed'
                          ? 'bg-[#F9AB00] text-[#331E00]'
                          : 'bg-[#3c4043] text-[#C4C7C5]'
                    }`}
                >
                  {step3Status === 'done' ? (
                    <CheckCircle2 size={16} />
                  ) : step3Status === 'doing' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : step3Status === 'action_needed' ? (
                    <AlertCircle size={16} />
                  ) : (
                    '3'
                  )}
                </div>
                <div>
                  <h4 className="text-[14px] font-medium text-[#E3E3E3]">Colab Session & Drive Mount</h4>
                  <p className="text-[12px] opacity-90 mt-0.5">{step3Message}</p>
                </div>
              </div>

              {step3Status === 'action_needed' && !driveAuthUrl && (
                <button
                  onClick={executeStep3DriveMount}
                  className="cursor-pointer px-3 py-1.5 bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#003354] rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={12} /> Retry Mount
                </button>
              )}
            </div>

            {/* In-Card Drive Permission Prompt if browser confirmation is needed */}
            {driveAuthUrl && (
              <div className="mt-3.5 p-3 rounded-xl bg-[#1e1f20] border border-[#3c4043] flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] text-[#C4C7C5]">1. Grant permission in browser:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openExternalUrl(driveAuthUrl)}
                      className="cursor-pointer px-3 py-1.5 bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#003354] rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink size={12} /> Open Permission Page
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(driveAuthUrl)}
                      className="cursor-pointer px-2.5 py-1.5 bg-[#282a2c] hover:bg-[#3c4043] border border-[#444746] text-[#E3E3E3] rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-colors"
                      title="Copy URL to clipboard"
                    >
                      {copiedLink ? <Check size={12} className="text-[#81C995]" /> : <Copy size={12} />}
                      {copiedLink ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-[#9AA0A6] leading-relaxed">
                  If the browser tab does not open automatically, click <strong className="text-[#E3E3E3]">Copy Link</strong> and paste it into Chrome or Edge.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-[#303134]">
                  <span className="text-[11px] text-[#9AA0A6]">2. Once granted, click confirm:</span>
                  <button
                    onClick={handleConfirmDriveMount}
                    disabled={confirmingMount}
                    className="cursor-pointer px-3.5 py-1.5 bg-[#34A853] hover:bg-[#2E954B] text-[#002D15] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    {confirmingMount ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    <span>Confirm Access Granted</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* --- COMPLETION CELEBRATION BANNER --- */}
          {isCompleted && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#0E3A24] to-[#124E2E] border border-[#34A853] text-[#C2E7FF] flex items-center justify-between shadow-lg animate-fade-in">
              <div className="flex items-center gap-2.5">
                <Sparkles size={20} className="text-[#81C995] animate-spin" />
                <span className="text-[13px] font-semibold text-[#81C995]">
                  Google Drive Bridge Active — 80GB Cloud Ready!
                </span>
              </div>
              <span className="text-[11px] text-[#A8C7FA] font-medium">Auto-closing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
