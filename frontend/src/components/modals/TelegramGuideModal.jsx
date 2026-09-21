import React, { useState } from 'react';
import { X, Bot, Shield, Send, Sparkles, Copy, Check, MessageSquare, Plus, ExternalLink, Globe } from 'lucide-react';

export default function TelegramGuideModal({ show, onClose }) {
  const [copiedText, setCopiedText] = useState(null);

  if (!show) return null;

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const steps = [
    {
      num: 1,
      title: "Create Your Telegram Bot",
      desc: "Open Telegram and search for the official @BotFather bot.",
      actionText: "Send /newbot to @BotFather and choose a name and username (e.g. my_storage_bot).",
      cmd: "/newbot",
      tip: "Copy the HTTP API Token provided (format: 123456789:ABCDefG...)."
    },
    {
      num: 2,
      title: "Create a Channel or Group",
      desc: "Create a new private Channel (or Group) in Telegram for storing your files.",
      actionText: "Tap Menu → New Channel → Name it (e.g. 'My Cloud Storage') → Set to Private.",
      tip: "You can also use an existing channel or even chat directly with your bot."
    },
    {
      num: 3,
      title: "Add Bot as Administrator",
      desc: "Give your bot permission to upload and store files in the channel.",
      actionText: "Open Channel Settings → Administrators → Add Administrator → Search for your bot username.",
      tip: "Enable 'Post Messages' permission so the bot can upload multi-part file chunks."
    },
    {
      num: 4,
      title: "Send a Test Message",
      desc: "Send at least one message in the channel so Telegram records the interaction.",
      actionText: "Type 'hello' or any text message into the channel.",
      tip: "If using direct chat with the bot, click /start in the bot chat instead."
    },
    {
      num: 5,
      title: "Paste Token & Click 'Auto-Detect'",
      desc: "Return to Settings, paste your Bot Token, and click the 'Auto-Detect' button.",
      actionText: "Post a message in your channel; the system will listen live and capture your channel ID (-100...).",
      tip: "If listening times out or your channel is not detected after multiple attempts, try turning ON a VPN (Telegram's API is throttled or restricted by some ISPs) or enter your Chat ID manually."
    }
  ];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm select-none p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1f20] border border-[#444746] rounded-[24px] p-6 w-[620px] max-w-[94vw] max-h-[90vh] shadow-2xl relative text-[#E8EAED] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#333538] mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#004A77] text-[#2AABEE]">
              <Bot size={22} />
            </div>
            <div>
              <h2 className="text-[18px] font-medium text-[#E3E3E3]">Telegram Storage Setup Guide</h2>
              <p className="text-[12px] text-[#A8C7FA]">5 easy steps to connect your free, unlimited cloud storage</p>
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
        <div className="overflow-y-auto overflow-x-hidden pr-1 flex flex-col gap-3.5 my-1 custom-scrollbar text-[13px]">
          {steps.map((s) => (
            <div
              key={s.num}
              className="bg-[#282a2c] border border-[#3c4043] rounded-2xl p-4 flex gap-3.5 transition-all hover:border-[#52565a]"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#004A77] text-[#C2E7FF] font-semibold text-xs flex items-center justify-center mt-0.5 shadow-sm">
                {s.num}
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-[#E3E3E3] text-[14px]">{s.title}</h3>
                  {s.cmd && (
                    <button
                      onClick={() => copyToClipboard(s.cmd, 'cmd')}
                      className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1e1f20] hover:bg-[#333538] text-[#A8C7FA] rounded-md text-[11px] font-mono border border-[#444746] transition-colors"
                      title="Copy command"
                    >
                      {copiedText === 'cmd' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span>{s.cmd}</span>
                    </button>
                  )}
                </div>
                <p className="text-[#9AA0A6] text-[12px] leading-relaxed">{s.desc}</p>
                <div className="bg-[#1e1f20]/90 border border-[#333538] rounded-xl p-2.5 text-[12px] text-[#C4C7C5] flex flex-col gap-1">
                  <div className="font-medium text-[#E3E3E3] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2AABEE]" />
                    {s.actionText}
                  </div>
                  {s.tip && (
                    <div className="text-[11px] text-[#A8C7FA] mt-0.5">
                      💡 <span className="text-[#8AB4F8]">{s.tip}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* VPN Troubleshooting Tip */}
          <div className="bg-[#002D4C]/40 border border-[#7CBBFF]/30 rounded-2xl p-3.5 flex items-start gap-3 text-[12px] text-[#C2E7FF] mt-1">
            <Globe size={18} className="text-[#7CBBFF] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#7CBBFF] block text-[13px] mb-0.5">
                Troubleshooting Tip: Try with a VPN
              </span>
              <span className="text-[#E3E3E3] leading-relaxed">
                If auto-detect listening times out or no channel ID is detected across multiple attempts, try connecting to a <strong>VPN</strong> (e.g., any European or US server). Many regional internet service providers temporarily block or throttle Telegram Bot API polling.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#333538] mt-4">
          <span className="text-[11px] text-[#9AA0A6]">
            ✨ Encrypted & stored privately inside your own Telegram account.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-5 py-2 bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#003354] rounded-full text-[13px] font-medium transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
