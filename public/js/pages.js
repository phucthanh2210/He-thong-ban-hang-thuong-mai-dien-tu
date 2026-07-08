/* ========================================================
   TechShop — Page Renderers
   All SPA pages for customer and admin
   ======================================================== */

function registerRoutes() {
  router.register('/', pageHome);
  router.register('/shop', pageShop);
  router.register('/product/:id', pageProductDetail);
  router.register('/cart', pageCart);
  router.register('/checkout', pageCheckout);
  router.register('/login', pageLogin);
  router.register('/register', pageRegister);
  router.register('/profile', pageProfile);
  router.register('/orders', pageOrders);
  router.register('/orders/:id', pageOrderDetail);
  router.register('/admin', pageAdmin);
}

// ═══════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════
async function pageHome() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="hero">
      <div class="container hero-content">
        <h1>Mua sắm <span class="gradient-text">Công nghệ</span><br>Dễ dàng & Nhanh chóng</h1>
        <p>Khám phá hàng ngàn sản phẩm công nghệ chính hãng với giá tốt nhất. Giao hàng nhanh, thanh toán tiện lợi.</p>
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary btn-lg" onclick="router.navigate('/shop')">🛍️ Mua sắm ngay</button>
          <button class="btn btn-secondary btn-lg" onclick="document.getElementById('categories-section').scrollIntoView({behavior:'smooth'})">📂 Xem danh mục</button>
        </div>
      </div>
    </section>

    <section class="page-section" id="categories-section">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">Danh mục sản phẩm</h2>
            <p class="section-subtitle">Khám phá theo danh mục yêu thích</p>
          </div>
        </div>
        <div class="category-grid" id="homeCategoryGrid">
          ${Array(6).fill('<div class="card category-card skeleton" style="height:140px"></div>').join('')}
        </div>
      </div>
    </section>

    <section class="page-section">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">Sản phẩm mới nhất</h2>
            <p class="section-subtitle">Vừa cập nhật</p>
          </div>
          <button class="btn btn-secondary" onclick="router.navigate('/shop')">Xem tất cả →</button>
        </div>
        <div class="product-grid" id="homeProductGrid">
          ${Array(8).fill('<div class="card skeleton skeleton-card"></div>').join('')}
        </div>
      </div>
    </section>
  `;

  // Load data
  try {
    const [categories, productsData] = await Promise.all([
      api.get('/categories'),
      api.get('/products?limit=8')
    ]);

    // Render categories
    document.getElementById('homeCategoryGrid').innerHTML = categories.map(cat => `
      <div class="card category-card" onclick="router.navigate('/shop?category=${cat.CategoryID}')">
        <div class="cat-icon">${utils.categoryIcon(cat.CategoryName)}</div>
        <div class="cat-name">${utils.escapeHtml(cat.CategoryName)}</div>
        <div class="cat-count">${cat.ProductCount} sản phẩm</div>
      </div>
    `).join('');

    // Render products
    document.getElementById('homeProductGrid').innerHTML = renderProductCards(productsData.products);
  } catch (err) {
    console.error('Home load error:', err);
  }
}

// ═══════════════════════════════════════════════════════════
// SHOP PAGE
// ═══════════════════════════════════════════════════════════
async function pageShop({ query }) {
  const app = document.getElementById('app');
  const categoryId = query.get('category') || '';
  const search = query.get('search') || '';
  const sort = query.get('sort') || '';
  const page = query.get('page') || 1;

  app.innerHTML = `
    <section class="page-section">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">Cửa hàng</h2>
            <p class="section-subtitle" id="shopResultInfo">Đang tải...</p>
          </div>
        </div>

        <div class="filters-bar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" class="form-input" id="shopSearch" placeholder="Tìm kiếm sản phẩm..."
                   value="${utils.escapeHtml(search)}" onkeydown="if(event.key==='Enter') shopFilter()">
          </div>
          <select class="form-input filter-select" id="shopCategory" onchange="shopFilter()">
            <option value="">Tất cả danh mục</option>
          </select>
          <select class="form-input filter-select" id="shopSort" onchange="shopFilter()">
            <option value="" ${sort === '' ? 'selected' : ''}>Mới nhất</option>
            <option value="price_asc" ${sort === 'price_asc' ? 'selected' : ''}>Giá thấp → cao</option>
            <option value="price_desc" ${sort === 'price_desc' ? 'selected' : ''}>Giá cao → thấp</option>
            <option value="name" ${sort === 'name' ? 'selected' : ''}>Tên A → Z</option>
          </select>
          <button class="btn btn-primary" onclick="shopFilter()">Tìm kiếm</button>
        </div>

        <div class="product-grid" id="shopProductGrid">
          ${Array(8).fill('<div class="card skeleton skeleton-card"></div>').join('')}
        </div>
        <div id="shopPagination"></div>
      </div>
    </section>
  `;

  // Load categories for filter
  try {
    const categories = await api.get('/categories');
    const catSelect = document.getElementById('shopCategory');
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.CategoryID;
      opt.textContent = cat.CategoryName;
      if (cat.CategoryID == categoryId) opt.selected = true;
      catSelect.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
  }

  // Load products
  await loadShopProducts(page, categoryId, search, sort);
}

async function loadShopProducts(page, category, search, sort) {
  try {
    let url = `/products?page=${page}&limit=12`;
    if (category) url += `&category=${category}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (sort) url += `&sort=${sort}`;

    const data = await api.get(url);

    document.getElementById('shopResultInfo').textContent =
      `Hiển thị ${data.products.length} / ${data.pagination.total} sản phẩm`;

    if (data.products.length === 0) {
      document.getElementById('shopProductGrid').innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">🔍</div>
          <h3>Không tìm thấy sản phẩm</h3>
          <p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
        </div>`;
      document.getElementById('shopPagination').innerHTML = '';
    } else {
      document.getElementById('shopProductGrid').innerHTML = renderProductCards(data.products);
      document.getElementById('shopPagination').innerHTML =
        utils.renderPagination(data.pagination, 'shopGoToPage');
    }
  } catch (err) {
    document.getElementById('shopProductGrid').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">⚠️</div>
        <h3>Lỗi tải sản phẩm</h3>
        <p>${err.message}</p>
      </div>`;
  }
}

// Global functions for shop
window.shopFilter = function () {
  const category = document.getElementById('shopCategory').value;
  const search = document.getElementById('shopSearch').value;
  const sort = document.getElementById('shopSort').value;
  let hash = '#/shop?';
  if (category) hash += `category=${category}&`;
  if (search) hash += `search=${encodeURIComponent(search)}&`;
  if (sort) hash += `sort=${sort}&`;
  window.location.hash = hash.replace(/&$/, '');
};

