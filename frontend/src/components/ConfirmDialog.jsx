import { useEffect, useRef } from 'react';

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} onCancel={onCancel} className="rounded-lg border border-gray-200 p-0 backdrop:bg-black/30">
      <div className="p-6 w-80">
        <h2 className="font-medium text-gray-900 mb-2">{title}</h2>
        {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
