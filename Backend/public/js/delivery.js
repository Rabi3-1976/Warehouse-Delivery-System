// delivery.js - Delivery management

async function loadDelivery(container) {
    container.innerHTML = `
        <div class="stats-grid" id="deliveryStats">
            <div class="stat-card"><h3>Pending Deliveries</h3><div class="value" id="deliveryPending">Loading...</div></div>
            <div class="stat-card"><h3>In Transit</h3><div class="value" id="deliveryInTransit">Loading...</div></div>
            <div class="stat-card"><h3>Delivered Today</h3><div class="value" id="deliveryToday">Loading...</div></div>
            <div class="stat-card"><h3>Active Drivers</h3><div class="value" id="deliveryDrivers">Loading...</div></div>
        </div>
        <div style="margin: 15px 0;">
            <button class="btn btn-primary" onclick="showCreateDelivery()">+ Create Delivery Route</button>
            <button class="btn btn-success" onclick="showAddDriver()">+ Add Driver</button>
        </div>
        <div class="table-container">
            <h3>Delivery Routes</h3>
            <table>
                <thead>
                    <tr>
                        <th>Route ID</th>
                        <th>Driver</th>
                        <th>Order #</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="deliveryTableBody">
                    <tr><td colspan="6">Loading...</td></tr>
                </tbody>
            </table>
        </div>
        <div class="table-container" style="margin-top:20px;">
            <h3>Drivers</h3>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Vehicle</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="driversTableBody">
                    <tr><td colspan="5">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    await loadDeliveryStats();
    await loadDeliveryRoutes();
    await loadDrivers();
}

async function loadDeliveryStats() {
    try {
        const stats = await apiRequest('/delivery/stats');
        document.getElementById('deliveryPending').textContent = stats.pending || 0;
        document.getElementById('deliveryInTransit').textContent = stats.in_transit || 0;
        document.getElementById('deliveryToday').textContent = stats.delivered_today || 0;
        document.getElementById('deliveryDrivers').textContent = stats.active_drivers || 0;
    } catch (error) {
        console.error('Error loading delivery stats:', error);
    }
}

async function loadDeliveryRoutes() {
    try {
        const routes = await apiRequest('/delivery');
        const tbody = document.getElementById('deliveryTableBody');
        if (!routes || routes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No delivery routes found</td></tr>';
            return;
        }
        tbody.innerHTML = routes.map(r => `
            <tr>
                <td>#${r.id}</td>
                <td>${r.driver_name || 'Unassigned'}</td>
                <td>${r.order_number || '-'}</td>
                <td>${formatDate(r.route_date)}</td>
                <td>${statusBadge(r.status)}</td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="completeDelivery(${r.id})">Complete</button>
                    <button class="btn btn-danger btn-sm" onclick="cancelDelivery(${r.id})">Cancel</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading delivery routes:', error);
    }
}

async function loadDrivers() {
    try {
        const drivers = await apiRequest('/delivery/drivers');
        const tbody = document.getElementById('driversTableBody');
        if (!drivers || drivers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No drivers found</td></tr>';
            return;
        }
        tbody.innerHTML = drivers.map(d => `
            <tr>
                <td>${d.name}</td>
                <td>${d.phone || '-'}</td>
                <td>${d.vehicle_type || '-'} (${d.vehicle_plate || '-'})</td>
                <td><span class="badge badge-${d.status === 'available' ? 'completed' : 'pending'}">${d.status}</span></td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="toggleDriverStatus(${d.id}, '${d.status === 'available' ? 'busy' : 'available'}')">
                        ${d.status === 'available' ? 'Set Busy' : 'Set Available'}
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading drivers:', error);
    }
}

function showCreateDelivery() {
    // This would show a modal to create a delivery route
    alert('Create delivery route functionality - Would open modal with:\n- Select outbound order\n- Assign driver\n- Set date');
}

function showAddDriver() {
    // This would show a modal to add a driver
    alert('Add driver functionality - Would open modal with:\n- Name\n- Phone\n- License\n- Vehicle details');
}

async function completeDelivery(id) {
    if (!confirm('Mark this delivery as completed?')) return;
    try {
        await apiRequest(`/delivery/${id}/complete`, 'PUT');
        alert('Delivery completed!');
        loadDelivery(document.getElementById('page-content'));
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function cancelDelivery(id) {
    if (!confirm('Cancel this delivery?')) return;
    try {
        await apiRequest(`/delivery/${id}/cancel`, 'PUT');
        alert('Delivery cancelled!');
        loadDelivery(document.getElementById('page-content'));
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function toggleDriverStatus(id, newStatus) {
    try {
        await apiRequest(`/delivery/drivers/${id}/status`, 'PUT', { status: newStatus });
        alert('Driver status updated!');
        loadDelivery(document.getElementById('page-content'));
    } catch (error) {
        alert('Error: ' + error.message);
    }
}