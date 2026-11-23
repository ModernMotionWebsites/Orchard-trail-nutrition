/* Image handling for the dashboard: optimise in the browser, upload to the
   website's own storage, pick from the library, and crop to site formats. */

import { api, toast } from './store.js';
import { modal, icon, esc, formatDate } from './ui.js';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

function loadBitmap(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    image.src = url;
  });
}

export async function compressImage(file, { max = 1800, quality = 0.82 } = {}) {
  const image = await loadBitmap(file);
  const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob) throw new Error('That image could not be prepared.');
  return { blob, width, height };
}

export async function uploadFiles(files, { folder = 'Website', alt = '', onProgress } = {}) {
  const list = [...files].filter(Boolean);
  if (!list.length) return [];
  const form = new FormData();
  const dimensions = [];
  let index = 0;
  for (const file of list) {
    if (!ACCEPTED.includes(file.type)) {
      toast(`"${file.name}" is not a JPEG, PNG or WebP image.`, 'error');
      continue;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast(`"${file.name}" is larger than 15 MB.`, 'error');
      continue;
    }
    onProgress?.(index + 1, list.length, file.name);
    const optimized = await compressImage(file);
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'photo';
    /* PHP reads repeated fields as file[]; the Worker build uses 'file'. */
    form.append('file[]', optimized.blob, `${name}.webp`);
    dimensions.push(`${index}:${optimized.width}x${optimized.height}`);
    index += 1;
  }
  if (!index) return [];
  form.append('folder', folder);
  form.append('alt', alt);
  form.append('dimensions', dimensions.join(';'));
  const result = await api('/api/admin/media', { method: 'POST', body: form });
  return result.media || [];
}

export function dropzone({ folder, onUploaded, hint = 'Drag photos here, or choose files from this device' }) {
  const node = document.createElement('div');
  node.className = 'dropzone';
  node.innerHTML = `
    <span class="dropzone__icon">${icon('upload', 26)}</span>
    <p>${esc(hint)}</p>
    <button class="btn btn--primary" type="button">Choose photos</button>
    <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
    <p class="dropzone__status" aria-live="polite"></p>`;
  const input = node.querySelector('input');
  const status = node.querySelector('.dropzone__status');
  const button = node.querySelector('button');

  async function handle(files) {
    if (!files || !files.length) return;
    status.textContent = 'Preparing photos…';
    try {
      const uploaded = await uploadFiles(files, {
        folder,
        onProgress: (n, total, name) => {
          status.textContent = `Optimising ${n} of ${total} — ${name}`;
        }
      });
      status.textContent = '';
      toast(uploaded.length === 1 ? 'Photo uploaded.' : `${uploaded.length} photos uploaded.`, 'success');
      onUploaded?.(uploaded);
    } catch (error) {
      status.textContent = '';
      toast(error.message || 'The upload failed.', 'error');
    }
  }

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => handle(input.files));
  node.addEventListener('dragover', (event) => {
    event.preventDefault();
    node.classList.add('is-over');
  });
  node.addEventListener('dragleave', () => node.classList.remove('is-over'));
  node.addEventListener('drop', (event) => {
    event.preventDefault();
    node.classList.remove('is-over');
    handle(event.dataTransfer.files);
  });
  return node;
}

export async function loadMedia(query = {}) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.folder) params.set('folder', query.folder);
  return api('/api/admin/media?' + params.toString());
}

export function pickImage({ onChoose, folder = 'Website', title = 'Choose a photo' }) {
  const body = document.createElement('div');
  body.className = 'picker';
  body.innerHTML = `
    <div class="picker__bar">
      <input class="input" type="search" placeholder="Search your photos" data-search>
      <button class="btn btn--primary" type="button" data-upload>${icon('upload', 16)} Upload</button>
    </div>
    <div class="picker__grid" data-grid><p class="muted">Loading photos…</p></div>
    <div class="picker__drop" data-drop hidden></div>`;

  const dialog = modal({ title, body, wide: true });
  const grid = body.querySelector('[data-grid]');
  const search = body.querySelector('[data-search]');
  const dropHost = body.querySelector('[data-drop]');

  async function refresh(q = '') {
    grid.innerHTML = '<p class="muted">Loading photos…</p>';
    try {
      const { media } = await loadMedia({ q });
      if (!media.length) {
        grid.innerHTML =
          '<p class="muted">No photos yet. Upload one and it will appear here — and on the website wherever you choose it.</p>';
        return;
      }
      grid.innerHTML = media
        .map(
          (item) => `<button class="picker__item" type="button" data-url="${esc(item.url)}" data-alt="${esc(item.alt || '')}">
            <img src="${esc(item.url)}" alt="${esc(item.alt || item.filename)}" loading="lazy">
            <span>${esc(item.filename)}</span>
            <small>${formatDate(item.created_at)}</small>
          </button>`
        )
        .join('');
      grid.querySelectorAll('[data-url]').forEach((button) => {
        button.addEventListener('click', () => {
          onChoose({ url: button.getAttribute('data-url'), alt: button.getAttribute('data-alt') });
          dialog.close();
        });
      });
    } catch (error) {
      grid.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
    }
  }

  body.querySelector('[data-upload]').addEventListener('click', () => {
    dropHost.hidden = false;
    dropHost.innerHTML = '';
    dropHost.appendChild(
      dropzone({
        folder,
        onUploaded: (uploaded) => {
          dropHost.hidden = true;
          if (uploaded.length === 1) {
            onChoose({ url: uploaded[0].url, alt: uploaded[0].alt || '' });
            dialog.close();
          } else {
            refresh(search.value);
          }
        }
      })
    );
  });

  search.addEventListener(
    'input',
    (() => {
      let timer = 0;
      return () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => refresh(search.value), 250);
      };
    })()
  );

  refresh();
  return dialog;
}

