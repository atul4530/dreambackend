/* DreamPics — Trend Photos Admin dashboard.
 * Private dashboard, no framework. Talks only to the same-host REST API:
 *   /api/v1/admin/trends[...]   (requires X-Admin-Key header)
 */
'use strict';

const state = {
  key: null,
  trends: [],
  categories: [],
  categoryFilter: '',
};

const KEY_STORAGE = 'dreampics_admin_key';

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

let toastTimer = null;
function toast(message, type = '') {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

/* ── HTTP helpers ── */

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.key) headers['X-Admin-Key'] = state.key;

  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    /* ignore non-JSON bodies */
  }

  if (!response.ok) {
    const message =
      (data && (data.message || (data.errors && data.errors.join(', ')))) ||
      `Request failed (${response.status})`;
    if (response.status === 401) {
      logout();
    }
    throw new Error(message);
  }

  return data;
}

const getTrends = () => api('/api/v1/admin/trends');
const getCategories = () => api('/api/v1/admin/trends/categories');
const createTrend = (body) => api('/api/v1/admin/trends', { method: 'POST', body });
const updateTrend = (id, body) => api(`/api/v1/admin/trends/${id}`, { method: 'PUT', body });
const deleteTrend = (id) => api(`/api/v1/admin/trends/${id}`, { method: 'DELETE' });
const setTrendStatus = (id, isPublished) =>
  api(`/api/v1/admin/trends/${id}/status`, { method: 'PATCH', body: { isPublished } });
