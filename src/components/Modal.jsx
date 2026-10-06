import { useEffect, useRef } from 'react';
import './Modal.css';

/**
 * Generic <dialog>-based modal/bottom-sheet. Uses native showModal()/close()
 * so Escape and ::backdrop work for free; also closes on a backdrop click.
 */
export function Modal({ open, onClose, className = '', children, ...rest }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className={`app-modal ${className}`.trim()}
      ref={dialogRef}
      onCancel={onClose}
      // Backdrop dismissal reacts to pointerdown, not click: on a bottom sheet
      // (which can cover most of the screen) the tap that opens this modal
      // still has a trailing native "click" event to fire, and by then it
      // lands on the dialog itself — treated as click-to-close, it would
      // shut the modal the same gesture just opened. A fresh pointerdown
      // only happens for an actual later, deliberate tap outside.
      onPointerDown={(e) => { if (e.target === dialogRef.current) onClose(); }}
      {...rest}
    >
      {children}
    </dialog>
  );
}
