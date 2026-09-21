import React from 'react';

export default function NewFolderModal({
  show,
  onClose,
  newFolderName,
  setNewFolderName,
  onSubmit,
  inputRef
}) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="bg-[#131314] border border-[#444746] rounded-[28px] p-6 w-[360px] max-w-[90vw] shadow-2xl relative text-[#E8EAED] select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[24px] font-normal text-[#E3E3E3] mb-5 tracking-normal">
          New folder
        </h2>

        <form onSubmit={onSubmit}>
          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
              }}
              className="w-full bg-transparent text-[#E3E3E3] text-[16px] px-4 py-3 rounded-[4px] border-2 border-[#A8C7FA] outline-none transition-colors selection:bg-[#004A77] selection:text-[#C2E7FF]"
              placeholder="Folder name"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-4 py-2 hover:bg-[#A8C7FA]/10 text-[#A8C7FA] rounded-full text-[14px] font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newFolderName.trim()}
              className="cursor-pointer px-4 py-2 hover:bg-[#A8C7FA]/10 text-[#A8C7FA] disabled:opacity-40 disabled:hover:bg-transparent rounded-full text-[14px] font-medium transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
