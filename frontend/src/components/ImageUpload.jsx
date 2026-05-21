import { useState } from 'react';
import { api } from '../api';

export default function ImageUpload({ onUploaded, label = 'Chọn ảnh', multiple = false }) {
  const [progress, setProgress] = useState(null); // {current, total} | null
  const [error, setError] = useState('');

  async function uploadOne(file) {
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
    return public_url;
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setError('');
    setProgress({ current: 0, total: files.length });
    const errors = [];
    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      try {
        const url = await uploadOne(files[i]);
        await onUploaded(url, { index: i, total: files.length, fileName: files[i].name });
      } catch (e) {
        errors.push(`${files[i].name}: ${e.message}`);
      }
    }
    setProgress(null);
    if (errors.length > 0) setError(errors.join('\n'));
  }

  const labelText = progress
    ? `Đang xử lý ${progress.current}/${progress.total}…`
    : (multiple ? `${label} (nhiều ảnh)` : label);

  return (
    <div>
      <label className="btn" style={{ margin: 0, cursor: progress ? 'wait' : 'pointer' }}>
        📎 {labelText}
        <input type="file" accept="image/*" hidden multiple={multiple}
          disabled={!!progress}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      </label>
      {error && (
        <div className="error" style={{ marginTop: 6, whiteSpace: 'pre-wrap', fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}
