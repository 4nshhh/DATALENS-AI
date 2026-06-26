/* ============================================
   NOTIFICATIONS.JS — DataLens AI Notification Card System
   ============================================ */

/**
 * Icon SVG strings keyed by type.
 * Uses inline SVG so we stay dependency-free (no Lucide runtime needed here).
 */
const ICONS = {
  loading: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>`,

  success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`,

  error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>`,

  warning: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`,

  info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>`,
};

const DISMISS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="6" x2="6" y2="18"/>
  <line x1="6" y1="6" x2="18" y2="18"/>
</svg>`;

/* ---- Internal state ---- */
let _card       = null;   // the live DOM element
let _autoDismissTimer = null;

/**
 * Ensure the notification root element exists.
 */
function getRoot() {
  let root = document.getElementById('notificationRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'notificationRoot';
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Build the card DOM from scratch.
 * @param {{ type, title, description, subtitle, autoDismiss }} opts
 */
function buildCard({ type = 'info', title = '', description = '', subtitle = '', autoDismiss = 0 }) {
  const card = document.createElement('div');
  card.className = 'notif-card';
  card.setAttribute('data-type', type);
  card.setAttribute('role', 'status');

  const isLoading = type === 'loading';

  card.innerHTML = `
    <div class="notif-top">
      <div class="notif-icon-badge ${isLoading ? 'is-spinning' : ''}" aria-hidden="true">
        ${ICONS[type] || ICONS.info}
      </div>
      <button class="notif-dismiss" aria-label="Dismiss notification">
        ${DISMISS_ICON}
      </button>
    </div>

    <div class="notif-body">
      <div class="notif-title">${escHtml(title)}</div>
      ${description ? `<div class="notif-description">${escHtml(description)}</div>` : ''}
      ${subtitle    ? `<div class="notif-subtitle">${escHtml(subtitle)}</div>`    : ''}
    </div>

    ${isLoading ? `<div class="notif-progress"><div class="notif-progress-bar"></div></div>` : ''}
  `;

  card.querySelector('.notif-dismiss').addEventListener('click', () => Notification.dismiss());

  if (autoDismiss > 0) {
    scheduleAutoDismiss(autoDismiss);
  }

  return card;
}

/**
 * Update content of existing card without destroying + recreating it.
 * Runs a brief fade-out → swap → fade-in on the body.
 */
function patchCard(card, { type, title, description, subtitle, autoDismiss = 0 }) {
  // Clear existing auto-dismiss
  clearAutoDismiss();

  const isLoading = type === 'loading';

  // Update data-type (drives CSS tokens)
  if (type) card.setAttribute('data-type', type);

  // Patch icon badge
  const badge = card.querySelector('.notif-icon-badge');
  if (badge && type && ICONS[type]) {
    badge.innerHTML = ICONS[type];
    badge.classList.toggle('is-spinning', isLoading);
  }

  // Fade-out body → swap content → fade-in
  const body = card.querySelector('.notif-body');
  body.classList.add('is-updating');

  setTimeout(() => {
    if (title)       body.querySelector('.notif-title').textContent       = title;

    const descEl = body.querySelector('.notif-description');
    if (description !== undefined) {
      if (descEl) {
        descEl.textContent = description;
      } else if (description) {
        const el = document.createElement('div');
        el.className = 'notif-description';
        el.textContent = description;
        body.querySelector('.notif-title').after(el);
      }
    }

    const subEl = body.querySelector('.notif-subtitle');
    if (subtitle !== undefined) {
      if (subEl) {
        subEl.textContent = subtitle;
      } else if (subtitle) {
        const el = document.createElement('div');
        el.className = 'notif-subtitle';
        el.textContent = subtitle;
        body.appendChild(el);
      }
    }

    body.classList.remove('is-updating');
  }, 200);

  // Swap / remove progress bar
  const existingProgress = card.querySelector('.notif-progress');
  if (isLoading && !existingProgress) {
    const bar = document.createElement('div');
    bar.className = 'notif-progress';
    bar.innerHTML = '<div class="notif-progress-bar"></div>';
    card.appendChild(bar);
  } else if (!isLoading && existingProgress) {
    existingProgress.remove();
  }

  if (autoDismiss > 0) scheduleAutoDismiss(autoDismiss);
}

function scheduleAutoDismiss(ms) {
  clearAutoDismiss();
  _autoDismissTimer = setTimeout(() => Notification.dismiss(), ms);
}

function clearAutoDismiss() {
  if (_autoDismissTimer) {
    clearTimeout(_autoDismissTimer);
    _autoDismissTimer = null;
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================
   PUBLIC API
   ============================================ */

/**
 * @typedef  NotifOptions
 * @property {'loading'|'success'|'error'|'warning'|'info'} type
 * @property {string} title        - Bold monospace heading
 * @property {string} [description] - Secondary line (filename, row count, etc.)
 * @property {string} [subtitle]    - Muted third line
 * @property {number} [autoDismiss] - Auto-dismiss after N ms (0 = never)
 */

export const Notification = {
  /**
   * Show a new notification, or replace the existing one.
   * @param {NotifOptions} opts
   */
  show(opts = {}) {
    clearAutoDismiss();
    const root = getRoot();

    if (_card) {
      // If a card is already open, update it in place
      patchCard(_card, opts);
      return;
    }

    _card = buildCard(opts);
    root.appendChild(_card);
  },

  /**
   * Update the content of the active notification.
   * If no notification is visible, this creates one.
   * @param {NotifOptions} opts
   */
  update(opts = {}) {
    if (!_card) {
      this.show(opts);
      return;
    }
    patchCard(_card, opts);
  },

  /**
   * Dismiss (animate-out and remove) the active notification.
   */
  dismiss() {
    if (!_card) return;
    clearAutoDismiss();

    const card = _card;
    _card = null;

    card.classList.add('is-exiting');
    card.addEventListener('animationend', () => card.remove(), { once: true });

    // Fallback removal in case animationend doesn't fire
    setTimeout(() => card.remove(), 400);
  },
};

// Also attach to window for non-module scripts
window.Notification = Notification;
