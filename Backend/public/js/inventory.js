// inventory.js
async function loadInventory(container) {
    container.innerHTML = `<div class="table-container"><h3>Inventory Management</h3><p>Loading inventory...</p></div>`;
    try {
        const items = await apiRequest('/api/inventory');
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
    } catch (error) {
        container.innerHTML = `<p>Error loading inventory: ${error.message}</p>`;
    }
}