window.shopGoToPage = function (page) {
  const category = document.getElementById('shopCategory')?.value || '';
  const search = document.getElementById('shopSearch')?.value || '';
  const sort = document.getElementById('shopSort')?.value || '';
  loadShopProducts(page, category, search, sort);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ═══════════════════════════════════════════════════════════
// PRODUCT DETAIL PAGE
// ═══════════════════════════════════════════════════════════
async function pageProductDetail({ params }) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const product = await api.get(`/products/${params.id}`);
    const imgSrc = product.Image ? `/images/${product.Image}` : '';

    app.innerHTML = `
      <section class="page-section">
        <div class="container">
          <button class="btn btn-secondary btn-sm" onclick="history.back()" style="margin-bottom:var(--space-xl)">← Quay lại</button>

          <div class="product-detail">
            <div class="product-detail-image">
              ${imgSrc ? `<img src="${imgSrc}" alt="${utils.escapeHtml(product.ProductName)}">` : '<div style="padding:4rem;color:var(--text-muted);font-size:4rem">📦</div>'}
            </div>

            <div class="product-detail-info">
              <div class="product-detail-category">${utils.escapeHtml(product.CategoryName)}</div>
              <h1>${utils.escapeHtml(product.ProductName)}</h1>
              <div class="product-detail-price">${utils.formatPrice(product.Price)}</div>
              <div class="product-detail-stock">Tình trạng: ${utils.stockText(product.StockQuantity)}</div>
              <div class="product-detail-desc">${utils.escapeHtml(product.Description)}</div>

              ${product.StockQuantity > 0 ? `
                <div class="product-detail-actions">
                  <div class="qty-control">
                    <button onclick="pdQtyChange(-1)">−</button>
                    <div class="qty-value" id="pdQty">1</div>
                    <button onclick="pdQtyChange(1)">+</button>
                  </div>
                  <button class="btn btn-primary btn-lg" id="pdAddBtn" onclick="pdAddToCart(${product.ProductID})">
                    🛒 Thêm vào giỏ hàng
                  </button>
                </div>
              ` : `
                <button class="btn btn-secondary btn-lg" disabled>Hết hàng</button>
              `}
            </div>
          </div>
        </div>
      </section>
    `;

    // Store max stock for qty control
    window._pdMaxStock = product.StockQuantity;
  } catch (err) {
    app.innerHTML = `
      <div class="container page-section">
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <h3>Không tìm thấy sản phẩm</h3>
          <p>${err.message}</p>
          <button class="btn btn-primary" onclick="router.navigate('/shop')">Về cửa hàng</button>
        </div>
      </div>`;
  }
}

window._pdMaxStock = 1;
window.pdQtyChange = function (delta) {
  const el = document.getElementById('pdQty');
  let qty = parseInt(el.textContent) + delta;
  qty = Math.max(1, Math.min(qty, window._pdMaxStock));
  el.textContent = qty;
};

window.pdAddToCart = async function (productId) {
  if (!auth.isLoggedIn) {
    toast.warning('Vui lòng đăng nhập để thêm vào giỏ hàng');
    router.navigate('/login');
    return;
  }
  const btn = document.getElementById('pdAddBtn');
  btn.disabled = true;
  btn.textContent = 'Đang thêm...';
  try {
    const qty = parseInt(document.getElementById('pdQty').textContent);
    await api.post('/cart/add', { productId, quantity: qty });
    toast.success('Đã thêm vào giỏ hàng!');
    auth.updateCartBadge();
  } catch (err) {
    toast.error(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🛒 Thêm vào giỏ hàng';
  }
};

// ═══════════════════════════════════════════════════════════
// CART PAGE
// ═══════════════════════════════════════════════════════════
async function pageCart() {
  const app = document.getElementById('app');

  if (!auth.isLoggedIn) {
    app.innerHTML = `
      <div class="container page-section">
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <h3>Vui lòng đăng nhập</h3>
          <p>Bạn cần đăng nhập để xem giỏ hàng</p>
          <button class="btn btn-primary" onclick="router.navigate('/login')">Đăng nhập</button>
        </div>
      </div>`;
    return;
  }

  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const data = await api.get('/cart');

    if (data.items.length === 0) {
      app.innerHTML = `
        <div class="container page-section">
          <div class="empty-state">
            <div class="empty-icon">🛒</div>
            <h3>Giỏ hàng trống</h3>
            <p>Hãy thêm sản phẩm vào giỏ hàng để bắt đầu mua sắm!</p>
            <button class="btn btn-primary" onclick="router.navigate('/shop')">Mua sắm ngay</button>
          </div>
        </div>`;
      return;
    }

    app.innerHTML = `
      <section class="page-section">
        <div class="container">
          <h2 class="section-title" style="margin-bottom:var(--space-xl)">🛒 Giỏ hàng (${data.itemCount} sản phẩm)</h2>
          <div class="two-col">
            <div class="glass-card" style="padding:0;overflow:hidden" id="cartItemsList">
              ${renderCartItems(data.items)}
            </div>
            <div class="glass-card cart-summary">
              <h3 style="margin-bottom:var(--space-lg)">Tóm tắt đơn hàng</h3>
              <div class="cart-summary-row">
                <span>Tạm tính (${data.itemCount} sản phẩm)</span>
                <span>${utils.formatPrice(data.total)}</span>
              </div>
              <div class="cart-summary-row">
                <span>Phí vận chuyển</span>
                <span style="color:var(--success)">Miễn phí</span>
              </div>
              <div class="cart-summary-row total">
                <span>Tổng cộng</span>
                <span>${utils.formatPrice(data.total)}</span>
              </div>
              <button class="btn btn-primary btn-block btn-lg" style="margin-top:var(--space-lg)"
                      onclick="router.navigate('/checkout')">
                Tiến hành đặt hàng →
              </button>
            </div>
          </div>
        </div>
      </section>
    `;
  } catch (err) {
    app.innerHTML = `
      <div class="container page-section">
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Lỗi tải giỏ hàng</h3>
          <p>${err.message}</p>
        </div>
      </div>`;
  }
}

