/* ========================================================
   TechShop — Core Application
   SPA Router, API Service, Auth State, Utilities
   ======================================================== */

// ─── API Service ──────────────────────────────────────────
const api = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options
    };

    // Add auth token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          auth.logout(false);
          toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
          router.navigate('/login');
        }
        throw new Error(data.error || 'Có lỗi xảy ra');
      }

      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Không thể kết nối đến server');
      }
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint);
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

// ─── Auth State ───────────────────────────────────────────
const auth = {
  get user() {
    const data = localStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  },

  get isLoggedIn() {
    return !!localStorage.getItem('token');
  },

  get isAdmin() {
    return this.user?.role === 'Admin';
  },

  setAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    this.updateUI();
  },

  logout(showToast = true) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.updateUI();
    if (showToast) {
      toast.info('Đã đăng xuất');
      router.navigate('/');
    }
  },

  updateUI() {
    const isLogged = this.isLoggedIn;
    const isAdmin = this.isAdmin;

    document.querySelectorAll('.auth-only').forEach(el => {
      el.style.display = isLogged ? '' : 'none';
    });
    document.querySelectorAll('.guest-only').forEach(el => {
      el.style.display = isLogged ? 'none' : '';
    });
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });

    const nameEl = document.getElementById('navUserName');
    if (nameEl && this.user) {
      nameEl.textContent = this.user.fullName;
    }

    // Update cart badge
    if (isLogged) {
      this.updateCartBadge();
    } else {
      const badge = document.getElementById('cartBadge');
      if (badge) badge.style.display = 'none';
    }
  },

  async updateCartBadge() {
    try {
      if (!this.isLoggedIn) return;
      const data = await api.get('/cart');
      const badge = document.getElementById('cartBadge');
      if (badge) {
        if (data.itemCount > 0) {
          badge.textContent = data.itemCount;
          badge.style.display = '';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch {
      // Silently fail
    }
  }
};

// ─── Toast Notifications ──────────────────────────────────
const toast = {
  show(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100px)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); },
  warning(msg) { this.show(msg, 'warning'); }
};

// ─── SPA Router ───────────────────────────────────────────
const router = {
  routes: {},

  register(path, handler) {
    this.routes[path] = handler;
  },

  navigate(path) {
    window.location.hash = path;
  },

  async handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    const params = new URLSearchParams(queryString || '');

    // Parse route params (e.g., /products/123)
    let handler = this.routes[path];
    let routeParams = {};

    if (!handler) {
      // Try matching parameterized routes
      for (const [pattern, h] of Object.entries(this.routes)) {
        const regex = new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$');
        const match = path.match(regex);
        if (match) {
          handler = h;
          const paramNames = pattern.match(/:(\w+)/g)?.map(p => p.slice(1)) || [];
          paramNames.forEach((name, i) => {
            routeParams[name] = match[i + 1];
          });
          break;
        }
      }
    }

    if (!handler) {
      handler = this.routes['/404'] || (() => {
        document.getElementById('app').innerHTML = `
          <div class="container page-section">
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h3>Trang không tồn tại</h3>
              <p>Xin lỗi, chúng tôi không tìm thấy trang bạn yêu cầu.</p>
              <button class="btn btn-primary" onclick="router.navigate('/')">Về trang chủ</button>
            </div>
          </div>`;
      });
    }

    // Update active nav link
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.remove('active');
      const navKey = a.dataset.nav;
      if (navKey && path.startsWith('/' + navKey)) {
        a.classList.add('active');
      } else if (navKey === 'home' && path === '/') {
        a.classList.add('active');
      }
    });

    // Close mobile nav
    document.getElementById('navLinks')?.classList.remove('open');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Execute handler
    try {
      await handler({ params: routeParams, query: params });
    } catch (err) {
      console.error('Route error:', err);
      document.getElementById('app').innerHTML = `
        <div class="container page-section">
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>Đã xảy ra lỗi</h3>
            <p>${err.message}</p>
            <button class="btn btn-primary" onclick="router.navigate('/')">Về trang chủ</button>
          </div>
        </div>`;
    }
  }
};

// ─── Utility Functions ────────────────────────────────────
const utils = {
  formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  formatDateShort(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  },

  statusLabel(status) {
    const map = {
      Pending: '⏳ Chờ xử lý',
      Confirmed: '✅ Đã xác nhận',
      Shipping: '🚚 Đang giao',
      Completed: '🎉 Hoàn thành',
      Cancelled: '❌ Đã hủy'
    };
    return map[status] || status;
  },

  statusBadge(status) {
    const cls = `badge badge-${status.toLowerCase()}`;
    return `<span class="${cls}">${this.statusLabel(status)}</span>`;
  },

  paymentBadge(status) {
    const cls = status === 'Paid' ? 'badge badge-paid' : 'badge badge-unpaid';
    const label = status === 'Paid' ? '💰 Đã thanh toán' : '💳 Chưa thanh toán';
    return `<span class="${cls}">${label}</span>`;
  },

  stockText(qty) {
    if (qty <= 0) return '<span class="out">Hết hàng</span>';
    if (qty <= 5) return `<span class="low">Còn ${qty} sản phẩm</span>`;
    return `<span>Còn ${qty} sản phẩm</span>`;
  },

  categoryIcon(name) {
    const icons = {
      'Điện thoại': '📱',
      'Laptop': '💻',
      'Tablet': '📟',
      'Tai nghe': '🎧',
      'Đồng hồ thông minh': '⌚',
      'Phụ kiện': '🔌'
    };
    return icons[name] || '📦';
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  renderPagination(pagination, onPageClick) {
    if (!pagination || pagination.totalPages <= 1) return '';

    let html = '<div class="pagination">';

    html += `<button ${pagination.page <= 1 ? 'disabled' : ''} onclick="${onPageClick}(${pagination.page - 1})">‹</button>`;

    const maxVisible = 5;
    let start = Math.max(1, pagination.page - Math.floor(maxVisible / 2));
    let end = Math.min(pagination.totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
      html += `<button onclick="${onPageClick}(1)">1</button>`;
      if (start > 2) html += '<button disabled>…</button>';
    }

    for (let i = start; i <= end; i++) {
      html += `<button class="${i === pagination.page ? 'active' : ''}" onclick="${onPageClick}(${i})">${i}</button>`;
    }

    if (end < pagination.totalPages) {
      if (end < pagination.totalPages - 1) html += '<button disabled>…</button>';
      html += `<button onclick="${onPageClick}(${pagination.totalPages})">${pagination.totalPages}</button>`;
    }

    html += `<button ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="${onPageClick}(${pagination.page + 1})">›</button>`;
    html += '</div>';

    return html;
  }
};

// ─── Initialize ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav toggle
  document.getElementById('navToggle')?.addEventListener('click', () => {
    document.getElementById('navLinks')?.classList.toggle('open');
  });

  // Close mobile nav on link click
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      document.getElementById('navLinks')?.classList.remove('open');
    });
  });

  // Init auth UI
  auth.updateUI();

  // Register routes (defined in pages.js)
  if (typeof registerRoutes === 'function') {
    registerRoutes();
  }

  // Handle hash change
  window.addEventListener('hashchange', () => router.handleRoute());

  // Initial route
  router.handleRoute();
});
