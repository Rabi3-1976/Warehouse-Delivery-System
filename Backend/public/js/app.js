// app.js - Complete Fixed Version
// =====================================================
// STATE (single declaration)
// =====================================================

let authToken = null;  // Changed from 'token' to avoid conflicts
let currentUser = null;

// =====================================================
// LOGIN FUNCTION
// =====================================================

async function login(e) {
    if (e) e.preventDefault();
    
    const username = document.getElementById('loginUsername')?.value;
    const password = document.getElementById('loginPassword')?.value;

    console.log('🔐 Login attempt for:', username);

    if (!username || !password) {
        document.getElementById('loginError').textContent = 'Please enter username and password';
        return;
    }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();
        console.log('📡 Response:', result);

        if (!response.ok) {
            throw new Error(result.error || 'Login failed');
        }

        if (!result.token) {
            throw new Error('No token received');
        }

        authToken = result.token;
        currentUser = result.user;

        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(currentUser));

        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        document.getElementById('userDisplay').textContent = currentUser?.full_name || currentUser?.username || 'User';

        console.log('✅ Login successful!');
        showPage('dashboard');

    } catch (error) {
        console.error('❌ Login error:', error);
        const errorEl = document.getElementById('loginError');
        if (errorEl) errorEl.textContent = error.message;
    }
}

// =====================================================
// LOGOUT FUNCTION
// =====================================================

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    authToken = null;
    currentUser = null;
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

// =====================================================
// API HELPER
// =====================================================

async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(endpoint, options);
    const result = await response.json();
    
    if (!response.ok) {
        throw new Error(result.error || 'API request failed');
    }
    return result;
}

// =====================================================
// PAGE LOADING FUNCTIONS
// =====================================================

function showPage(page) {
    document.getElementById('page-title').textContent = page.charAt(0).toUpperCase() + page.slice(1);

    document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));
    const link = document.querySelector(`.sidebar-menu a[onclick*="${page}"]`);
    if (link) link.classList.add('active');

    const content = document.getElementById('page-content');

    switch(page) {
        case 'dashboard': loadDashboard(content); break;
        case 'inbound': loadInbound(content); break;
        case 'outbound': loadOutbound(content); break;
        case 'inventory': loadInventory(content); break;
        case 'delivery': loadDelivery(content); break;
        case 'warehouse': loadWarehouse(content); break;
        case 'reports': loadReports(content); break;
        case 'settings': loadSettings(content); break;
        default: content.innerHTML = '<h2>Page not found</h2>';
    }
}

// =====================================================
// CHECK SESSION
// =====================================================

function checkSession() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        document.getElementById('userDisplay').textContent = currentUser?.full_name || currentUser?.username || 'User';
        showPage('dashboard');
        return true;
    }
    return false;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function statusBadge(status) {
    const map = {
        'pending': 'badge-pending',
        'processing': 'badge-processing',
        'completed': 'badge-completed',
        'delivered': 'badge-delivered',
        'cancelled': 'badge-cancelled',
        'partial': 'badge-warning',
        'picked': 'badge-processing',
        'shipped': 'badge-processing',
        'in_progress': 'badge-processing',
        'scheduled': 'badge-pending',
        'in_delivery': 'badge-processing'
    };
    return `<span class="badge ${map[status] || 'badge-pending'}">${status}</span>`;
}

// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard(container) {
    container.innerHTML = `
        <div class="stats-grid" id="dashboardStats">
            <div class="stat-card"><div class="icon">📦</div><div class="value" id="statProducts">...</div><div class="label">Total Products</div></div>
            <div class="stat-card"><div class="icon">📥</div><div class="value" id="statInbound">...</div><div class="label">Inbound Orders</div></div>
            <div class="stat-card"><div class="icon">📤</div><div class="value" id="statOutbound">...</div><div class="label">Outbound Orders</div></div>
            <div class="stat-card"><div class="icon">🚚</div><div class="value" id="statDeliveries">...</div><div class="label">Pending Deliveries</div></div>
            <div class="stat-card"><div class="icon">⚠️</div><div class="value" id="statLowStock">...</div><div class="label">Low Stock Items</div></div>
            <div class="stat-card"><div class="icon">💰</div><div class="value" id="statInventoryValue">...</div><div class="label">Inventory Value</div></div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
            <div class="table-container"><h3>Recent Inbound</h3><div id="recentInbound">Loading...</div></div>
            <div class="table-container"><h3>Recent Outbound</h3><div id="recentOutbound">Loading...</div></div>
        </div>
        <div class="table-container"><h3>⚠️ Low Stock Alert</h3><div id="lowStockAlert">Loading...</div></div>
    `;

    try {
        await loadDashboardStats();
        await loadRecentInbound();
        await loadRecentOutbound();
        await loadLowStockAlert();
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

async function loadDashboardStats() {
    try {
        const stats = await apiRequest('/api/reports/dashboard-stats');
        document.getElementById('statProducts').textContent = stats.total_products || 0;
        document.getElementById('statInbound').textContent = stats.pending_inbound || 0;
        document.getElementById('statOutbound').textContent = stats.pending_outbound || 0;
        document.getElementById('statDeliveries').textContent = stats.pending_deliveries || 0;
        document.getElementById('statLowStock').textContent = stats.low_stock_items || 0;
        document.getElementById('statInventoryValue').textContent = '$' + (stats.inventory_value || 0).toFixed(2);
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

async function loadRecentInbound() {
    try {
        const orders = await apiRequest('/api/inbound');
        const container = document.getElementById('recentInbound');
        if (!orders || orders.length === 0) {
            container.innerHTML = '<p style="color:#888;">No inbound orders</p>';
            return;
        }
        const recent = orders.slice(0, 5);
        container.innerHTML = `
            <table>
                <thead><tr><th>Order #</th><th>Supplier</th><th>Status</th></tr></thead>
                <tbody>
                    ${recent.map(o => `
                        <tr><td>${o.order_number}</td><td>${o.supplier_name || '-'}</td><td>${statusBadge(o.status)}</td></tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading recent inbound:', error);
    }
}

async function loadRecentOutbound() {
    try {
        const orders = await apiRequest('/api/outbound');
        const container = document.getElementById('recentOutbound');
        if (!orders || orders.length === 0) {
            container.innerHTML = '<p style="color:#888;">No outbound orders</p>';
            return;
        }
        const recent = orders.slice(0, 5);
        container.innerHTML = `
            <table>
                <thead><tr><th>Order #</th><th>Customer</th><th>Status</th></tr></thead>
                <tbody>
                    ${recent.map(o => `
                        <tr><td>${o.order_number}</td><td>${o.customer_name || '-'}</td><td>${statusBadge(o.status)}</td></tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading recent outbound:', error);
    }
}

async function loadLowStockAlert() {
    try {
        const items = await apiRequest('/api/inventory/low-stock');
        const container = document.getElementById('lowStockAlert');
        if (!items || items.length === 0) {
            container.innerHTML = '<p style="color:green;">✅ All items at healthy stock levels</p>';
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Min Stock</th></tr></thead>
                <tbody>
                    ${items.map(i => `
                        <tr style="background:#fff3e0;">
                            <td>${i.product_name}</td>
                            <td>${i.sku}</td>
                            <td><strong>${i.quantity}</strong></td>
                            <td>${i.min_stock}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading low stock alert:', error);
    }
}

// =====================================================
// SETTINGS
// =====================================================

function loadSettings(container) {
    container.innerHTML = `
        <div class="table-container">
            <h3>User Management</h3>
            <button class="btn btn-primary" onclick="showCreateUser()">+ Add User</button>
            <table>
                <thead><tr><th>ID</th><th>Username</th><th>Full Name</th><th>Role</th><th>Actions</th></tr></thead>
                <tbody id="usersTableBody"><tr><td colspan="5">Loading...</td></tr></tbody>
            </table>
        </div>
    `;
    loadUsers();
}

async function loadUsers() {
    try {
        const users = await apiRequest('/users');
        const tbody = document.getElementById('usersTableBody');
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No users found</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.full_name || '-'}</td>
                <td><span class="badge badge-${u.role === 'admin' ? 'processing' : 'pending'}">${u.role}</span></td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Delete</button></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function showCreateUser() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Create User</h2>
                <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <form id="createUserForm" onsubmit="createUser(event)">
                <div class="form-group"><label>Username *</label><input type="text" class="form-control" id="username" required></div>
                <div class="form-group"><label>Password *</label><input type="password" class="form-control" id="password" required></div>
                <div class="form-group"><label>Full Name</label><input type="text" class="form-control" id="fullName"></div>
                <div class="form-group"><label>Email</label><input type="email" class="form-control" id="email"></div>
                <div class="form-group"><label>Role</label>
                    <select class="form-control" id="role">
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="driver">Driver</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Create User</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function createUser(e) {
    e.preventDefault();
    try {
        const data = {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            full_name: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            role: document.getElementById('role').value
        };
        await apiRequest('/create-user', 'POST', data);
        alert('User created successfully!');
        document.querySelector('.modal.active')?.remove();
        loadUsers();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function deleteUser(id) {
    if (!confirm('Delete this user?')) return;
    try {
        await apiRequest(`/users/${id}`, 'DELETE');
        loadUsers();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// =====================================================
// PLACEHOLDER PAGE LOADERS
// =====================================================

function loadInbound(container) {
    container.innerHTML = `<div class="table-container"><h3>Inbound Management</h3><p>Loading inbound orders...</p></div>`;
    apiRequest('/api/inbound').then(orders => {
        container.innerHTML = `
            <div class="table-container">
                <h3>Inbound Orders</h3>
                <button class="btn btn-primary" onclick="alert('Create inbound order')">+ New Inbound</button>
                <table>
                    <thead><tr><th>Order #</th><th>Supplier</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                        ${orders && orders.length > 0 ? orders.map(o => `
                            <tr><td>${o.order_number}</td><td>${o.supplier_name || '-'}</td><td>${statusBadge(o.status)}</td><td>${formatDate(o.created_at)}</td></tr>
                        `).join('') : '<tr><td colspan="4">No inbound orders</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }).catch(err => {
        container.innerHTML = `<p>Error: ${err.message}</p>`;
    });
}

function loadOutbound(container) {
    container.innerHTML = `<div class="table-container"><h3>Outbound Management</h3><p>Loading outbound orders...</p></div>`;
    apiRequest('/api/outbound').then(orders => {
        container.innerHTML = `
            <div class="table-container">
                <h3>Outbound Orders</h3>
                <button class="btn btn-primary" onclick="alert('Create outbound order')">+ New Outbound</button>
                <table>
                    <thead><tr><th>Order #</th><th>Customer</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                        ${orders && orders.length > 0 ? orders.map(o => `
                            <tr><td>${o.order_number}</td><td>${o.customer_name || '-'}</td><td>${statusBadge(o.status)}</td><td>${formatDate(o.created_at)}</td></tr>
                        `).join('') : '<tr><td colspan="4">No outbound orders</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }).catch(err => {
        container.innerHTML = `<p>Error: ${err.message}</p>`;
    });
}

function loadInventory(container) {
    container.innerHTML = `<div class="table-container"><h3>Inventory Management</h3><p>Loading inventory...</p></div>`;
    apiRequest('/api/inventory').then(items => {
        container.innerHTML = `
            <div class="table-container">
                <h3>Inventory</h3>
                <table>
                    <thead><tr><th>Product</th><th>SKU</th><th>Location</th><th>Quantity</th><th>Status</th></tr></thead>
                    <tbody>
                        ${items && items.length > 0 ? items.map(i => `
                            <tr><td>${i.product_name}</td><td>${i.sku}</td><td>${i.location || '-'}</td><td>${i.quantity}</td><td>${i.quantity <= i.min_stock ? '⚠️ Low' : '✅ OK'}</td></tr>
                        `).join('') : '<tr><td colspan="5">No inventory items</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }).catch(err => {
        container.innerHTML = `<p>Error: ${err.message}</p>`;
    });
}

function loadDelivery(container) {
    container.innerHTML = `<div class="table-container"><h3>Delivery Management</h3><p>Loading deliveries...</p></div>`;
    apiRequest('/api/delivery').then(routes => {
        container.innerHTML = `
            <div class="table-container">
                <h3>Delivery Routes</h3>
                <button class="btn btn-primary" onclick="alert('Create delivery route')">+ New Route</button>
                <table>
                    <thead><tr><th>Driver</th><th>Order</th><th>Date</th><th>Status</th></tr></thead>
                    <tbody>
                        ${routes && routes.length > 0 ? routes.map(r => `
                            <tr><td>${r.driver_name || '-'}</td><td>${r.order_number || '-'}</td><td>${formatDate(r.route_date)}</td><td>${statusBadge(r.status)}</td></tr>
                        `).join('') : '<tr><td colspan="4">No delivery routes</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }).catch(err => {
        container.innerHTML = `<p>Error: ${err.message}</p>`;
    });
}

function loadWarehouse(container) {
    container.innerHTML = `<div class="table-container"><h3>Warehouse Management</h3><p>Loading warehouse zones...</p></div>`;
    apiRequest('/api/warehouse/zones').then(zones => {
        container.innerHTML = `
            <div class="table-container">
                <h3>Warehouse Zones</h3>
                <button class="btn btn-primary" onclick="alert('Create zone')">+ New Zone</button>
                <table>
                    <thead><tr><th>Name</th><th>Code</th><th>Locations</th></tr></thead>
                    <tbody>
                        ${zones && zones.length > 0 ? zones.map(z => `
                            <tr><td>${z.name}</td><td>${z.code}</td><td>${z.location_count || 0}</td></tr>
                        `).join('') : '<tr><td colspan="3">No warehouse zones</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }).catch(err => {
        container.innerHTML = `<p>Error: ${err.message}</p>`;
    });
}

function loadReports(container) {
    container.innerHTML = `
        <div class="table-container">
            <h3>Reports</h3>
            <p>Reports dashboard coming soon...</p>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-top:20px;">
                <div class="stat-card"><div class="icon">📊</div><div class="label">Inbound Report</div></div>
                <div class="stat-card"><div class="icon">📈</div><div class="label">Outbound Report</div></div>
                <div class="stat-card"><div class="icon">🚚</div><div class="label">Delivery Report</div></div>
            </div>
        </div>
    `;
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 App initialized');
    
    // Handle login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', login);
        console.log('✅ Login form attached');
    }

    // Check for saved session
    if (!checkSession()) {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }
});

// =====================================================
// GLOBALLY EXPOSE FUNCTIONS
// =====================================================

// At the bottom of app.js - Ensure all functions are globally accessible
window.login = login;
window.logout = logout;
window.showPage = showPage;
window.apiRequest = apiRequest;
window.formatDate = formatDate;
window.statusBadge = statusBadge;
window.loadDashboard = loadDashboard;
window.loadInbound = loadInbound;
window.loadOutbound = loadOutbound;
window.loadInventory = loadInventory;
window.loadDelivery = loadDelivery;
window.loadWarehouse = loadWarehouse;
window.loadReports = loadReports;
window.loadSettings = loadSettings;
window.showCreateInbound = showCreateInbound;
window.createInbound = createInbound;
window.addInboundItem = addInboundItem;