function renderCartItems(items) {
  return items.map(item => {
    const imgSrc = item.Image ? `/images/${item.Image}` : '';
    return `
      <div class="cart-item" id="cartItem-${item.CartItemID}">
        <div class="cart-item-image">
          ${imgSrc ? `<img src="${imgSrc}" alt="${utils.escapeHtml(item.ProductName)}">` : '📦'}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${utils.escapeHtml(item.ProductName)}</div>
          <div class="cart-item-price">${utils.formatPrice(item.UnitPrice)}</div>
          <div class="cart-item-actions">
            <div class="qty-control">
              <button onclick="cartUpdateQty(${item.CartItemID}, ${item.Quantity - 1}, ${item.StockQuantity})">−</button>
              <div class="qty-value">${item.Quantity}</div>
              <button onclick="cartUpdateQty(${item.CartItemID}, ${item.Quantity + 1}, ${item.StockQuantity})">+</button>
            </div>
            <span style="font-weight:600">${utils.formatPrice(item.Quantity * item.UnitPrice)}</span>
            <button class="btn btn-danger btn-sm" onclick="cartRemoveItem(${item.CartItemID})">🗑️ Xóa</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.cartUpdateQty = async function (cartItemId, newQty, maxStock) {
  if (newQty < 1) {
    cartRemoveItem(cartItemId);
    return;
  }
  if (newQty > maxStock) {
    toast.warning(`Chỉ còn ${maxStock} sản phẩm trong kho`);
    return;
  }
  try {
    await api.put(`/cart/${cartItemId}`, { quantity: newQty });
    pageCart(); // Reload cart
    auth.updateCartBadge();
  } catch (err) {
    toast.error(err.message);
  }
};

window.cartRemoveItem = async function (cartItemId) {
  try {
    await api.delete(`/cart/${cartItemId}`);
    toast.success('Đã xóa sản phẩm');
    pageCart(); // Reload cart
    auth.updateCartBadge();
  } catch (err) {
    toast.error(err.message);
  }
};

// ═══════════════════════════════════════════════════════════
// CHECKOUT PAGE
// ═══════════════════════════════════════════════════════════
async function pageCheckout() {
  const app = document.getElementById('app');

  if (!auth.isLoggedIn) {
    router.navigate('/login');
    return;
  }

  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const cart = await api.get('/cart');
    if (cart.items.length === 0) {
      toast.warning('Giỏ hàng trống');
      router.navigate('/cart');
      return;
    }

    const user = auth.user;

    app.innerHTML = `
      <section class="page-section">
        <div class="container">
          <h2 class="section-title" style="margin-bottom:var(--space-xl)">📋 Đặt hàng</h2>
          <div class="checkout-grid">
            <div class="glass-card">
              <h3 style="margin-bottom:var(--space-lg)">Thông tin giao hàng</h3>
              <div class="form-group">
                <label class="form-label">Tên người nhận *</label>
                <input type="text" class="form-input" id="coName" value="${utils.escapeHtml(user?.fullName || '')}" placeholder="Họ và tên">
              </div>
              <div class="form-group">
                <label class="form-label">Số điện thoại *</label>
                <input type="tel" class="form-input" id="coPhone" value="${utils.escapeHtml(user?.phone || '')}" placeholder="0901234567">
              </div>
              <div class="form-group">
                <label class="form-label">Địa chỉ giao hàng *</label>
                <textarea class="form-input" id="coAddress" placeholder="Số nhà, đường, quận/huyện, thành phố"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Ghi chú</label>
                <textarea class="form-input" id="coNote" placeholder="Ghi chú cho đơn hàng (tùy chọn)" rows="3"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Phương thức thanh toán *</label>
                <select class="form-input" id="coPayment">
                  <option value="COD">💵 Thanh toán khi nhận hàng (COD)</option>
                  <option value="MockBank">🏦 Chuyển khoản ngân hàng (Mock)</option>
                </select>
              </div>
            </div>

            <div>
              <div class="glass-card">
                <h3 style="margin-bottom:var(--space-lg)">Đơn hàng của bạn</h3>
                ${cart.items.map(item => `
                  <div style="display:flex;justify-content:space-between;padding:var(--space-sm) 0;border-bottom:1px solid var(--border-subtle)">
                    <div>
                      <div style="font-weight:500;font-size:0.9rem">${utils.escapeHtml(item.ProductName)}</div>
                      <div style="color:var(--text-muted);font-size:0.8rem">x${item.Quantity}</div>
                    </div>
                    <div style="font-weight:600;white-space:nowrap">${utils.formatPrice(item.Quantity * item.UnitPrice)}</div>
                  </div>
                `).join('')}
                <div class="cart-summary-row total" style="margin-top:var(--space-md)">
                  <span>Tổng cộng</span>
                  <span>${utils.formatPrice(cart.total)}</span>
                </div>
                <button class="btn btn-primary btn-block btn-lg" style="margin-top:var(--space-lg)"
                        id="coSubmitBtn" onclick="submitCheckout()">
                  ✅ Xác nhận đặt hàng
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  } catch (err) {
    app.innerHTML = `<div class="container page-section"><div class="empty-state"><div class="empty-icon">⚠️</div><h3>${err.message}</h3></div></div>`;
  }
}

window.submitCheckout = async function () {
  const btn = document.getElementById('coSubmitBtn');
  const receiverName = document.getElementById('coName').value.trim();
  const phone = document.getElementById('coPhone').value.trim();
  const shippingAddress = document.getElementById('coAddress').value.trim();
  const note = document.getElementById('coNote').value.trim();
  const paymentMethod = document.getElementById('coPayment').value;

  if (!receiverName || !phone || !shippingAddress) {
    toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Đang xử lý...';

  try {
    const result = await api.post('/orders/checkout', {
      receiverName, phone, shippingAddress, paymentMethod, note: note || null
    });
    toast.success('🎉 Đặt hàng thành công!');
    auth.updateCartBadge();
    router.navigate(`/orders/${result.orderId}`);
  } catch (err) {
    toast.error(err.message);
    btn.disabled = false;
    btn.textContent = '✅ Xác nhận đặt hàng';
  }
};

// ═══════════════════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════════════════
async function pageLogin() {
  if (auth.isLoggedIn) {
    router.navigate('/');
    return;
  }

  document.getElementById('app').innerHTML = `
    <section class="page-section">
      <div class="container">
        <div class="auth-container">
          <div class="glass-card">
            <h2>Đăng nhập</h2>
            <p class="auth-subtitle">Chào mừng bạn trở lại với TechShop</p>
            <form onsubmit="loginSubmit(event)">
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" id="loginEmail" placeholder="your@email.com" required>
              </div>
              <div class="form-group">
                <label class="form-label">Mật khẩu</label>
                <input type="password" class="form-input" id="loginPassword" placeholder="••••••••" required>
              </div>
              <button type="submit" class="btn btn-primary btn-block btn-lg" id="loginBtn">Đăng nhập</button>
            </form>
            <p class="auth-switch">Chưa có tài khoản? <a href="#/register">Đăng ký ngay</a></p>
            <div style="margin-top:var(--space-lg);padding-top:var(--space-lg);border-top:1px solid var(--border-subtle)">
              <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:var(--space-sm)">Tài khoản demo:</p>
              <p style="color:var(--text-muted);font-size:0.8rem">Admin: admin@ecommerce.com</p>
              <p style="color:var(--text-muted);font-size:0.8rem">Customer: an.nguyen@gmail.com</p>
              <p style="color:var(--text-muted);font-size:0.8rem">Mật khẩu: Password@123</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

window.loginSubmit = async function (e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  btn.disabled = true;
  btn.textContent = 'Đang đăng nhập...';

  try {
    const data = await api.post('/auth/login', { email, password });
    auth.setAuth(data.token, data.user);
    toast.success(`Chào mừng ${data.user.fullName}!`);
    router.navigate(data.user.role === 'Admin' ? '/admin' : '/');
  } catch (err) {
    toast.error(err.message);
    btn.disabled = false;
    btn.textContent = 'Đăng nhập';
  }
};

// ═══════════════════════════════════════════════════════════
// REGISTER PAGE
// ═══════════════════════════════════════════════════════════
async function pageRegister() {
  if (auth.isLoggedIn) {
    router.navigate('/');
    return;
  }

  document.getElementById('app').innerHTML = `
    <section class="page-section">
      <div class="container">
        <div class="auth-container">
          <div class="glass-card">
            <h2>Đăng ký</h2>
            <p class="auth-subtitle">Tạo tài khoản mới tại TechShop</p>
            <form onsubmit="registerSubmit(event)">
              <div class="form-group">
                <label class="form-label">Họ và tên *</label>
                <input type="text" class="form-input" id="regName" placeholder="Nguyễn Văn A" required>
              </div>
              <div class="form-group">
                <label class="form-label">Email *</label>
                <input type="email" class="form-input" id="regEmail" placeholder="your@email.com" required>
              </div>
              <div class="form-group">
                <label class="form-label">Số điện thoại</label>
                <input type="tel" class="form-input" id="regPhone" placeholder="0901234567">
              </div>
              <div class="form-group">
                <label class="form-label">Mật khẩu * (tối thiểu 6 ký tự)</label>
                <input type="password" class="form-input" id="regPassword" placeholder="••••••••" required minlength="6">
              </div>
              <div class="form-group">
                <label class="form-label">Xác nhận mật khẩu *</label>
                <input type="password" class="form-input" id="regConfirm" placeholder="••••••••" required>
              </div>
              <button type="submit" class="btn btn-primary btn-block btn-lg" id="regBtn">Đăng ký</button>
            </form>
            <p class="auth-switch">Đã có tài khoản? <a href="#/login">Đăng nhập</a></p>
          </div>
        </div>
      </div>
    </section>
  `;
}

window.registerSubmit = async function (e) {
  e.preventDefault();
  const btn = document.getElementById('regBtn');
  const fullName = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

  if (password !== confirm) {
    toast.error('Mật khẩu xác nhận không khớp');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Đang đăng ký...';

  try {
    const data = await api.post('/auth/register', { fullName, email, password, phone: phone || null });
    auth.setAuth(data.token, data.user);
    toast.success('Đăng ký thành công! 🎉');
    router.navigate('/');
  } catch (err) {
    toast.error(err.message);
    btn.disabled = false;
    btn.textContent = 'Đăng ký';
  }
};

// ═══════════════════════════════════════════════════════════
// PROFILE PAGE
// ═══════════════════════════════════════════════════════════
async function pageProfile() {
  if (!auth.isLoggedIn) { router.navigate('/login'); return; }

  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const user = await api.get('/auth/profile');

    app.innerHTML = `
      <section class="page-section">
        <div class="container" style="max-width:700px">
          <div class="profile-header">
            <div class="profile-avatar">${user.fullName.charAt(0).toUpperCase()}</div>
            <div>
              <div class="profile-name">${utils.escapeHtml(user.fullName)}</div>
              <div class="profile-email">${utils.escapeHtml(user.email)}</div>
              <span class="badge badge-active" style="margin-top:var(--space-sm);display:inline-block">${user.role}</span>
            </div>
          </div>

          <div class="glass-card" style="margin-bottom:var(--space-xl)">
            <h3 style="margin-bottom:var(--space-lg)">Thông tin cá nhân</h3>
            <form onsubmit="profileUpdate(event)">
              <div class="form-group">
                <label class="form-label">Họ và tên</label>
                <input type="text" class="form-input" id="profName" value="${utils.escapeHtml(user.fullName)}">
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" value="${utils.escapeHtml(user.email)}" disabled style="opacity:0.5">
              </div>
              <div class="form-group">
                <label class="form-label">Số điện thoại</label>
                <input type="tel" class="form-input" id="profPhone" value="${utils.escapeHtml(user.phone || '')}">
              </div>
              <button type="submit" class="btn btn-primary" id="profBtn">Cập nhật</button>
            </form>
          </div>

          <div class="glass-card">
            <h3 style="margin-bottom:var(--space-lg)">Đổi mật khẩu</h3>
            <form onsubmit="profileChangePassword(event)">
              <div class="form-group">
                <label class="form-label">Mật khẩu hiện tại</label>
                <input type="password" class="form-input" id="profCurrentPw" placeholder="••••••••">
              </div>
              <div class="form-group">
                <label class="form-label">Mật khẩu mới</label>
                <input type="password" class="form-input" id="profNewPw" placeholder="••••••••" minlength="6">
              </div>
              <button type="submit" class="btn btn-secondary" id="profPwBtn">Đổi mật khẩu</button>
            </form>
          </div>
        </div>
      </section>
    `;
  } catch (err) {
    app.innerHTML = `<div class="container page-section"><div class="empty-state"><div class="empty-icon">⚠️</div><h3>${err.message}</h3></div></div>`;
  }
}

window.profileUpdate = async function (e) {
  e.preventDefault();
  const btn = document.getElementById('profBtn');
  btn.disabled = true;
  try {
    await api.put('/auth/profile', {
      fullName: document.getElementById('profName').value.trim(),
      phone: document.getElementById('profPhone').value.trim()
    });
    toast.success('Cập nhật thành công');
    // Update local state
    const user = auth.user;
    user.fullName = document.getElementById('profName').value.trim();
    user.phone = document.getElementById('profPhone').value.trim();
    localStorage.setItem('user', JSON.stringify(user));
    auth.updateUI();
  } catch (err) {
    toast.error(err.message);
  } finally {
    btn.disabled = false;
  }
};

window.profileChangePassword = async function (e) {
  e.preventDefault();
  const btn = document.getElementById('profPwBtn');
  const currentPassword = document.getElementById('profCurrentPw').value;
  const newPassword = document.getElementById('profNewPw').value;

  if (!currentPassword || !newPassword) {
    toast.error('Vui lòng nhập đầy đủ');
    return;
  }

  btn.disabled = true;
  try {
    await api.put('/auth/profile', { currentPassword, newPassword });
    toast.success('Đổi mật khẩu thành công');
    document.getElementById('profCurrentPw').value = '';
    document.getElementById('profNewPw').value = '';
  } catch (err) {
    toast.error(err.message);
  } finally {
    btn.disabled = false;
  }
};

// ═══════════════════════════════════════════════════════════
// ORDERS PAGE
// ═══════════════════════════════════════════════════════════
async function pageOrders({ query }) {
  if (!auth.isLoggedIn) { router.navigate('/login'); return; }

  const app = document.getElementById('app');
  const status = query?.get('status') || '';

  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    let url = '/orders?limit=20';
    if (status) url += `&status=${status}`;

    const data = await api.get(url);

    app.innerHTML = `
      <section class="page-section">
        <div class="container" style="max-width:900px">
          <h2 class="section-title" style="margin-bottom:var(--space-lg)">📦 Đơn hàng của tôi</h2>

          <div class="filters-bar">
            <select class="form-input filter-select" onchange="router.navigate('/orders?status='+this.value)">
              <option value="" ${!status ? 'selected' : ''}>Tất cả</option>
              <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Chờ xử lý</option>
              <option value="Confirmed" ${status === 'Confirmed' ? 'selected' : ''}>Đã xác nhận</option>
              <option value="Shipping" ${status === 'Shipping' ? 'selected' : ''}>Đang giao</option>
              <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>Hoàn thành</option>
              <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>Đã hủy</option>
            </select>
          </div>

          ${data.orders.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📦</div>
              <h3>Chưa có đơn hàng</h3>
              <p>Bạn chưa có đơn hàng nào${status ? ' ở trạng thái này' : ''}</p>
              <button class="btn btn-primary" onclick="router.navigate('/shop')">Mua sắm ngay</button>
            </div>
          ` : data.orders.map(order => `
            <div class="card order-card" onclick="router.navigate('/orders/${order.OrderID}')">
              <div class="order-card-header">
                <span class="order-card-id">#${order.OrderID}</span>
                <div style="display:flex;gap:var(--space-sm)">
                  ${utils.statusBadge(order.OrderStatus)}
                  ${utils.paymentBadge(order.PaymentStatus)}
                </div>
              </div>
              <div class="order-card-body">
                <div class="order-card-info">
                  <div>${utils.escapeHtml(order.ReceiverName)} • ${utils.escapeHtml(order.Phone)}</div>
                  <div style="color:var(--text-muted);font-size:0.85rem">${utils.formatDate(order.CreatedAt)}</div>
                </div>
                <div class="order-card-amount">${utils.formatPrice(order.TotalAmount)}</div>
              </div>
            </div>
          `).join('')}

          <div id="ordersPagination">
            ${utils.renderPagination(data.pagination, 'ordersGoToPage')}
          </div>
        </div>
      </section>
    `;
  } catch (err) {
    app.innerHTML = `<div class="container page-section"><div class="empty-state"><div class="empty-icon">⚠️</div><h3>${err.message}</h3></div></div>`;
  }
}

window.ordersGoToPage = function (page) {
  // Simple reload with page
  router.navigate(`/orders?page=${page}`);
};

// ═══════════════════════════════════════════════════════════
// ORDER DETAIL PAGE
// ═══════════════════════════════════════════════════════════
async function pageOrderDetail({ params }) {
  if (!auth.isLoggedIn) { router.navigate('/login'); return; }

  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const order = await api.get(`/orders/${params.id}`);

    app.innerHTML = `
      <section class="page-section">
        <div class="container" style="max-width:900px">
          <button class="btn btn-secondary btn-sm" onclick="router.navigate('/orders')" style="margin-bottom:var(--space-xl)">← Đơn hàng</button>

          <div class="order-header">
            <div>
              <h2 class="section-title">Đơn hàng #${order.OrderID}</h2>
              <p style="color:var(--text-muted);margin-top:var(--space-xs)">${utils.formatDate(order.CreatedAt)}</p>
            </div>
            <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap">
              ${utils.statusBadge(order.OrderStatus)}
              ${utils.paymentBadge(order.PaymentStatus)}
            </div>
          </div>

          <div class="order-meta">
            <div class="order-meta-item">
              <div class="meta-label">Người nhận</div>
              <div class="meta-value">${utils.escapeHtml(order.ReceiverName)}</div>
            </div>
            <div class="order-meta-item">
              <div class="meta-label">Số điện thoại</div>
              <div class="meta-value">${utils.escapeHtml(order.Phone)}</div>
            </div>
            <div class="order-meta-item">
              <div class="meta-label">Địa chỉ</div>
              <div class="meta-value">${utils.escapeHtml(order.ShippingAddress)}</div>
            </div>
            <div class="order-meta-item">
              <div class="meta-label">Thanh toán</div>
              <div class="meta-value">${order.PaymentMethod === 'COD' ? '💵 COD' : '🏦 Chuyển khoản'}</div>
            </div>
            ${order.Note ? `
              <div class="order-meta-item" style="grid-column:1/-1">
                <div class="meta-label">Ghi chú</div>
                <div class="meta-value">${utils.escapeHtml(order.Note)}</div>
              </div>
            ` : ''}
          </div>

          <div class="glass-card">
            <h3 style="margin-bottom:var(--space-lg)">Sản phẩm</h3>
            <div class="data-table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Đơn giá</th>
                    <th>Số lượng</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.items.map(item => `
                    <tr>
                      <td>
                        <div style="display:flex;align-items:center;gap:var(--space-sm)">
                          ${item.Image ? `<img src="/images/${item.Image}" style="width:40px;height:40px;object-fit:contain;border-radius:var(--radius-sm)" alt="">` : ''}
                          <span style="cursor:pointer;color:var(--accent-start)" onclick="router.navigate('/product/${item.ProductID}')">${utils.escapeHtml(item.ProductName)}</span>
                        </div>
                      </td>
                      <td>${utils.formatPrice(item.UnitPrice)}</td>
                      <td>${item.Quantity}</td>
                      <td style="font-weight:600">${utils.formatPrice(item.SubTotal)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="cart-summary-row total" style="margin-top:var(--space-md)">
              <span>Tổng cộng</span>
              <span>${utils.formatPrice(order.TotalAmount)}</span>
            </div>
          </div>

          <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl);flex-wrap:wrap">
            ${['Pending', 'Confirmed'].includes(order.OrderStatus) ? `
              <button class="btn btn-danger" onclick="cancelOrder(${order.OrderID})">❌ Hủy đơn hàng</button>
            ` : ''}
            ${order.PaymentStatus === 'Unpaid' && order.OrderStatus !== 'Cancelled' && order.PaymentMethod === 'MockBank' ? `
              <button class="btn btn-success" onclick="payOrder(${order.OrderID})">💳 Thanh toán ngay</button>
            ` : ''}
          </div>
        </div>
      </section>
    `;
  } catch (err) {
    app.innerHTML = `<div class="container page-section"><div class="empty-state"><div class="empty-icon">⚠️</div><h3>${err.message}</h3></div></div>`;
  }
}

window.cancelOrder = async function (orderId) {
  if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
  try {
    await api.put(`/orders/${orderId}/cancel`);
    toast.success('Đã hủy đơn hàng');
    router.navigate(`/orders/${orderId}`);
  } catch (err) {
    toast.error(err.message);
  }
};

window.payOrder = async function (orderId) {
  if (!confirm('Xác nhận thanh toán đơn hàng?')) return;
  try {
    await api.post(`/orders/${orderId}/pay`);
    toast.success('Thanh toán thành công! 💰');
    router.navigate(`/orders/${orderId}`);
  } catch (err) {
    toast.error(err.message);
  }
};

// ═══════════════════════════════════════════════════════════
// ADMIN PAGE
// ═══════════════════════════════════════════════════════════
async function pageAdmin({ query }) {
  if (!auth.isLoggedIn || !auth.isAdmin) {
    toast.error('Bạn không có quyền truy cập trang quản trị');
    router.navigate('/');
    return;
  }

  const tab = query?.get('tab') || 'dashboard';
  const app = document.getElementById('app');

  app.innerHTML = `
    <section class="page-section">
      <div class="container">
        <div class="admin-header">
          <h1>⚙️ Quản trị hệ thống</h1>
          <p>Xin chào, ${utils.escapeHtml(auth.user.fullName)}</p>
        </div>

        <div class="admin-tabs">
          <button class="admin-tab ${tab === 'dashboard' ? 'active' : ''}" onclick="router.navigate('/admin?tab=dashboard')">📊 Dashboard</button>
          <button class="admin-tab ${tab === 'orders' ? 'active' : ''}" onclick="router.navigate('/admin?tab=orders')">📦 Đơn hàng</button>
          <button class="admin-tab ${tab === 'products' ? 'active' : ''}" onclick="router.navigate('/admin?tab=products')">📱 Sản phẩm</button>
          <button class="admin-tab ${tab === 'users' ? 'active' : ''}" onclick="router.navigate('/admin?tab=users')">👥 Người dùng</button>
          <button class="admin-tab ${tab === 'revenue' ? 'active' : ''}" onclick="router.navigate('/admin?tab=revenue')">💰 Doanh thu</button>
        </div>

        <div id="adminContent">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
    </section>
  `;

  // Load tab content
  const tabHandlers = {
    dashboard: adminDashboard,
    orders: adminOrders,
    products: adminProducts,
    users: adminUsers,
    revenue: adminRevenue
  };

  const handler = tabHandlers[tab];
  if (handler) await handler();
}

// ─── Admin Dashboard ──────────────────────────────────────
async function adminDashboard() {
  const el = document.getElementById('adminContent');
  try {
    const data = await api.get('/admin/dashboard');
    const s = data.stats;

    el.innerHTML = `
      <div class="stats-grid">
        <div class="card stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-value">${s.TotalCustomers}</div>
          <div class="stat-label">Khách hàng</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">📱</div>
          <div class="stat-value">${s.TotalActiveProducts}</div>
          <div class="stat-label">Sản phẩm đang bán</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${s.TotalOrders}</div>
          <div class="stat-label">Tổng đơn hàng</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${utils.formatPrice(s.TotalRevenue)}</div>
          <div class="stat-label">Doanh thu</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-sm);margin-bottom:var(--space-xl)">
        <div class="card" style="padding:var(--space-md);text-align:center">
          <div style="color:var(--warning);font-size:1.5rem;font-weight:700">${s.PendingOrders}</div>
          <div style="color:var(--text-muted);font-size:0.8rem">Chờ xử lý</div>
        </div>
        <div class="card" style="padding:var(--space-md);text-align:center">
          <div style="color:var(--info);font-size:1.5rem;font-weight:700">${s.ConfirmedOrders}</div>
          <div style="color:var(--text-muted);font-size:0.8rem">Đã xác nhận</div>
        </div>
        <div class="card" style="padding:var(--space-md);text-align:center">
          <div style="color:#a855f7;font-size:1.5rem;font-weight:700">${s.ShippingOrders}</div>
          <div style="color:var(--text-muted);font-size:0.8rem">Đang giao</div>
        </div>
        <div class="card" style="padding:var(--space-md);text-align:center">
          <div style="color:var(--success);font-size:1.5rem;font-weight:700">${s.CompletedOrders}</div>
          <div style="color:var(--text-muted);font-size:0.8rem">Hoàn thành</div>
        </div>
        <div class="card" style="padding:var(--space-md);text-align:center">
          <div style="color:var(--danger);font-size:1.5rem;font-weight:700">${s.CancelledOrders}</div>
          <div style="color:var(--text-muted);font-size:0.8rem">Đã hủy</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xl)">
        <div class="glass-card">
          <h3 style="margin-bottom:var(--space-lg)">📦 Đơn hàng gần đây</h3>
          ${data.recentOrders.map(o => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm) 0;border-bottom:1px solid var(--border-subtle)">
              <div>
                <span style="font-weight:600">#${o.OrderID}</span>
                <span style="color:var(--text-muted);font-size:0.85rem;margin-left:var(--space-sm)">${utils.escapeHtml(o.ReceiverName)}</span>
              </div>
              <div style="display:flex;gap:var(--space-sm);align-items:center">
                <span style="font-weight:600;font-size:0.9rem">${utils.formatPrice(o.TotalAmount)}</span>
                ${utils.statusBadge(o.OrderStatus)}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="glass-card">
          <h3 style="margin-bottom:var(--space-lg)">⚠️ Sản phẩm sắp hết hàng</h3>
          ${data.lowStock.length === 0 ? '<p style="color:var(--text-muted)">Không có sản phẩm nào sắp hết hàng</p>' :
            data.lowStock.map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm) 0;border-bottom:1px solid var(--border-subtle)">
                <div style="display:flex;align-items:center;gap:var(--space-sm)">
                  ${p.Image ? `<img src="/images/${p.Image}" style="width:32px;height:32px;object-fit:contain;border-radius:var(--radius-sm)" alt="">` : ''}
                  <span style="font-size:0.9rem">${utils.escapeHtml(p.ProductName)}</span>
                </div>
                <span class="badge badge-${p.StockQuantity === 0 ? 'cancelled' : 'pending'}">${p.StockQuantity} còn lại</span>
              </div>
            `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${err.message}</h3></div>`;
  }
}

