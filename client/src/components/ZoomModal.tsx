// client/src/components/ZoomModal.tsx
import React, { useEffect } from 'react';

interface ZoomModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
}

export const ZoomModal: React.FC<ZoomModalProps> = ({ isOpen, imageSrc, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div id="zoomModal" className="modal">
      <div className="modal-backdrop" id="modalBackdrop" onClick={onClose}></div>
      <div className="modal-content">
        <button
          type="button"
          id="modalCloseBtn"
          className="modal-close"
          title="Close (Esc)"
          onClick={onClose}
        >
          &times;
        </button>
        <img id="modalImage" src={imageSrc} alt="Expanded Component View" />
      </div>
    </div>
  );
};
