import React, { type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  style?: React.CSSProperties;
  closeOnOutsideClick?: boolean;
}

export default function Modal({ isOpen, onClose, children, maxWidth = '500px', style, closeOnOutsideClick = true }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div onClick={() => closeOnOutsideClick && onClose()} className="modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="modal-content" style={{ maxWidth, maxHeight: '80vh', overflowY: 'auto', ...style }}>
        <button onClick={onClose} className="close-btn">&times;</button>
        {children}
      </div>
    </div>
  );
}