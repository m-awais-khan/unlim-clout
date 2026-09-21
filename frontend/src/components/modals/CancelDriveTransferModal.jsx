import React from 'react';
import { X } from 'lucide-react';

export default function CancelDriveTransferModal({
  show,
  onClose,
  onCancelTransfer
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
      <div className="bg-[#282A2C] border border-[#444746] rounded-[28px] p-6 max-w-[420px] w-full mx-4 shadow-2xl relative text-[#E8EAED]">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-normal text-[#E8EAED]">Cancel transfer?</h2>
          <button
            onClick={onClose}
            className="cursor-pointer p-1.5 hover:bg-[#3C4043] rounded-full text-[#C4C7C5] transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <p className="mt-4 text-sm text-[#C4C7C5] leading-relaxed">
          Your Drive transfer is not complete. Would you like to continue the transfer or cancel it?
        </p>

        {/* Modal Actions */}
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={onClose}
            className="cursor-pointer px-6 py-2.5 bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#041E49] rounded-full text-sm font-medium transition-colors"
          >
            Continue transfer
          </button>
          <button
            onClick={() => {
              onClose();
              onCancelTransfer();
            }}
            className="cursor-pointer px-4 py-2.5 hover:bg-[#A8C7FA]/10 text-[#A8C7FA] rounded-full text-sm font-medium transition-colors"
          >
            Cancel transfer
          </button>
        </div>
      </div>
    </div>
  );
}