/* ------------------------------------------------------------- cropping -- */

const CROP_PRESETS = [
  { id: 'free', label: 'Original shape', ratio: 0 },
  { id: 'hero', label: 'Homepage banner', ratio: 3 / 2 },
  { id: 'product', label: 'Drink photo', ratio: 4 / 3 },
  { id: 'square', label: 'Gallery square', ratio: 1 },
  { id: 'cover', label: 'Seasonal cover', ratio: 16 / 9 }
];

export function cropImage({ url, onDone }) {
  const body = document.createElement('div');
  body.className = 'cropper';
  body.innerHTML = `
    <div class="cropper__stage"><canvas width="640" height="420" data-canvas></canvas></div>
    <div class="cropper__controls">
      <div class="cropper__presets" data-presets>${CROP_PRESETS.map(
        (preset) => `<button class="chip" type="button" data-ratio="${preset.ratio}">${preset.label}</button>`
      ).join('')}</div>
      <label class="field field--inline"><span class="field__label">Zoom</span>
        <input type="range" min="1" max="3" step="0.01" value="1" data-zoom></label>
      <p class="field__hint">Drag the photo to position it inside the frame.</p>
    </div>`;

  const dialog = modal({
    title: 'Crop photo',
    body,
    wide: true,
    footer: `<button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
             <button class="btn btn--primary" type="button" data-apply>${icon('check', 16)} Use this crop</button>`
  });

  const canvas = body.querySelector('[data-canvas]');
  const context = canvas.getContext('2d');
  const image = new Image();
  image.crossOrigin = 'anonymous';
  let ratio = 3 / 2;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function frame() {
    const W = canvas.width;
    const H = canvas.height;
    const r = ratio || image.naturalWidth / image.naturalHeight;
    let cropW = W;
    let cropH = W / r;
    if (cropH > H) {
      cropH = H;
      cropW = H * r;
    }
    return { W, H, cropW, cropH, cropX: (W - cropW) / 2, cropY: (H - cropH) / 2, r };
  }

  function draw() {
    const { W, H, cropW, cropH, cropX, cropY } = frame();
    context.clearRect(0, 0, W, H);
    context.fillStyle = '#0f1512';
    context.fillRect(0, 0, W, H);
    const scale = Math.max(cropW / image.naturalWidth, cropH / image.naturalHeight) * zoom;
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const minX = cropX + cropW - drawW;
    const maxX = cropX;
    const minY = cropY + cropH - drawH;
    const maxY = cropY;
    panX = Math.min(maxX, Math.max(minX, panX));
    panY = Math.min(maxY, Math.max(minY, panY));
    const dx = cropX + (cropW - drawW) / 2 + panX;
    const dy = cropY + (cropH - drawH) / 2 + panY;
    context.drawImage(image, dx, dy, drawW, drawH);
    context.save();
    context.fillStyle = 'rgba(8,14,11,0.55)';
    context.fillRect(0, 0, W, cropY);
    context.fillRect(0, cropY + cropH, W, H - cropY - cropH);
    context.fillRect(0, cropY, cropX, cropH);
    context.fillRect(cropX + cropW, cropY, W - cropX - cropW, cropH);
    context.restore();
    context.strokeStyle = 'rgba(245,241,232,0.9)';
    context.lineWidth = 1;
    context.strokeRect(cropX + 0.5, cropY + 0.5, cropW - 1, cropH - 1);
  }

  image.onload = () => {
    panX = 0;
    panY = 0;
    draw();
  };
  image.src = url;

  body.querySelectorAll('[data-ratio]').forEach((button) => {
    button.addEventListener('click', () => {
      body.querySelectorAll('[data-ratio]').forEach((other) => other.classList.remove('is-active'));
      button.classList.add('is-active');
      ratio = Number(button.getAttribute('data-ratio'));
      panX = 0;
      panY = 0;
      draw();
    });
  });
  body.querySelector('[data-ratio]').classList.add('is-active');
  body.querySelector('[data-zoom]').addEventListener('input', (event) => {
    zoom = Number(event.target.value);
    draw();
  });

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const bounds = canvas.getBoundingClientRect();
    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;
    panX += (event.clientX - lastX) * scaleX;
    panY += (event.clientY - lastY) * scaleY;
    lastX = event.clientX;
    lastY = event.clientY;
    draw();
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });

  dialog.root.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
  dialog.root.querySelector('[data-apply]').addEventListener('click', async () => {
    const { cropW, cropH, cropX, cropY } = frame();
    const scale = Math.max(cropW / image.naturalWidth, cropH / image.naturalHeight) * zoom;
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const dx = cropX + (cropW - drawW) / 2 + panX;
    const dy = cropY + (cropH - drawH) / 2 + panY;
    const output = document.createElement('canvas');
    output.width = Math.round(Math.min(1800, cropW / scale));
    output.height = Math.round(Math.min(1800, cropH / scale));
    const outScale = output.width / cropW;
    const ctx = output.getContext('2d');
    ctx.drawImage(
      image,
      (cropX - dx) / scale,
      (cropY - dy) / scale,
      cropW / scale,
      cropH / scale,
      0,
      0,
      output.width,
      output.height
    );
    const blob = await new Promise((resolve) => output.toBlob(resolve, 'image/webp', 0.85));
    dialog.close();
    if (blob) onDone?.(new File([blob], 'cropped.webp', { type: 'image/webp' }));
    void outScale;
  });
}
