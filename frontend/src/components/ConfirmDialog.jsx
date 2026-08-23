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
    <dialog ref={ref} onCancel={onCancel} className="modal">
      <div className="modal-box">
        <h2 className="font-semibold text-base-content mb-2">{title}</h2>
        {message && <p className="text-sm text-base-content/70 mb-4">{message}</p>}
        <div className="modal-action">
          <button onClick={onCancel} className="btn btn-ghost">Cancel</button>
          <button onClick={onConfirm} className="btn btn-primary">{confirmLabel}</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onCancel}>close</button>
      </form>
    </dialog>
  );
}
