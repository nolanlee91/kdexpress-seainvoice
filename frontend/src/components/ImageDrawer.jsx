import { useEffect } from 'react';

export default function ImageDrawer({ url, title, onClose }) {
  useEffect(() => {
    if (!url) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [url, onClose]);

  if (!url) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title">{title || 'Ảnh hóa đơn'}</div>
          <div className="row" style={{ gap: 8 }}>
            <a href={url} target="_blank" rel="noreferrer" className="btn" style={{ textDecoration: 'none' }}>
              ↗ Tab mới
            </a>
            <button onClick={onClose}>✕ Đóng</button>
          </div>
        </div>
        <div className="drawer-body">
          <img src={url} alt="" />
        </div>
      </div>
    </>
  );
}
