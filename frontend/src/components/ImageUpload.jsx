import { useState } from 'react';
import { api } from '../api';

export default function ImageUpload({ onUploaded, label = 'Chọn ảnh' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file) {
    if (!file) return;
    setError(''); setUploading(true);
    try {
      const contentType = file.type || 'application/octet-stream';
      const { upload_url, public_url } = await api.signR2(contentType);
      const r = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`Upload R2 thất bại (${r.status}): ${text.slice(0, 200)}`);
      }
      onUploaded(public_url);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="btn" style={{ margin: 0, cursor: uploading ? 'wait' : 'pointer' }}>
        📎 {uploading ? 'Đang upload…' : label}
        <input type="file" accept="image/*" hidden disabled={uploading}
          onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>
      {error && <div className="error" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}
