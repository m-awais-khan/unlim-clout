import React from 'react';
import { X, Trash2 } from 'lucide-react';

export default function DeleteModal({
  isOpen,
  title,
  message,
  itemName,
  itemCount,
  onClose,
  onConfirm
}) {
  if (!isOpen) return null;

  const displayTitle = title || (itemCount && itemCount > 1 ? `Delete ${itemCount} items?` : 'Delete item?');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div
        className="bg-[#282A2C] border border-[#444746] rounded-[28px] p-6 max-w-[440px] w-full mx-4 shadow-2xl relative text-[#E8EAED] select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-[#3E2723] text-[#F28B82]">
              <Trash2 size={18} />
            </div>
            <h2 className="text-xl font-normal text-[#E8EAED]">
              {displayTitle}
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

        {/* Body */}
        <p className="mt-4 text-sm text-[#C4C7C5] leading-relaxed">
          {message ? (
            message
          ) : itemCount && itemCount > 1 ? (
            `Are you sure you want to delete ${itemCount} items? This cannot be undone.`
          ) : itemName ? (
            <>
              Are you sure you want to delete <span className="text-[#E8EAED] font-medium">"{itemName}"</span>? This cannot be undone.
            </>
          ) : (
            'Are you sure you want to delete this item? This cannot be undone.'
          )}
        </p>

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
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="cursor-pointer px-6 py-2.5 bg-[#F28B82] hover:bg-[#EE675C] text-[#601410] rounded-full text-sm font-semibold transition-colors shadow-md"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
