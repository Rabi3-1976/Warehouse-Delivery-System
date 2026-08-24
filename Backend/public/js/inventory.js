// inventory.js - Inventory management

async function loadInventory(container) {
    container.innerHTML = `
        <div style="margin: 15px 0;">
            <input type="text" placeholder="Search products..." oninput="searchInventory(this.value)" class="form-control" style="width:300px;display:inline-block;">
            <button class="btn btn-primary" onclick="showAddProduct()">+ Add Product</button>
            <button class="btn btn-warning" onclick="showCountInventory()">📊 Count Inventory</button>
        </div>
        <div class="table-container">
            <h3>Inventory</h3>
            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Location</th>
                        <th>Quantity</th>
                        <th>Reserved</th>
                        <th>Available</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="inventoryTableBody">
                    <tr><td colspan="8">Loading...</td></tr>
                </tbody>
            </table>
        </div>
        <div class="table-container" style="margin-top:20px;">
            <h3>Inventory Transactions</h3>
            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Reference</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody id="transactionsTableBody">
                    <tr><td colspan="5">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    await loadInventoryItems();
    await loadTransactions();
}

async function loadInventoryItems(search = '') {
    try {
        const url = search ? `/inventory?search=${search}` : '/inventory';
        const items = await apiRequest(url);
        const tbody = document.getElementById('inventoryTableBody');
        if (!items || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No inventory items found</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(i => `
            <tr>
                <td>${i.product_name}</td>
                <td>${i.sku || '-'}</td>
                <td>${i.location || '-'}</td>
                <td><strong>${i.quantity}</strong></td>
                <td>${i.reserved_quantity || 0}</td>
                <td>${i.quantity - (i.reserved_quantity || 0)}</td>
                <td>${(i.quantity || 0) <= (i.min_stock || 0) ? '<span class="badge badge-pending">⚠️ Low</span>' : '<span class="badge badge-completed">✅ OK</span>'}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="showAdjustStock(${i.product_id})">Adjust</button>
                    <button class="btn btn-danger btn-sm" onclick="showMoveStock(${i.product_id})">Move</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading inventory:', error);
    }
}

function searchInventory(query) {
    loadInventoryItems(query);
}

async function loadTransactions() {
    try {
        const transactions = await apiRequest('/inventory/transactions?limit=20');
        const tbody = document.getElementById('transactionsTableBody');
        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No transactions found</td></tr>';
            return;
        }
        tbody.innerHTML = transactions.map(t => `
            <tr>
                <td>${t.product_name || '-'}</td>
                <td><span class="badge badge-${t.transaction_type === 'inbound' ? 'completed' : 'pending'}">${t.transaction_type}</span></td>
                <td>${t.quantity}</td>
                <td>${t.reference_type || '-'}</td>
                <td>${formatDate(t.created_at)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function showAddProduct() {
    // This would show a modal to add a product
    alert('Add product functionality - Would open modal with:\n- Name\n- SKU\n- Description\n- Unit\n- Min/Max stock');
}

function showCountInventory() {
    alert('Inventory counting functionality - Would open counting interface');
}

function showAdjustStock(productId) {
    alert(`Adjust stock for product ID ${productId}`);
}

function showMoveStock(productId) {
    alert(`Move stock for product ID ${productId}`);
}