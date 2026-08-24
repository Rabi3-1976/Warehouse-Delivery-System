// inbound.js - Complete Inbound Management

// =====================================================
// LOAD INBOUND PAGE
// =====================================================

async function loadInbound(container) {
    container.innerHTML = `
        <div class="table-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3>Inbound Orders</h3>
                <button class="btn btn-primary" onclick="showCreateInbound()">+ New Inbound</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Supplier</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="inboundTableBody">
                    <tr><td colspan="5">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    await loadInboundOrders();
}

// =====================================================
// LOAD INBOUND ORDERS
// =====================================================

async function loadInboundOrders() {
    try {
        const orders = await apiRequest('/api/inbound');
        const tbody = document.getElementById('inboundTableBody');
        
        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No inbound orders</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td><strong>${o.order_number}</strong></td>
                <td>${o.supplier_name || '-'}</td>
                <td>${statusBadge(o.status)}</td>
                <td>${formatDate(o.created_at)}</td>
                <td>
                    ${o.status === 'pending' || o.status === 'partial' ? `
                        <button class="btn btn-success btn-sm" onclick="showReceiveInbound(${o.id})">Receive</button>
                    ` : ''}
                    <button class="btn btn-info btn-sm" onclick="viewInbound(${o.id})">View</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading inbound orders:', error);
        document.getElementById('inboundTableBody').innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
    }
}

// =====================================================
// SHOW CREATE INBOUND MODAL
// =====================================================

function showCreateInbound() {
    // First, load suppliers for the dropdown
    apiRequest('/api/suppliers').then(suppliers => {
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
                            ${suppliers && suppliers.length > 0 ? suppliers.map(s => `
                                <option value="${s.id}">${s.name}</option>
                            `).join('') : '<option value="">No suppliers available</option>'}
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
                            <div class="inbound-item" style="display:flex; gap:10px; margin-bottom:10px;">
                                <input type="text" class="form-control" placeholder="Product ID" style="flex:1;">
                                <input type="number" class="form-control" placeholder="Quantity" style="width:100px;">
                                <input type="number" class="form-control" placeholder="Unit Cost" style="width:120px;">
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
    }).catch(err => {
        alert('Error loading suppliers: ' + err.message);
    });
}

// =====================================================
// ADD INBOUND ITEM
// =====================================================

function addInboundItem() {
    const container = document.getElementById('inboundItems');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'inbound-item';
    itemDiv.style.cssText = 'display:flex; gap:10px; margin-bottom:10px;';
    itemDiv.innerHTML = `
        <input type="text" class="form-control" placeholder="Product ID" style="flex:1;">
        <input type="number" class="form-control" placeholder="Quantity" style="width:100px;">
        <input type="number" class="form-control" placeholder="Unit Cost" style="width:120px;">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.inbound-item').remove()">✕</button>
    `;
    container.appendChild(itemDiv);
}

// =====================================================
// CREATE INBOUND ORDER
// =====================================================

async function createInbound(e) {
    e.preventDefault();

    const supplier_id = document.getElementById('inboundSupplier').value;
    const expected_date = document.getElementById('inboundExpectedDate').value;
    const notes = document.getElementById('inboundNotes').value;

    if (!supplier_id) {
        alert('Please select a supplier');
        return;
    }

    // Collect items
    const itemElements = document.querySelectorAll('.inbound-item');
    const items = [];
    itemElements.forEach(el => {
        const inputs = el.querySelectorAll('input');
        const product_id = inputs[0].value;
        const quantity = parseInt(inputs[1].value);
        const unit_cost = parseFloat(inputs[2].value);
        if (product_id && quantity > 0) {
            items.push({ product_id, quantity, unit_cost });
        }
    });

    if (items.length === 0) {
        alert('Please add at least one item');
        return;
    }

    try {
        const result = await apiRequest('/api/inbound', 'POST', {
            supplier_id,
            expected_date,
            notes,
            items,
            created_by: 1 // Default admin
        });

        alert('✅ Inbound order created successfully!');
        document.querySelector('.modal.active')?.remove();
        loadInboundOrders();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// =====================================================
// SHOW RECEIVE INBOUND MODAL
// =====================================================

async function showReceiveInbound(orderId) {
    try {
        // Get order details
        const order = await apiRequest(`/api/inbound/${orderId}`);
        const items = await apiRequest(`/api/inbound/${orderId}/items`);

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Receive Inbound Order: ${order.order_number}</h2>
                    <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <form id="receiveInboundForm" onsubmit="receiveInbound(event, ${orderId})">
                    <p><strong>Supplier:</strong> ${order.supplier_name}</p>
                    <div class="form-group">
                        <label>Received By</label>
                        <input type="text" class="form-control" id="receivedBy" value="Admin" required>
                    </div>
                    <div class="form-group">
                        <label>Items</label>
                        <div id="receiveItems">
                            ${items && items.length > 0 ? items.map(item => `
                                <div class="receive-item" style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                                    <span style="flex:1;">${item.product_name || 'Product ID: ' + item.product_id}</span>
                                    <span style="width:80px;">Expected: ${item.expected_quantity}</span>
                                    <span style="width:80px;">Received: ${item.received_quantity || 0}</span>
                                    <input type="number" class="form-control" placeholder="Qty to receive" style="width:120px;" 
                                           id="receiveQty_${item.product_id}" min="0" max="${item.expected_quantity - (item.received_quantity || 0)}">
                                    <input type="hidden" value="${item.product_id}">
                                </div>
                            `).join('') : '<p>No items found</p>'}
                        </div>
                    </div>
                    <button type="submit" class="btn btn-success">Receive Items</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error loading order: ' + error.message);
    }
}

// =====================================================
// RECEIVE INBOUND ORDER
// =====================================================

async function receiveInbound(e, orderId) {
    e.preventDefault();

    const received_by = document.getElementById('receivedBy').value;

    // Collect received items
    const itemElements = document.querySelectorAll('.receive-item');
    const items = [];
    itemElements.forEach(el => {
        const productId = el.querySelector('input[type="hidden"]').value;
        const qtyInput = el.querySelector(`#receiveQty_${productId}`);
        const quantity_received = parseInt(qtyInput?.value || 0);
        if (quantity_received > 0) {
            items.push({ product_id: parseInt(productId), quantity_received });
        }
    });

    if (items.length === 0) {
        alert('Please enter at least one item to receive');
        return;
    }

    try {
        const result = await apiRequest(`/api/inbound/${orderId}/receive`, 'PUT', {
            items,
            received_by
        });

        alert('✅ Items received successfully!');
        document.querySelector('.modal.active')?.remove();
        loadInboundOrders();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// =====================================================
// VIEW INBOUND ORDER
// =====================================================

async function viewInbound(orderId) {
    try {
        const order = await apiRequest(`/api/inbound/${orderId}`);
        const items = await apiRequest(`/api/inbound/${orderId}/items`);

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Inbound Order: ${order.order_number}</h2>
                    <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <p><strong>Supplier:</strong> ${order.supplier_name || '-'}</p>
                <p><strong>Status:</strong> ${statusBadge(order.status)}</p>
                <p><strong>Expected Date:</strong> ${formatDate(order.expected_date)}</p>
                <p><strong>Received Date:</strong> ${formatDate(order.received_date)}</p>
                <p><strong>Notes:</strong> ${order.notes || '-'}</p>
                <h4>Items</h4>
                <table>
                    <thead><tr><th>Product</th><th>Expected</th><th>Received</th><th>Unit Cost</th></tr></thead>
                    <tbody>
                        ${items && items.length > 0 ? items.map(i => `
                            <tr>
                                <td>${i.product_name || 'Product ID: ' + i.product_id}</td>
                                <td>${i.expected_quantity}</td>
                                <td>${i.received_quantity || 0}</td>
                                <td>$${i.unit_cost || 0}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4">No items</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// =====================================================
// EXPOSE FUNCTIONS GLOBALLY
// =====================================================

window.loadInbound = loadInbound;
window.showCreateInbound = showCreateInbound;
window.createInbound = createInbound;
window.addInboundItem = addInboundItem;
window.showReceiveInbound = showReceiveInbound;
window.receiveInbound = receiveInbound;
window.viewInbound = viewInbound;
window.loadInboundOrders = loadInboundOrders;