// ─── Admin Orders ─────────────────────────────────────────
async function adminOrders() {
  const el = document.getElementById('adminContent');
  try {
    const data = await api.get('/admin/orders?limit=20');

    el.innerHTML = `
      <div class="filters-bar">
        <select class="form-input filter-select" id="adminOrderFilter" onchange="adminFilterOrders()">
          <option value="">Tất cả trạng thái</option>
          <option value="Pending">Chờ xử lý</option>
          <option value="Confirmed">Đã xác nhận</option>
          <option value="Shipping">Đang giao</option>
          <option value="Completed">Hoàn thành</option>
          <option value="Cancelled">Đã hủy</option>
        </select>
      </div>

      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>#ID</th>
              <th>Khách hàng</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Thanh toán</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody id="adminOrdersBody">
            ${renderAdminOrderRows(data.orders)}
          </tbody>
        </table>
      </div>
      <div id="adminOrdersPagination">
        ${utils.renderPagination(data.pagination, 'adminOrdersPage')}
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${err.message}</h3></div>`;
  }
}

function renderAdminOrderRows(orders) {
  return orders.map(o => `
    <tr>
      <td><strong>#${o.OrderID}</strong></td>
      <td>
        <div>${utils.escapeHtml(o.CustomerName)}</div>
        <div style="color:var(--text-muted);font-size:0.8rem">${utils.escapeHtml(o.CustomerEmail)}</div>
      </td>
      <td style="font-weight:600">${utils.formatPrice(o.TotalAmount)}</td>
      <td>${utils.statusBadge(o.OrderStatus)}</td>
      <td>${utils.paymentBadge(o.PaymentStatus)}</td>
      <td style="white-space:nowrap;font-size:0.85rem">${utils.formatDateShort(o.CreatedAt)}</td>
      <td>
        <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap">
          ${getOrderActions(o)}
        </div>
      </td>
    </tr>
  `).join('');
}

