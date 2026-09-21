import React from 'react';
import { X } from 'lucide-react';

export default function ReplaceModal({
  replaceModal,
  onCancel,
  onConfirm
}) {
  if (!replaceModal?.open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
      <div className="bg-[#282A2C] border border-[#444746] rounded-[28px] p-6 max-w-[440px] w-full mx-4 shadow-2xl relative text-[#E8EAED]">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-normal text-[#E8EAED]">
            {replaceModal.type === 'folder' ? 'Replace existing folder?' : 'Replace existing file?'}
          </h2>
          <button
            onClick={onCancel}
            className="cursor-pointer p-1.5 hover:bg-[#3C4043] rounded-full text-[#C4C7C5] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <p className="mt-4 text-sm text-[#C4C7C5] leading-relaxed">
          {replaceModal.type === 'folder' ? (
            <>
              A folder named <span className="text-[#E8EAED] font-medium">"{replaceModal.name}"</span> already exists in this location. Uploading will replace the existing folder and all its contents.
            </>
          ) : (
            <>
              A file named <span className="text-[#E8EAED] font-medium">"{replaceModal.name}"</span> already exists in this location. Uploading will replace the existing file.
            </>
          )}
        </p>

        {/* Modal Actions */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="cursor-pointer px-4 py-2.5 hover:bg-[#A8C7FA]/10 text-[#A8C7FA] rounded-full text-sm font-medium transition-colors"
          >
            Cancel upload
          </button>
          <button
            onClick={onConfirm}
            className="cursor-pointer px-6 py-2.5 bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#041E49] rounded-full text-sm font-medium transition-colors"
          >
            Replace
          </button>
        </div>
      </div>
    </div>
  );
}
