// outbound.js
async function loadOutbound(container) {
    container.innerHTML = `<div class="table-container"><h3>Outbound Management</h3><p>Loading outbound orders...</p></div>`;
    try {
        const orders = await apiRequest('/api/outbound');
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
    } catch (error) {
        container.innerHTML = `<p>Error loading outbound orders: ${error.message}</p>`;
    }
}