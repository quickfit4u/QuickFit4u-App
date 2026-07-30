// Shared across every admin page — auth guard, sidebar, and small API helpers.

const NAV_ITEMS = [
  { href: 'dashboard.html', label: 'Dashboard' },
  { href: 'users.html', label: 'Users' },
  { href: 'gyms.html', label: 'Gym Partners' },
  { href: 'bookings.html', label: 'Bookings' },
  { href: 'payouts.html', label: 'Payouts' },
  { href: 'reviews.html', label: 'Reviews' },
  { href: 'notifications.html', label: 'Notifications' },
  { href: 'analytics.html', label: 'Analytics' },
];

const COMING_SOON_ITEMS = ['Payments', 'Complaints', 'Coupons', 'Support Tickets'];

function requireAdminAuth() {
  const token = localStorage.getItem('fitpassindia_admin_token');
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }
  return token;
}

function renderShell(activePage) {
  const token = requireAdminAuth();
  if (!token) return;

  document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">FitPass India <span>Admin</span></div>
        ${NAV_ITEMS.map(
          (item) => `<a href="${item.href}" class="${item.href === activePage ? 'active' : ''}">${item.label}</a>`
        ).join('')}
        <div class="section-label">Coming Soon</div>
        ${COMING_SOON_ITEMS.map(
          (label) => `<a class="disabled" title="Needs its own system built first">${label}<span class="soon-tag">Soon</span></a>`
        ).join('')}
        <a href="#" class="logout-link" id="sidebarLogout" style="margin-top:14px;">Log Out</a>
      </aside>
      <div class="content">
        <div class="topbar">
          <h1id="pageTitle"></h1>
          <span class="admin-name" id="adminName"></span>
        </div>
        <main id="mainContent"></main>
      </div>
    </div>
  `.replace('h1id', 'h1 id')
  );

  document.getElementById('adminName').textContent = localStorage.getItem('fitpassindia_admin_name') || '';
  document.getElementById('sidebarLogout').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('fitpassindia_admin_token');
    localStorage.removeItem('fitpassindia_admin_name');
    window.location.href = 'login.html';
  });

  return token;
}

function setPageTitle(title) {
  document.getElementById('pageTitle').textContent = title;
  document.title = 'FitPass India Admin — ' + title;
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('fitpassindia_admin_token');
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('fitpassindia_admin_token');
    window.location.href = 'login.html';
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatDateTime(str) {
  if (!str) return '—';
  const d = new Date(str.includes('T') ? str : str.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
