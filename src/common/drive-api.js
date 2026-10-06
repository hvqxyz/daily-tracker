import { getAccessToken } from './auth.js';

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function driveFetch(pathAndQuery, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_BASE}${pathAndQuery}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Drive error (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * Finds a non-trashed folder by name, creating it if it doesn't exist.
 * Returns the folder's file ID.
 */
export async function findOrCreateFolder(name) {
  const query = encodeURIComponent(`mimeType='${FOLDER_MIME}' and name='${name}' and trashed=false`);
  const found = await driveFetch(`?q=${query}&fields=files(id,name)`);
  if (found.files && found.files.length > 0) {
    return found.files[0].id;
  }

  const created = await driveFetch('', {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
  });
  return created.id;
}

/**
 * Finds a non-trashed file by name and mime type inside the given folder.
 * Returns its file ID, or null if no such file exists yet.
 */
export async function findFileInFolder(folderId, name, mimeType) {
  const query = encodeURIComponent(
    `name='${name}' and '${folderId}' in parents and mimeType='${mimeType}' and trashed=false`
  );
  const found = await driveFetch(`?q=${query}&fields=files(id,name)`);
  return found.files && found.files.length > 0 ? found.files[0].id : null;
}

/**
 * Moves a freshly-created file (whose only parent is Drive root) into the
 * given folder.
 */
export async function moveFileToFolder(fileId, folderId) {
  await driveFetch(`/${fileId}?addParents=${folderId}&removeParents=root&fields=id,parents`, {
    method: 'PATCH',
    body: '{}',
  });
}
