// public/js/inbound.js - COMPLETE WORKING VERSION

console.log('✅ inbound.js loaded');

// =====================================================
// LOAD INBOUND PAGE
// =====================================================

async function loadInbound(container) {
    console.log('📦 loadInbound called');
    container.innerHTML = `
        <div class="table-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3>Inbound Orders</h3>
                <button class="btn btn-primary" onclick="showCreateInbound()">+ New Inbound</button>
            </div>
            <table>
                <thead>
                    <tr><th>Order #</th><th>Supplier</th><th>Status</th><th>Date</th><th>Actions</th></tr>
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
    console.log('📋 loadInboundOrders called');
    try {
        const orders = await apiRequest('/api/inbound');
        console.log('📦 Orders received:', orders);
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
                    ${o.status === 'pending' || o.status === 'partial' ? 
                        `<button class="btn btn-success btn-sm" onclick="showReceiveInbound(${o.id})">Receive</button>` : ''}
                    <button class="btn btn-info btn-sm" onclick="viewInbound(${o.id})">View</button>
                </td>
            </tr>
        `).join('');
        console.log('✅ Inbound orders displayed');
    } catch (error) {
        console.error('❌ Error loading inbound orders:', error);
        document.getElementById('inboundTableBody').innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
    }
}

// =====================================================
// SHOW CREATE INBOUND
// =====================================================

