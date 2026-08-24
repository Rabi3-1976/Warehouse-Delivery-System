// Add this function to load products into dropdown
async function loadProductOptions() {
    try {
        const products = await apiRequest('/api/products');
        const container = document.getElementById('inboundProductSelect');
        if (container) {
            container.innerHTML = products.map(p => `
                <option value="${p.id}">${p.id} - ${p.name} (${p.sku})</option>
            `).join('');
        }
        return products;
    } catch (error) {
        console.error('Error loading products:', error);
        return [];
    }
}

// Update the addInboundItem function to use dropdown
function addInboundItemWithDropdown(products) {
    const container = document.getElementById('inboundItems');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'inbound-item';
    itemDiv.style.cssText = 'display:flex; gap:10px; margin-bottom:10px; align-items:center;';
    itemDiv.innerHTML = `
        <select class="form-control" style="flex:1;">
            <option value="">Select Product</option>
            ${products.map(p => `
                <option value="${p.id}">${p.id} - ${p.name} (${p.sku})</option>
            `).join('')}
        </select>
        <input type="number" class="form-control" placeholder="Qty" style="width:100px;">
        <input type="number" class="form-control" placeholder="Unit Cost" style="width:120px;" step="0.01">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.inbound-item').remove()">✕</button>
    `;
    container.appendChild(itemDiv);
}

// Update the showCreateInbound function
async function showCreateInbound() {
    try {
        const [suppliers, products] = await Promise.all([
            apiRequest('/api/suppliers'),
            apiRequest('/api/products')
        ]);

        if (!products || products.length === 0) {
            alert('⚠️ No products found! Please add products first.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Create Inbound Order</h2>
                    <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <form id="createInboundForm" onsubmit="createInbound(event)">
                    <div class="form-group">
                        <label>Supplier *</label>
                        <select class="form-control" id="inboundSupplier" required>
                            <option value="">Select Supplier</option>
                            ${suppliers.map(s => `
                                <option value="${s.id}">${s.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Expected Date</label>
                        <input type="date" class="form-control" id="inboundExpectedDate">
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <textarea class="form-control" id="inboundNotes" rows="2"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Items</label>
                        <div id="inboundItems">
                            <div class="inbound-item" style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                                <select class="form-control" style="flex:1;">
                                    <option value="">Select Product</option>
                                    ${products.map(p => `
                                        <option value="${p.id}">${p.id} - ${p.name} (${p.sku})</option>
                                    `).join('')}
                                </select>
                                <input type="number" class="form-control" placeholder="Qty" style="width:100px;" min="1">
                                <input type="number" class="form-control" placeholder="Unit Cost" style="width:120px;" step="0.01">
                                <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.inbound-item').remove()">✕</button>
                            </div>
                        </div>
                        <button type="button" class="btn btn-primary btn-sm" onclick="addInboundItem()">+ Add Item</button>
                    </div>
                    <button type="submit" class="btn btn-success">Create Order</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error loading data: ' + error.message);
    }
}

// Update addInboundItem function
function addInboundItem() {
    const container = document.getElementById('inboundItems');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'inbound-item';
    itemDiv.style.cssText = 'display:flex; gap:10px; margin-bottom:10px; align-items:center;';
    itemDiv.innerHTML = `
        <input type="text" class="form-control" placeholder="Product ID (from products table)" style="flex:1;">
        <input type="number" class="form-control" placeholder="Qty" style="width:100px;" min="1">
        <input type="number" class="form-control" placeholder="Unit Cost" style="width:120px;" step="0.01">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.inbound-item').remove()">✕</button>
    `;
    container.appendChild(itemDiv);
}