function getOrderActions(order) {
  const actions = [];
  const s = order.OrderStatus;

  if (s === 'Pending') {
    actions.push(`<button class="btn btn-success btn-sm" onclick="adminUpdateOrderStatus(${order.OrderID}, 'Confirmed')">✅ Xác nhận</button>`);
    actions.push(`<button class="btn btn-danger btn-sm" onclick="adminUpdateOrderStatus(${order.OrderID}, 'Cancelled')">❌ Hủy</button>`);
  } else if (s === 'Confirmed') {
    actions.push(`<button class="btn btn-sm" style="background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid rgba(168,85,247,0.3)" onclick="adminUpdateOrderStatus(${order.OrderID}, 'Shipping')">🚚 Giao hàng</button>`);
    actions.push(`<button class="btn btn-danger btn-sm" onclick="adminUpdateOrderStatus(${order.OrderID}, 'Cancelled')">❌ Hủy</button>`);
  } else if (s === 'Shipping') {
    actions.push(`<button class="btn btn-success btn-sm" onclick="adminUpdateOrderStatus(${order.OrderID}, 'Completed')">🎉 Hoàn thành</button>`);
  }

  return actions.join('');
}

window.adminUpdateOrderStatus = async function (orderId, status) {
  const confirmMsg = {
    Confirmed: 'Xác nhận đơn hàng?',
    Shipping: 'Chuyển sang trạng thái giao hàng?',
    Completed: 'Xác nhận đơn hàng hoàn thành?',
    Cancelled: 'Hủy đơn hàng này?'
  };
  if (!confirm(confirmMsg[status] || 'Xác nhận?')) return;

  try {
    await api.put(`/admin/orders/${orderId}/status`, { status });
    toast.success('Cập nhật trạng thái thành công');
    adminOrders(); // Reload
  } catch (err) {
    toast.error(err.message);
  }
};