async function showCreateInbound() {
    console.log('➕ showCreateInbound called');
    try {
        const [suppliers, products] = await Promise.all([
            apiRequest('/api/suppliers'),
            apiRequest('/api/products')
        ]);

        console.log('📋 Suppliers:', suppliers);
        console.log('📦 Products:', products);

        if (!suppliers || suppliers.length === 0) {
            alert('⚠️ Please add a supplier first!');
            return;
        }
        if (!products || products.length === 0) {
            alert('⚠️ Please add products first!');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'inboundModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Create Inbound Order</h2>
                    <span class="modal-close" onclick="document.getElementById('inboundModal').remove()">&times;</span>
                </div>
                <form id="createInboundForm" onsubmit="createInbound(event)">
                    <div class="form-group">
                        <label>Supplier *</label>
                        <select class="form-control" id="inboundSupplier" required>
                            <option value="">Select Supplier</option>
                            ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
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
                            <div class="inbound-item" style="display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
                                <select class="form-control" style="flex:2; min-width:150px;" id="itemProduct_0">
                                    <option value="">Select Product</option>
                                    ${products.map(p => `<option value="${p.id}">${p.id} - ${p.name}</option>`).join('')}
                                </select>
                                <input type="number" class="form-control" placeholder="Qty" style="flex:1; min-width:80px;" id="itemQty_0" min="1">
                                <input type="number" class="form-control" placeholder="Unit Cost" style="flex:1; min-width:100px;" id="itemCost_0" step="0.01">
                                <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.inbound-item').remove()">✕</button>
                            </div>
                        </div>
                        <button type="button" class="btn btn-primary btn-sm" onclick="addInboundItem()">+ Add Item</button>
                    </div>
                    <button type="submit" class="btn btn-success" style="margin-top:15px;">Create Order</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        console.log('✅ Modal created successfully');

    } catch (error) {
        console.error('❌ Error in showCreateInbound:', error);
        alert('Error loading form: ' + error.message);
    }
}

// =====================================================
// ADD INBOUND ITEM
// =====================================================

let itemCounter = 0;

function addInboundItem() {
    console.log('➕ addInboundItem called');
    itemCounter++;
    const container = document.getElementById('inboundItems');
    if (!container) {
        console.error('❌ inboundItems container not found!');
        return;
    }
    const div = document.createElement('div');
    div.className = 'inbound-item';
    div.style.cssText = 'display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap;';
    div.innerHTML = `
        <input type="text" class="form-control" placeholder="Product ID" style="flex:2; min-width:150px;" id="itemProduct_${itemCounter}">
        <input type="number" class="form-control" placeholder="Qty" style="flex:1; min-width:80px;" id="itemQty_${itemCounter}" min="1">
        <input type="number" class="form-control" placeholder="Unit Cost" style="flex:1; min-width:100px;" id="itemCost_${itemCounter}" step="0.01">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.inbound-item').remove()">✕</button>
    `;
    container.appendChild(div);
    console.log('✅ Item added');
}

// =====================================================
// CREATE INBOUND ORDER
// =====================================================

async function createInbound(e) {
    e.preventDefault();
    console.log('📝 createInbound called');

    try {
        const supplier_id = document.getElementById('inboundSupplier').value;
        const expected_date = document.getElementById('inboundExpectedDate').value;
        const notes = document.getElementById('inboundNotes').value;

        if (!supplier_id) {
            alert('Please select a supplier');
            return;
        }

        const itemElements = document.querySelectorAll('.inbound-item');
        const items = [];
        itemElements.forEach((el) => {
            const productInput = el.querySelector('select') || el.querySelector('input[placeholder="Product ID"]');
            const qtyInput = el.querySelector('input[placeholder="Qty"]');
            const costInput = el.querySelector('input[placeholder="Unit Cost"]');
            
            const product_id = productInput ? productInput.value : '';
            const quantity = qtyInput ? parseInt(qtyInput.value) : 0;
            const unit_cost = costInput ? parseFloat(costInput.value) : 0;

            if (product_id && quantity > 0) {
                items.push({ 
                    product_id: parseInt(product_id), 
                    quantity, 
                    unit_cost: unit_cost || 0 
                });
            }
        });

        if (items.length === 0) {
            alert('Please add at least one valid item');
            return;
        }

        const data = {
            supplier_id: parseInt(supplier_id),
            expected_date: expected_date || null,
            notes: notes || '',
            items: items,
            created_by: 1
        };

        console.log('📤 Sending:', data);
        const result = await apiRequest('/api/inbound', 'POST', data);
        console.log('✅ Result:', result);

        alert('✅ Inbound order created successfully!');
        document.getElementById('inboundModal')?.remove();
        await loadInboundOrders();

    } catch (error) {
        console.error('❌ Error creating inbound:', error);
        alert('❌ Error: ' + error.message);
    }
}

// =====================================================
// SHOW RECEIVE INBOUND - FIXED
// =====================================================

async function showReceiveInbound(orderId) {
    console.log('📦 showReceiveInbound called:', orderId);
    try {
        const [order, items] = await Promise.all([
            apiRequest(`/api/inbound/${orderId}`),
            apiRequest(`/api/inbound/${orderId}/items`)
        ]);

        console.log('📋 Order:', order);
        console.log('📦 Items:', items);

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'receiveModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Receive: ${order.order_number}</h2>
                    <span class="modal-close" onclick="document.getElementById('receiveModal').remove()">&times;</span>
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
                            ${items && items.length > 0 ? items.map((item, idx) => `
                                <div class="receive-item" style="display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap; align-items:center;">
                                    <span style="flex:2;">${item.product_name || 'Product ' + item.product_id}</span>
                                    <span style="flex:1;">Expected: ${item.expected_quantity}</span>
                                    <span style="flex:1;">Received: ${item.received_quantity || 0}</span>
                                    <input type="number" class="form-control" placeholder="Qty to receive" style="flex:1; min-width:100px;" 
                                           id="receiveQty_${idx}" min="0" max="${item.expected_quantity - (item.received_quantity || 0)}">
                                    <input type="hidden" value="${item.product_id}">
                                </div>
                            `).join('') : '<p>No items</p>'}
                        </div>
                    </div>
                    <button type="submit" class="btn btn-success">Receive Items</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error showing receive:', error);
        alert('Error loading receive: ' + error.message);
    }
}

// =====================================================
// RECEIVE INBOUND - FIXED
// =====================================================

async function receiveInbound(e, orderId) {
    e.preventDefault();
    console.log('📦 receiveInbound called:', orderId);
    
    try {
        const received_by = document.getElementById('receivedBy').value;
        
        // Collect items with quantities
        const itemElements = document.querySelectorAll('.receive-item');
        const items = [];
        
        itemElements.forEach((el, idx) => {
            const productId = el.querySelector('input[type="hidden"]').value;
            const qtyInput = document.getElementById(`receiveQty_${idx}`);
            const quantity_received = parseInt(qtyInput?.value || 0);
            
            if (quantity_received > 0) {
                items.push({ 
                    product_id: parseInt(productId), 
                    quantity_received: quantity_received,
                    location_id: 1  // Default location
                });
            }
        });

        if (items.length === 0) {
            alert('Please enter quantities to receive');
            return;
        }

        console.log('📤 Receiving items:', items);
        console.log('📤 Received by:', received_by);

        const result = await apiRequest(`/api/inbound/${orderId}/receive`, 'PUT', { 
            items: items, 
            received_by: received_by 
        });
        
        console.log('✅ Result:', result);

        alert('✅ Items received successfully!');
        document.getElementById('receiveModal')?.remove();
        await loadInboundOrders();

    } catch (error) {
        console.error('❌ Error receiving:', error);
        alert('❌ Error: ' + error.message);
    }
}

// =====================================================
// VIEW INBOUND ORDER
// =====================================================

async function viewInbound(orderId) {
    console.log('👁️ viewInbound called:', orderId);
    try {
        const order = await apiRequest(`/api/inbound/${orderId}`);
        const items = await apiRequest(`/api/inbound/${orderId}/items`);
        
        let message = `📋 Order ${order.order_number}\n`;
        message += `Supplier: ${order.supplier_name}\n`;
        message += `Status: ${order.status}\n`;
        message += `Items:\n`;
        if (items && items.length > 0) {
            items.forEach(item => {
                message += `  - ${item.product_name}: ${item.expected_quantity} expected, ${item.received_quantity || 0} received\n`;
            });
        }
        alert(message);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// =====================================================
// EXPOSE GLOBALLY
// =====================================================

window.loadInbound = loadInbound;
window.showCreateInbound = showCreateInbound;
window.createInbound = createInbound;
window.addInboundItem = addInboundItem;
window.showReceiveInbound = showReceiveInbound;
window.receiveInbound = receiveInbound;
window.viewInbound = viewInbound;
window.loadInboundOrders = loadInboundOrders;

console.log('✅ inbound.js fully loaded and functions exposed');