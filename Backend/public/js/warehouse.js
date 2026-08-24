// warehouse.js
async function loadWarehouse(container) {
    container.innerHTML = `<div class="table-container"><h3>Warehouse Management</h3><p>Loading warehouse zones...</p></div>`;
    try {
        const zones = await apiRequest('/api/warehouse/zones');
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
    } catch (error) {
        container.innerHTML = `<p>Error loading warehouse: ${error.message}</p>`;
    }
}