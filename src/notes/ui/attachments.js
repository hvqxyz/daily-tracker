import { MAX_ATTACHMENT_BYTES } from '../model.js';

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Shrinks large images so they fit the on-device attachment limit. */
async function shrinkImage(file) {
  const url = await readAsDataUrl(file);
  if (file.size <= MAX_ATTACHMENT_BYTES * 0.6 || !file.type.startsWith('image/') || file.type === 'image/gif') return url;
  const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
  const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const out = canvas.toDataURL('image/jpeg', q);
    if (out.length * 0.75 <= MAX_ATTACHMENT_BYTES) return out;
  }
  return url;
}

/** Returns { ok, data, name, size, type } or { ok:false, error }. */
export async function readAttachment(file, { image = false } = {}) {
  try {
    const data = image ? await shrinkImage(file) : await readAsDataUrl(file);
    const bytes = Math.round(data.length * 0.75);
    if (bytes > MAX_ATTACHMENT_BYTES * 1.05) return { ok: false, error: `"${file.name}" is too large — attachments are stored on this device (max ${MAX_ATTACHMENT_BYTES / 1024} KB).` };
    return { ok: true, data, name: file.name, size: bytes, type: file.type };
  } catch {
    return { ok: false, error: `Could not read "${file.name}".` };
  }
}

export function youtubeEmbedUrl(url) {
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.endsWith('youtu.be')) id = u.pathname.slice(1);
    else if (u.hostname.endsWith('youtube.com')) id = u.searchParams.get('v') || (u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : null);
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export function isHttpUrl(text) {
  try {
    const u = new URL(text.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
