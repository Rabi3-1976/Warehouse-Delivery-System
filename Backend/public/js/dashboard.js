// dashboard.js - Dashboard functionality

async function loadDashboard(container) {
    container.innerHTML = `
        <div class="stats-grid" id="dashboardStats">
            <div class="stat-card"><h3>📦 Total Products</h3><div class="value" id="statProducts">Loading...</div></div>
            <div class="stat-card"><h3>📥 Inbound Orders</h3><div class="value" id="statInbound">Loading...</div></div>
            <div class="stat-card"><h3>📤 Outbound Orders</h3><div class="value" id="statOutbound">Loading...</div></div>
            <div class="stat-card"><h3>🚚 Pending Deliveries</h3><div class="value" id="statDeliveries">Loading...</div></div>
            <div class="stat-card"><h3>⚠️ Low Stock</h3><div class="value" id="statLowStock">Loading...</div></div>
            <div class="stat-card"><h3>📈 Total Inventory Value</h3><div class="value" id="statInventoryValue">Loading...</div></div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
            <div class="table-container">
                <h3>Recent Inbound Orders</h3>
                <div id="recentInbound">Loading...</div>
            </div>
            <div class="table-container">
                <h3>Recent Outbound Orders</h3>
                <div id="recentOutbound">Loading...</div>
            </div>
        </div>
        <div class="table-container" style="margin-top:20px;">
            <h3>Low Stock Alert</h3>
            <div id="lowStockAlert">Loading...</div>
        </div>
    `;

    await loadDashboardStats();
    await loadRecentInbound();
    await loadRecentOutbound();
    await loadLowStockAlert();
}

async function loadDashboardStats() {
    try {
        const stats = await apiRequest('/reports/dashboard-stats');
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
        const orders = await apiRequest('/inbound?limit=5');
        const container = document.getElementById('recentInbound');
        if (!orders || orders.length === 0) {
            container.innerHTML = '<p>No inbound orders</p>';
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Order #</th><th>Supplier</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                    ${orders.map(o => `
                        <tr>
                            <td>${o.order_number}</td>
                            <td>${o.supplier_name || '-'}</td>
                            <td>${statusBadge(o.status)}</td>
                            <td>${formatDate(o.created_at)}</td>
                        </tr>
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
        const orders = await apiRequest('/outbound?limit=5');
        const container = document.getElementById('recentOutbound');
        if (!orders || orders.length === 0) {
            container.innerHTML = '<p>No outbound orders</p>';
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Order #</th><th>Customer</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                    ${orders.map(o => `
                        <tr>
                            <td>${o.order_number}</td>
                            <td>${o.customer_name || '-'}</td>
                            <td>${statusBadge(o.status)}</td>
                            <td>${formatDate(o.created_at)}</td>
                        </tr>
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
        const items = await apiRequest('/inventory/low-stock');
        const container = document.getElementById('lowStockAlert');
        if (!items || items.length === 0) {
            container.innerHTML = '<p style="color: green;">✅ All items are at healthy stock levels</p>';
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Product</th><th>SKU</th><th>Current Stock</th><th>Min Stock</th><th>Status</th></tr></thead>
                <tbody>
                    ${items.map(i => `
                        <tr style="background: #fff3e0;">
                            <td>${i.product_name}</td>
                            <td>${i.sku}</td>
                            <td><strong>${i.quantity}</strong></td>
                            <td>${i.min_stock}</td>
                            <td><span class="badge badge-pending">⚠️ Low Stock</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading low stock alert:', error);
    }
}