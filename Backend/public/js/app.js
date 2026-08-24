// app.js - Main application controller

// State
let currentUser = null;
let token = null;
let currentPage = 'dashboard';

// API Helper
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`/api${endpoint}`, options);
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

// Show page
function showPage(page) {
    currentPage = page;
    document.getElementById('page-title').textContent = page.charAt(0).toUpperCase() + page.slice(1);
    
    // Update active menu
    document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));
    document.querySelector(`.sidebar-menu a[onclick*="${page}"]`)?.classList.add('active');

    // Load page content
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

// Load settings page
function loadSettings(container) {
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Users</h3>
                <div class="value" id="totalUsers">0</div>
            </div>
        </div>
        <div class="table-container">
            <h3>User Management</h3>
            <div style="margin: 15px 0;">
                <button class="btn btn-primary" onclick="showCreateUser()">+ Add User</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Full Name</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="usersTableBody">
                    <tr><td colspan="6">Loading...</td></tr>
                </tbody>
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
            tbody.innerHTML = '<tr><td colspan="6">No users found</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.full_name || '-'}</td>
                <td><span class="badge badge-${u.role === 'admin' ? 'processing' : 'pending'}">${u.role}</span></td>
                <td>${u.email || '-'}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Delete</button>
                </td>
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
                <div class="form-group">
                    <label>Username *</label>
                    <input type="text" class="form-control" id="username" required>
                </div>
                <div class="form-group">
                    <label>Password *</label>
                    <input type="password" class="form-control" id="password" required>
                </div>
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" class="form-control" id="fullName">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" class="form-control" id="email">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="text" class="form-control" id="phone">
                </div>
                <div class="form-group">
                    <label>Role</label>
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
            phone: document.getElementById('phone').value,
            role: document.getElementById('role').value
        };
        await apiRequest('/create-user', 'POST', data);
        alert('User created successfully!');
        document.querySelector('.modal.active')?.remove();
        loadUsers();
    } catch (error) {
        alert('Error creating user: ' + error.message);
    }
}

// Login
async function login() {
    const username = document.getElementById('loginUsername')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }

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
        
        document.getElementById('loginPage')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
        showPage('dashboard');
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    currentUser = null;
    location.reload();
}

// Check for existing session
function checkSession() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
        token = savedToken;
        currentUser = JSON.parse(savedUser);
        document.getElementById('loginPage')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
        showPage('dashboard');
        return true;
    }
    return false;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!checkSession()) {
        document.getElementById('app')?.classList.add('hidden');
        document.getElementById('loginPage')?.classList.remove('hidden');
    }
});

// Global modal helper
function closeModal(modal) {
    if (modal) modal.remove();
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
        'partial': 'badge-warning'
    };
    return `<span class="badge ${map[status] || 'badge-pending'}">${status}</span>`;
}