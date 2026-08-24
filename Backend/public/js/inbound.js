// inbound.js
async function loadInbound(container) {
    container.innerHTML = `<div class="table-container"><h3>Inbound Management</h3><p>Loading inbound orders...</p></div>`;
    try {
        const orders = await apiRequest('/api/inbound');
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
    } catch (error) {
        container.innerHTML = `<p>Error loading inbound orders: ${error.message}</p>`;
    }
}