const reorderTrends = (ids) => api('/api/v1/admin/trends/reorder', { method: 'PATCH', body: { ids } });
const addCategory = (name) => api('/api/v1/admin/trends/categories', { method: 'POST', body: { name } });
const deleteCategory = (name) =>
  api(`/api/v1/admin/trends/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });

/* ── Auth ── */

function logout() {
  state.key = null;
  localStorage.removeItem(KEY_STORAGE);
  hide('dashboard-screen');
  show('login-screen');
  $('admin-key').value = '';
}

async function unlock(key) {
  state.key = key;
  try {
    const res = await getTrends();
    void res;
    if ($('remember-key').checked) localStorage.setItem(KEY_STORAGE, key);
    $('login-error').classList.add('hidden');
    show('dashboard-screen');
    hide('login-screen');
    await loadDashboard();
  } catch (error) {
    state.key = null;
    $('login-error').textContent = error.message;
    $('login-error').classList.remove('hidden');
  }
}

/* ── Dashboard loading ── */

async function loadDashboard() {
  try {
    const [trendsRes, categoriesRes] = await Promise.all([getTrends(), getCategories()]);
    state.trends = trendsRes.data || [];
    state.categories = categoriesRes.data || [];

    const sorted = [...state.trends].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    if (state.categoryFilter && !state.categories.some((c) => c.name === state.categoryFilter)) {
      state.categoryFilter = '';
    }

    $('trend-count').textContent = `${sorted.length} trend${sorted.length === 1 ? '' : 's'}`;
    renderCategoryChips();
    renderTrendList();
    renderCategoryOptions();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function getFilteredTrends() {
  const sorted = [...state.trends].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  if (!state.categoryFilter) return sorted;
  return sorted.filter((t) => t.category === state.categoryFilter);
}

function renderCategoryChips() {
  const container = $('category-chips');
  container.innerHTML = '';

  const allChip = document.createElement('button');
  allChip.className = `chip${state.categoryFilter === '' ? ' active' : ''}`;
  allChip.textContent = `All (${state.trends.length})`;
  allChip.onclick = () => {
    state.categoryFilter = '';
    renderCategoryChips();
    renderTrendList();
  };
  container.appendChild(allChip);

  for (const cat of state.categories) {
    const count = state.trends.filter((t) => t.category === cat.name).length;
    const chip = document.createElement('button');
    chip.className = `chip${state.categoryFilter === cat.name ? ' active' : ''}`;
    chip.textContent = `${cat.name} (${count})`;
    chip.onclick = () => {
      state.categoryFilter = cat.name;
      renderCategoryChips();
      renderTrendList();
    };
    container.appendChild(chip);
  }
}

function renderTrendList() {
  const list = $('trend-list');
  const trends = getFilteredTrends();
  list.innerHTML = '';

  if (trends.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = state.categoryFilter
      ? 'No trends in this category.'
      : 'No trends yet. Click "+ New trend" to create one.';
    list.appendChild(empty);
    return;
  }

  for (const [index, trend] of trends.entries()) {
    list.appendChild(renderTrendCard(trend, index, trends.length));
  }
}

function renderTrendCard(trend, index, total) {
  const card = document.createElement('article');
  card.className = 'trend-card';

  const thumb = document.createElement('div');
  thumb.className = 'trend-thumb';
  if (trend.thumbnailUrl) {
    const img = document.createElement('img');
    img.src = trend.thumbnailUrl;
    img.alt = trend.title;
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    const noImg = document.createElement('div');
    noImg.className = 'no-img';
    noImg.textContent = 'No image';
    thumb.appendChild(noImg);
  }
  const badge = document.createElement('span');
  badge.className = `trend-badge${trend.isPublished ? ' published' : ''}`;
  badge.textContent = trend.isPublished ? 'Published' : 'Draft';
  thumb.appendChild(badge);
  card.appendChild(thumb);

  const body = document.createElement('div');
  body.className = 'trend-body';

  const title = document.createElement('div');
  title.className = 'trend-title';
  title.textContent = trend.title;
  body.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'trend-meta';
  const tag = (text) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = text;
    return span;
  };
  meta.appendChild(tag(trend.category));
  meta.appendChild(tag(trend.aspectRatio || '1:1'));
  if (trend.requiresPhoto) meta.appendChild(tag('Photo required'));
  if (trend.allowCustomPrompt) meta.appendChild(tag('Custom prompt'));
  body.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'trend-actions';

  const publishBtn = document.createElement('button');
  publishBtn.className = 'btn btn-sm';
  publishBtn.textContent = trend.isPublished ? 'Unpublish' : 'Publish';
  publishBtn.onclick = () => togglePublish(trend);
  actions.appendChild(publishBtn);

  const moveUp = document.createElement('button');
  moveUp.className = 'btn btn-sm btn-icon';
  moveUp.textContent = '↑';
  moveUp.title = 'Move up';
  moveUp.disabled = index === 0;
  moveUp.onclick = () => moveTrend(trend, -1);
  actions.appendChild(moveUp);

  const moveDown = document.createElement('button');
  moveDown.className = 'btn btn-sm btn-icon';
  moveDown.textContent = '↓';
  moveDown.title = 'Move down';
  moveDown.disabled = index === total - 1;
  moveDown.onclick = () => moveTrend(trend, 1);
  actions.appendChild(moveDown);

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-sm';
  editBtn.textContent = 'Edit';
  editBtn.onclick = () => openTrendForm(trend);
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-sm';
  deleteBtn.textContent = 'Delete';
  deleteBtn.onclick = () => confirmDelete(trend);
  actions.appendChild(deleteBtn);

  body.appendChild(actions);
  card.appendChild(body);
  return card;
}

/* ── Trend actions ── */

async function togglePublish(trend) {
  try {
    const updated = await setTrendStatus(trend.id, !trend.isPublished);
    const idx = state.trends.findIndex((t) => t.id === trend.id);
    if (idx !== -1) state.trends[idx] = updated.data;
    renderTrendList();
    toast(updated.data.isPublished ? 'Trend published' : 'Trend unpublished', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function moveTrend(trend, direction) {
  try {
    const ordered = getFilteredTrends();
    const index = ordered.findIndex((t) => t.id === trend.id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ordered.length) return;

    const ids = ordered.map((t) => t.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];

    await reorderTrends(ids);
    await loadDashboard();
    toast('Order updated', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function confirmDelete(trend) {
  if (!window.confirm(`Delete "${trend.title}"? This cannot be undone.`)) return;
  try {
    await deleteTrend(trend.id);
    state.trends = state.trends.filter((t) => t.id !== trend.id);
    renderCategoryChips();
    renderTrendList();
    toast('Trend deleted', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ── Trend form ── */

function openTrendForm(trend = null) {
  $('trend-form').reset();
  $('trend-form-error').classList.add('hidden');
  $('thumbnail-img').src = '';
  $('thumbnail-img').classList.add('hidden');

  $('trend-modal-title').textContent = trend ? 'Edit trend' : 'New trend';
  $('f-id').value = trend ? trend.id : '';
  $('f-title').value = trend ? trend.title : '';
  $('f-category').value = trend ? trend.category : '';
  $('f-description').value = trend ? trend.description || '' : '';
  $('f-prompt').value = trend ? trend.prompt : '';
  $('f-negative').value = trend ? trend.negativePrompt || '' : '';
  $('f-aspect').value = trend ? trend.aspectRatio || '1:1' : '1:1';
  $('f-requiresPhoto').checked = trend ? trend.requiresPhoto !== false : true;
  $('f-allowCustomPrompt').checked = trend ? trend.allowCustomPrompt === true : false;
  $('f-thumbnailUrl').value = '';
  $('f-thumbnailUrl').placeholder = trend && trend.thumbnailUrl ? trend.thumbnailUrl : 'https://…';
  $('f-file').value = '';
  renderCategoryOptions();

  if (trend && trend.thumbnailUrl) {
    $('thumbnail-img').src = trend.thumbnailUrl;
    $('thumbnail-img').classList.remove('hidden');
  }

  show('trend-modal');
}

function closeTrendForm() {
  hide('trend-modal');
}

async function saveTrend({ publish }) {
  const errorEl = $('trend-form-error');
  errorEl.classList.add('hidden');

  const fileInput = $('f-file');
  let thumbnailBase64 = null;
  const file = fileInput.files && fileInput.files[0];

  if (file) {
    if (file.size > 8 * 1024 * 1024) {
      errorEl.textContent = 'Image must be 8MB or smaller.';
      errorEl.classList.remove('hidden');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      errorEl.textContent = 'Only JPEG, PNG or WebP images are allowed.';
      errorEl.classList.remove('hidden');
      return;
    }
    try {
      thumbnailBase64 = await readAsDataURL(file);
    } catch (_) {
      errorEl.textContent = 'Could not read the selected image.';
      errorEl.classList.remove('hidden');
      return;
    }
  }

  const body = {
    title: $('f-title').value.trim(),
    description: $('f-description').value.trim(),
    category: $('f-category').value.trim(),
    prompt: $('f-prompt').value.trim(),
    negativePrompt: $('f-negative').value.trim(),
    aspectRatio: $('f-aspect').value,
    requiresPhoto: $('f-requiresPhoto').checked,
    allowCustomPrompt: $('f-allowCustomPrompt').checked,
    isPublished: publish,
  };

  if (thumbnailBase64) {
    body.thumbnailBase64 = thumbnailBase64;
  } else if ($('f-thumbnailUrl').value.trim()) {
    body.thumbnailUrl = $('f-thumbnailUrl').value.trim();
  }

  const id = $('f-id').value;

  try {
    if (id) {
      await updateTrend(id, body);
      toast('Trend updated', 'success');
    } else {
      await createTrend(body);
      toast('Trend created', 'success');
    }
    closeTrendForm();
    await loadDashboard();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  }
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* ── Categories ── */

function renderCategoryOptions() {
  const datalist = $('category-options');
  datalist.innerHTML = '';
  for (const cat of state.categories) {
    const option = document.createElement('option');
    option.value = cat.name;
    datalist.appendChild(option);
  }
}

async function openCategories() {
  $('category-error').classList.add('hidden');
  $('new-category-name').value = '';
  await refreshCategoryModal();
  show('category-modal');
}

async function refreshCategoryModal() {
  const list = $('category-list');
  list.innerHTML = '';
  for (const cat of state.categories) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = cat.name;
    const remove = document.createElement('button');
    remove.className = 'btn btn-sm';
    remove.textContent = 'Remove';
    remove.onclick = () => removeCategory(cat);
    li.appendChild(name);
    li.appendChild(remove);
    list.appendChild(li);
  }
}

async function removeCategory(cat) {
  if (!window.confirm(`Remove category "${cat.name}"? Trends keep their category label.`)) return;
  try {
    await deleteCategory(cat.name);
    state.categories = state.categories.filter((c) => c.name !== cat.name);
    await refreshCategoryModal();
    renderCategoryChips();
    renderCategoryOptions();
    if (state.categoryFilter === cat.name) {
      state.categoryFilter = '';
      renderTrendList();
    }
    toast('Category removed', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ── Modal helpers ── */

function bindModals() {
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => hide(btn.dataset.close));
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.add('hidden');
    });
  });
}

/* ── Boot ── */

function boot() {
  bindModals();

  $('login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    unlock($('admin-key').value.trim());
  });

  $('dashboard-screen').addEventListener('click', () => {});
  $('logout-btn').addEventListener('click', logout);
  $('new-trend-btn').addEventListener('click', () => openTrendForm());
  $('manage-categories-btn').addEventListener('click', openCategories);

  $('trend-form').addEventListener('submit', (event) => {
    event.preventDefault();
    saveTrend({ publish: true });
  });

  $('save-draft-btn').addEventListener('click', () => saveTrend({ publish: false }));

  $('f-file').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast('Image must be 8MB or smaller.', 'error');
      return;
    }
    readAsDataURL(file)
      .then((dataUrl) => {
        const img = $('thumbnail-img');
        img.src = dataUrl;
        img.classList.remove('hidden');
      })
      .catch(() => toast('Could not preview image.', 'error'));
  });

  $('category-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('new-category-name').value.trim();
    if (!name) return;
    try {
      await addCategory(name);
      $('new-category-name').value = '';
      state.categories = await (await getCategories()).data;
      await refreshCategoryModal();
      renderCategoryChips();
      renderCategoryOptions();
      toast('Category added', 'success');
    } catch (error) {
      $('category-error').textContent = error.message;
      $('category-error').classList.remove('hidden');
    }
  });

  const savedKey = localStorage.getItem(KEY_STORAGE);
  if (savedKey) {
    $('admin-key').value = savedKey;
    unlock(savedKey);
  }
}

document.addEventListener('DOMContentLoaded', boot);