/* ============================================
   UPLOAD.JS — Drag & drop + file input handler
   ============================================ */
import { parseFile }   from './csvParser.js';
import { Notification } from './notifications.js';

/**
 * initUpload({ onFile(result), onError(err) })
 * Wires up the upload zone, file input, and drag events.
 */
export function initUpload({ onFile, onError }) {
  const zone  = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');

  if (!zone || !input) return;

  /* ---- File input change ---- */
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file, onFile, onError);
    input.value = ''; // reset so same file can be re-selected
  });

  /* ---- Drag over ---- */
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
  });

  /* ---- Drop ---- */
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) await handleFile(file, onFile, onError);
  });

  /* ---- Click on zone (but not on buttons) ---- */
  zone.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (e.target === input) return;
    e.stopPropagation();
    input.click();
  });
}

async function handleFile(file, onFile, onError) {
  const MAX_MB = 25;

  if (file.size > MAX_MB * 1024 * 1024) {
    const msg = `File exceeds the ${MAX_MB} MB limit (${(file.size / 1_000_000).toFixed(1)} MB).`;
    Notification.show({
      type: 'error',
      title: 'File too large',
      description: file.name,
      subtitle: msg,
      autoDismiss: 6000,
    });
    onError?.(new Error(msg));
    return;
  }

  /* ---- Loading state ---- */
  Notification.show({
    type: 'loading',
    title: 'Parsing dataset',
    description: file.name,
    subtitle: 'Reading file…',
  });

  try {
    const result = await parseFile(file);

    if (!result.data.length) {
      throw new Error('File is empty or could not be parsed.');
    }

    const rows = result.data.length.toLocaleString();
    const cols = Object.keys(result.data[0] ?? {}).length;

    /* ---- Success state (updates in place, auto-dismisses) ---- */
    Notification.update({
      type: 'success',
      title: 'Dataset loaded',
      description: `${rows} rows • ${cols} columns`,
      subtitle: 'Ready for analysis',
      autoDismiss: 3500,
    });

    onFile(result);

  } catch (err) {
    /* ---- Error state ---- */
    Notification.update({
      type: 'error',
      title: 'Upload failed',
      description: file.name,
      subtitle: err.message,
      autoDismiss: 6000,
    });
    onError?.(err);
  }
}