window.adminFilterOrders = async function () {
  const status = document.getElementById('adminOrderFilter').value;
  try {
    let url = '/admin/orders?limit=20';
    if (status) url += `&status=${status}`;
    const data = await api.get(url);
    document.getElementById('adminOrdersBody').innerHTML = renderAdminOrderRows(data.orders);
    document.getElementById('adminOrdersPagination').innerHTML =
      utils.renderPagination(data.pagination, 'adminOrdersPage');
  } catch (err) {
    toast.error(err.message);
  }
};

window.adminOrdersPage = async function (page) {
  const status = document.getElementById('adminOrderFilter')?.value || '';
  try {
    let url = `/admin/orders?page=${page}&limit=20`;
    if (status) url += `&status=${status}`;
    const data = await api.get(url);
    document.getElementById('adminOrdersBody').innerHTML = renderAdminOrderRows(data.orders);
    document.getElementById('adminOrdersPagination').innerHTML =
      utils.renderPagination(data.pagination, 'adminOrdersPage');
  } catch (err) {
    toast.error(err.message);
  }
};

// ─── Admin Products ───────────────────────────────────────
async function adminProducts() {
  const el = document.getElementById('adminContent');
  try {
    const [data, categories] = await Promise.all([
      api.get('/admin/products?limit=50'),
      api.get('/admin/categories')
    ]);

    window._adminCategories = categories;

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-lg)">
        <h3>${data.pagination.total} sản phẩm</h3>
        <button class="btn btn-primary" onclick="showAddProductModal()">➕ Thêm sản phẩm</button>
      </div>

      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Hình ảnh</th>
              <th>Tên sản phẩm</th>
              <th>Danh mục</th>
              <th>Giá</th>
              <th>Tồn kho</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${data.products.map(p => `
              <tr>
                <td>${p.ProductID}</td>
                <td>${p.Image ? `<img src="/images/${p.Image}" style="width:40px;height:40px;object-fit:contain;border-radius:var(--radius-sm)" alt="">` : '—'}</td>
                <td style="max-width:200px">
                  <div style="font-weight:500">${utils.escapeHtml(p.ProductName)}</div>
                </td>
                <td>${utils.escapeHtml(p.CategoryName)}</td>
                <td style="font-weight:600;white-space:nowrap">${utils.formatPrice(p.Price)}</td>
                <td>
                  <span class="${p.StockQuantity <= 5 ? 'badge badge-pending' : ''}">${p.StockQuantity}</span>
                </td>
                <td>
                  <span class="badge ${p.Status ? 'badge-active' : 'badge-inactive'}">${p.Status ? 'Đang bán' : 'Ngừng bán'}</span>
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="showEditProductModal(${p.ProductID})">✏️ Sửa</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${err.message}</h3></div>`;
  }
}

window.showAddProductModal = function () {
  const categories = window._adminCategories || [];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'productModal';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Thêm sản phẩm mới</h3>
        <button class="modal-close" onclick="document.getElementById('productModal').remove()">✕</button>
      </div>
      <form onsubmit="submitAddProduct(event)">
        <div class="form-group">
          <label class="form-label">Tên sản phẩm *</label>
          <input type="text" class="form-input" id="addProdName" required>
        </div>
        <div class="form-group">
          <label class="form-label">Danh mục *</label>
          <select class="form-input" id="addProdCategory" required>
            ${categories.map(c => `<option value="${c.CategoryID}">${utils.escapeHtml(c.CategoryName)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Giá (VNĐ) *</label>
            <input type="number" class="form-input" id="addProdPrice" required min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Tồn kho</label>
            <input type="number" class="form-input" id="addProdStock" value="0" min="0">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Tên file ảnh</label>
          <input type="text" class="form-input" id="addProdImage" placeholder="ten-anh.jpeg">
        </div>
        <div class="form-group">
          <label class="form-label">Mô tả</label>
          <textarea class="form-input" id="addProdDesc" rows="3"></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="addProdBtn">Thêm sản phẩm</button>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
};

window.submitAddProduct = async function (e) {
  e.preventDefault();
  const btn = document.getElementById('addProdBtn');
  btn.disabled = true;

  try {
    await api.post('/admin/products', {
      categoryId: parseInt(document.getElementById('addProdCategory').value),
      productName: document.getElementById('addProdName').value.trim(),
      description: document.getElementById('addProdDesc').value.trim(),
      price: parseFloat(document.getElementById('addProdPrice').value),
      stockQuantity: parseInt(document.getElementById('addProdStock').value) || 0,
      image: document.getElementById('addProdImage').value.trim() || null
    });
    toast.success('Thêm sản phẩm thành công');
    document.getElementById('productModal')?.remove();
    adminProducts();
  } catch (err) {
    toast.error(err.message);
    btn.disabled = false;
  }
};

window.showEditProductModal = async function (productId) {
  try {
    const product = await api.get(`/products/${productId}`);
    const categories = window._adminCategories || [];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'productModal';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Chỉnh sửa sản phẩm #${productId}</h3>
          <button class="modal-close" onclick="document.getElementById('productModal').remove()">✕</button>
        </div>
        <form onsubmit="submitEditProduct(event, ${productId})">
          <div class="form-group">
            <label class="form-label">Tên sản phẩm *</label>
            <input type="text" class="form-input" id="editProdName" value="${utils.escapeHtml(product.ProductName)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Danh mục *</label>
            <select class="form-input" id="editProdCategory" required>
              ${categories.map(c => `<option value="${c.CategoryID}" ${c.CategoryID === product.CategoryID ? 'selected' : ''}>${utils.escapeHtml(c.CategoryName)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Giá (VNĐ) *</label>
              <input type="number" class="form-input" id="editProdPrice" value="${product.Price}" required min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Tồn kho</label>
              <input type="number" class="form-input" id="editProdStock" value="${product.StockQuantity}" min="0">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Tên file ảnh</label>
            <input type="text" class="form-input" id="editProdImage" value="${utils.escapeHtml(product.Image || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Mô tả</label>
            <textarea class="form-input" id="editProdDesc" rows="3">${utils.escapeHtml(product.Description || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Trạng thái</label>
            <select class="form-input" id="editProdStatus">
              <option value="1" ${product.Status ? 'selected' : ''}>Đang bán</option>
              <option value="0" ${!product.Status ? 'selected' : ''}>Ngừng bán</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="editProdBtn">Lưu thay đổi</button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
  } catch (err) {
    toast.error(err.message);
  }
};

window.submitEditProduct = async function (e, productId) {
  e.preventDefault();
  const btn = document.getElementById('editProdBtn');
  btn.disabled = true;

  try {
    await api.put(`/admin/products/${productId}`, {
      categoryId: parseInt(document.getElementById('editProdCategory').value),
      productName: document.getElementById('editProdName').value.trim(),
      description: document.getElementById('editProdDesc').value.trim(),
      price: parseFloat(document.getElementById('editProdPrice').value),
      stockQuantity: parseInt(document.getElementById('editProdStock').value) || 0,
      image: document.getElementById('editProdImage').value.trim() || null,
      status: parseInt(document.getElementById('editProdStatus').value)
    });
    toast.success('Cập nhật sản phẩm thành công');
    document.getElementById('productModal')?.remove();
    adminProducts();
  } catch (err) {
    toast.error(err.message);
    btn.disabled = false;
  }
};

// ─── Admin Users ──────────────────────────────────────────
async function adminUsers() {
  const el = document.getElementById('adminContent');
  try {
    const users = await api.get('/admin/users');

    el.innerHTML = `
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Đơn hàng</th>
              <th>Tổng chi</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>${u.UserID}</td>
                <td style="font-weight:500">${utils.escapeHtml(u.FullName)}</td>
                <td>${utils.escapeHtml(u.Email)}</td>
                <td><span class="badge ${u.RoleName === 'Admin' ? 'badge-shipping' : 'badge-confirmed'}">${u.RoleName}</span></td>
                <td>${u.OrderCount}</td>
                <td style="font-weight:600">${utils.formatPrice(u.TotalSpent)}</td>
                <td>
                  <span class="badge ${u.Status ? 'badge-active' : 'badge-inactive'}">${u.Status ? 'Hoạt động' : 'Khóa'}</span>
                </td>
                <td>
                  ${u.RoleName !== 'Admin' ? `
                    <button class="btn btn-sm ${u.Status ? 'btn-danger' : 'btn-success'}"
                            onclick="adminToggleUser(${u.UserID}, ${u.Status ? 'false' : 'true'})">
                      ${u.Status ? '🔒 Khóa' : '🔓 Mở'}
                    </button>
                  ` : '<span style="color:var(--text-muted);font-size:0.8rem">—</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${err.message}</h3></div>`;
  }
}

window.adminToggleUser = async function (userId, status) {
  const action = status ? 'mở khóa' : 'khóa';
  if (!confirm(`Bạn có chắc muốn ${action} tài khoản này?`)) return;

  try {
    await api.put(`/admin/users/${userId}/status`, { status });
    toast.success(`Đã ${action} tài khoản`);
    adminUsers();
  } catch (err) {
    toast.error(err.message);
  }
};

// ─── Admin Revenue ────────────────────────────────────────
async function adminRevenue() {
  const el = document.getElementById('adminContent');
  try {
    const data = await api.get('/admin/revenue');

    el.innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="card stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${utils.formatPrice(data.summary.totalRevenue)}</div>
          <div class="stat-label">Tổng doanh thu</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${data.summary.totalOrders}</div>
          <div class="stat-label">Đơn hàng hoàn thành</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">📱</div>
          <div class="stat-value">${data.summary.totalItems}</div>
          <div class="stat-label">Sản phẩm đã bán</div>
        </div>
      </div>

      <div class="glass-card">
        <h3 style="margin-bottom:var(--space-lg)">📊 Doanh thu theo ngày</h3>
        ${data.report.length === 0 ? '<p style="color:var(--text-muted)">Chưa có dữ liệu doanh thu</p>' : `
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Số đơn hàng</th>
                  <th>Số sản phẩm</th>
                  <th>Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                ${data.report.map(r => `
                  <tr>
                    <td>${utils.formatDateShort(r.ReportDate)}</td>
                    <td>${r.TotalOrders}</td>
                    <td>${r.TotalItemsSold}</td>
                    <td style="font-weight:700;color:var(--success)">${utils.formatPrice(r.TotalRevenue)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${err.message}</h3></div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════
function renderProductCards(products) {
  if (!products || products.length === 0) {
    return '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📦</div><h3>Không có sản phẩm</h3></div>';
  }

  return products.map(p => {
    const imgSrc = p.Image ? `/images/${p.Image}` : '';
    const stockClass = p.StockQuantity <= 0 ? 'out' : (p.StockQuantity <= 5 ? 'low' : '');

    return `
      <div class="card product-card" onclick="router.navigate('/product/${p.ProductID}')">
        <div class="product-image">
          ${imgSrc ? `<img src="${imgSrc}" alt="${utils.escapeHtml(p.ProductName)}" loading="lazy">` : '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:3rem">📦</div>'}
        </div>
        <div class="product-info">
          <div class="product-category">${utils.escapeHtml(p.CategoryName)}</div>
          <div class="product-name">${utils.escapeHtml(p.ProductName)}</div>
          <div class="product-price">${utils.formatPrice(p.Price)}</div>
          <div class="product-stock ${stockClass}">${p.StockQuantity <= 0 ? 'Hết hàng' : `Còn ${p.StockQuantity} sản phẩm`}</div>
        </div>
      </div>
    `;
  }).join('');
}
