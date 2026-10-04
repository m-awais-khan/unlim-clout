import React, { useState, useEffect, useRef } from 'react';
import { X, Edit2 } from 'lucide-react';

export default function RenameModal({
  isOpen,
  initialName = '',
  itemType = 'item', // 'file' | 'folder' | 'item'
  onClose,
  onConfirm
}) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const val = initialName || '';
          // If it's a file, select only the base name (excluding extension)
          if (itemType === 'file' && val.includes('.')) {
            const lastDotIndex = val.lastIndexOf('.');
            if (lastDotIndex > 0) {
              inputRef.current.setSelectionRange(0, lastDotIndex);
              return;
            }
          }
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, initialName, itemType]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) {
      onClose();
      return;
    }
    onConfirm(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div
        className="bg-[#282A2C] border border-[#444746] rounded-[28px] p-6 max-w-[440px] w-full mx-4 shadow-2xl relative text-[#E8EAED] select-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-[#004A77] text-[#C2E7FF]">
              <Edit2 size={18} />
            </div>
            <h2 className="text-xl font-normal text-[#E8EAED]">
              Rename {itemType === 'folder' ? 'folder' : 'file'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer p-1.5 hover:bg-[#3C4043] rounded-full text-[#C4C7C5] transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#C4C7C5] font-medium">
              Enter new {itemType === 'folder' ? 'folder name' : 'filename'}:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  onClose();
                }
              }}
              className="bg-[#1e1f20] border border-[#747775] focus:border-[#A8C7FA] text-[#E8EAED] px-4 py-2.5 rounded-xl text-sm outline-none transition-colors w-full shadow-inner"
              placeholder={`Enter ${itemType} name`}
            />
          </div>

          {/* Actions */}
          <div className="mt-7 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-4 py-2.5 hover:bg-[#A8C7FA]/10 text-[#A8C7FA] rounded-full text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || name.trim() === initialName}
              className="cursor-pointer px-6 py-2.5 bg-[#A8C7FA] hover:bg-[#8AB4F8] disabled:opacity-40 disabled:hover:bg-[#A8C7FA] text-[#041E49] rounded-full text-sm font-semibold transition-colors shadow-md"
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
