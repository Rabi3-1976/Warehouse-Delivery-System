// dashboard.js - FIXED

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
        console.log('📊 Stats received:', stats);
        
        document.getElementById('statProducts').textContent = stats.total_products || 0;
        document.getElementById('statInbound').textContent = stats.pending_inbound || 0;
        document.getElementById('statOutbound').textContent = stats.pending_outbound || 0;
        document.getElementById('statDeliveries').textContent = stats.pending_deliveries || 0;
        document.getElementById('statLowStock').textContent = stats.low_stock_items || 0;
        
        // FIX: Ensure inventory_value is a number
        const invValue = parseFloat(stats.inventory_value) || 0;
        document.getElementById('statInventoryValue').textContent = '$' + invValue.toFixed(2);
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
        container.innerHTML = '<p style="color:#888;">No low stock items</p>';
    }
}

// EXPOSE GLOBALLY
window.loadDashboard = loadDashboard;
window.loadDashboardStats = loadDashboardStats;