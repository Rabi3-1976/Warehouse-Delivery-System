// app.js - Main application

let token = null;
let currentUser = null;

// API helper
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(endpoint, options);
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'API request failed');
        }
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Login
async function login(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Login failed');
        }

        token = result.token;
        currentUser = result.user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));

        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        document.getElementById('userDisplay').textContent = currentUser?.full_name || currentUser?.username || 'User';
        showPage('dashboard');
    } catch (error) {
        document.getElementById('loginError').textContent = error.message;
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    currentUser = null;
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

// Show page
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

// Load settings
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

// Utility functions
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

// Check session
function checkSession() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
        token = savedToken;
        currentUser = JSON.parse(savedUser);
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        document.getElementById('userDisplay').textContent = currentUser?.full_name || currentUser?.username || 'User';
        showPage('dashboard');
        return true;
    }
    return false;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!checkSession()) {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }
});