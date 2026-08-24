// delivery.js
async function loadDelivery(container) {
    container.innerHTML = `<div class="table-container"><h3>Delivery Management</h3><p>Loading deliveries...</p></div>`;
    try {
        const routes = await apiRequest('/api/delivery');
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
    } catch (error) {
        container.innerHTML = `<p>Error loading deliveries: ${error.message}</p>`;
    }
}