import React from 'react';
import { Search, HelpCircle, Settings, Loader2, HardDrive, AlertCircle, RefreshCw } from 'lucide-react';

const TelegramIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z" />
  </svg>
);

export default function Header({
  onNavigateRoot,
  onOpenSettings,
  telegramConfigured = false,
  telegramConnected = false,
  telegramConnecting = false,
  onRetryTelegram,
  driveEnabled = false,
  driveMounted = false,
  driveConnected = false,
  driveConnecting = false,
  onToggleDrive,
  onRefresh,
  isRefreshing = false
}) {
  return (
    <header className="h-[64px] flex items-center justify-between px-4 flex-shrink-0 select-none">
      {/* Left Branding */}
      <div className="w-[240px] flex items-center px-2 select-none flex-shrink-0">
        <div
          onClick={onNavigateRoot}
          className="flex items-center gap-[12px] cursor-pointer w-max select-none"
          style={{ gap: '12px' }}
        >
          <img
            src="/logo.png"
            alt=""
            role="none"
            aria-hidden="true"
            className="object-contain"
            style={{
              height: '40px',
              width: 'auto',
              maxHeight: '40px',
              boxSizing: 'content-box',
              padding: '0px',
              margin: '0px',
              verticalAlign: 'middle'
            }}
          />
          <span
            className="select-none"
            style={{
              fontFamily: "'Product Sans', 'Google Sans', Arial, sans-serif",
              fontSize: '22px',
              lineHeight: '48px',
              paddingLeft: '0px',
              position: 'relative',
              top: '-1.5px',
              verticalAlign: 'middle',
              color: '#e3e3e3',
              textRendering: 'optimizeLegibility',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              fontWeight: 500
            }}
          >
            Clout
          </span>
        </div>
      </div>

      {/* Center Search */}
      <div className="flex-1 max-w-[720px] bg-[#282A2C] rounded-full flex items-center px-4 py-3 border border-transparent focus-within:bg-[#303134] focus-within:shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-colors">
        <Search size={20} className="text-[#C4C7C5] mr-3" />
        <input
          type="text"
          placeholder="Search in Drive"
          className="bg-transparent border-none outline-none text-[#E3E3E3] w-full text-[16px]"
        />
        <button
          type="button"
          className="cursor-pointer p-1 rounded-full text-[#C4C7C5] hover:text-[#E8EAED] hover:bg-[#3C4043]/50 transition-colors ml-2 flex items-center justify-center"
          title="Search options"
        >
          <svg
            className="w-6 h-6 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="#858688"
            focusable="false"
            aria-hidden="true"
          >
            <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
          </svg>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 text-[#C4C7C5] ml-4 pr-2">
        {/* 1. TELEGRAM STATUS / PUNCH BUTTON (Cannot be turned off, can retry connection) */}
        {!telegramConfigured ? (
          <button
            onClick={onOpenSettings}
            className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3E2723]/70 border border-[#F28B82]/70 hover:bg-[#4E2F2B] active:scale-95 text-[#F28B82] select-none transition-all duration-200 shadow-sm"
            title="Telegram storage is not configured yet. Click to configure in Settings."
          >
            <Settings size={13} className="text-[#F28B82]" />
            <span className="text-xs font-medium">Setup Telegram</span>
          </button>
        ) : telegramConnecting ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#002D4C]/40 border border-[#2AABEE]/40 text-[#8AB4F8] select-none text-xs font-medium"
            title="Connecting to Telegram..."
          >
            <Loader2 size={15} className="animate-spin text-[#2AABEE]" />
            <span>Connecting...</span>
          </div>
        ) : telegramConnected ? (
          <button
            onClick={onRetryTelegram}
            className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#002D4C]/40 border border-[#2AABEE]/40 hover:bg-[#003B63]/50 text-[#8AB4F8] select-none transition-all duration-200"
            title="Telegram storage is connected and active. Click to refresh connection check."
          >
            <TelegramIcon className="w-4 h-4 text-[#2AABEE]" />
            <span className="text-xs font-medium">Telegram</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34A853]" />
          </button>
        ) : (
          <button
            onClick={onRetryTelegram}
            className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3E2723]/60 border border-[#F28B82]/60 hover:bg-[#4E2F2B] active:scale-95 text-[#F28B82] select-none transition-all duration-200"
            title="Telegram connection offline. Click to punch and reconnect!"
          >
            <RefreshCw size={13} className="text-[#F28B82]" />
            <span className="text-xs font-medium">Retry Telegram</span>
          </button>
        )}

        {/* 2. GOOGLE DRIVE / COLAB TOGGLE SWITCH */}
        {(() => {
          const isDriveOn = Boolean(driveMounted && (driveEnabled || driveConnected));
          return (
            <button
              onClick={() => onToggleDrive(!isDriveOn)}
              disabled={driveConnecting}
              title={
                !telegramConfigured
                  ? "Please configure Telegram in Settings first before connecting Google Drive."
                  : isDriveOn
                  ? "Google Drive Bridge Active (Click to disconnect & save resources)"
                  : "Google Drive not mounted (Click to connect & mount)"
              }
              className={`cursor-pointer flex items-center gap-2.5 px-3 py-1.5 rounded-full border transition-all duration-200 select-none ${
                !telegramConfigured
                  ? 'bg-[#282A2C]/60 border-[#3C4043] opacity-75 hover:opacity-100 text-[#9AA0A6]'
                  : isDriveOn
                  ? 'bg-[#0E3A24] border-[#34A853]/60 hover:bg-[#12472C] text-[#81C995]'
                  : 'bg-[#282A2C] border-[#3C4043] hover:bg-[#323438] text-[#9AA0A6] hover:text-[#E8EAED]'
              }`}
            >
              {driveConnecting ? (
                <Loader2 size={15} className="animate-spin text-[#34A853]" />
              ) : (
                <HardDrive size={15} className={isDriveOn ? 'text-[#34A853]' : 'text-[#9AA0A6]'} />
              )}

              <span className="text-xs font-medium whitespace-nowrap">
                {driveConnecting ? 'Connecting Drive...' : 'Google Drive'}
              </span>

              {/* Sliding Switch Pill */}
              <div
                className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors duration-200 ${
                  isDriveOn ? 'bg-[#34A853]' : 'bg-[#444746]'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${
                    isDriveOn ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
          );
        })()}

        {/* 3. Settings, Refresh & Help */}
        <button
          onClick={onRefresh}
          className="cursor-pointer p-2 hover:bg-[#282A2C] rounded-full transition-colors text-[#C4C7C5] hover:text-[#E8EAED]"
          title="Refresh files (Ctrl+R / F5)"
          disabled={isRefreshing}
        >
          <RefreshCw size={20} className={isRefreshing ? "animate-spin text-[#A8C7FA]" : ""} />
        </button>
        <button className="cursor-pointer p-2 hover:bg-[#282A2C] rounded-full transition-colors text-[#C4C7C5] hover:text-[#E8EAED]" title="Help">
          <HelpCircle size={22} />
        </button>
        <button
          onClick={onOpenSettings}
          className="cursor-pointer p-2 hover:bg-[#282A2C] rounded-full transition-colors text-[#C4C7C5] hover:text-[#E8EAED]"
          title="Settings"
        >
          <Settings size={22} />
        </button>

        <div className="w-8 h-8 rounded-full bg-[#004A77] flex items-center justify-center text-[#C2E7FF] ml-1 text-sm font-medium">
          U
        </div>
      </div>
    </header>
  );
}
