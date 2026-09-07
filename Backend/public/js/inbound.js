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
// RECEIVE INBOUND - FIXED
// =====================================================

async function receiveInbound(e, orderId) {
    e.preventDefault();
    console.log('📦 receiveInbound called:', orderId);
    
    try {
        // Get the user ID from the hidden field
        let receivedByInput = document.getElementById('receivedBy');
        let received_by = 1; // Default to admin
        
        if (receivedByInput) {
            received_by = parseInt(receivedByInput.value) || 1;
        }
        
        console.log('👤 Received by user ID:', received_by);
        
        // Collect items with quantities
        const itemElements = document.querySelectorAll('.receive-item');
        const items = [];
        
        itemElements.forEach((el, idx) => {
            const productId = el.querySelector('input[type="hidden"]')?.value;
            const qtyInput = document.getElementById(`receiveQty_${idx}`);
            const quantity_received = parseInt(qtyInput?.value || 0);
            
            if (productId && quantity_received > 0) {
                items.push({ 
                    product_id: parseInt(productId), 
                    quantity_received: quantity_received,
                    location_id: 12  // Your location ID
                });
            }
        });

        if (items.length === 0) {
            alert('Please enter quantities to receive');
            return;
        }

        console.log('📤 Receiving items:', items);
        console.log('📤 Received by:', received_by);

        // Make sure received_by is a number
        const requestData = { 
            items: items, 
            received_by: received_by  // This must be a number, not a string
        };
        
        console.log('📤 Request data:', requestData);

        const result = await apiRequest(`/api/inbound/${orderId}/receive`, 'PUT', requestData);
        
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

        // Get user info from localStorage
        let userId = 1;
        let userName = 'Admin';
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                userId = user.id || 1;
                userName = user.full_name || user.username || 'Admin';
            }
        } catch (e) {
            console.log('Using default user (Admin)');
        }

        console.log(`👤 User: ${userName} (ID: ${userId})`);

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
                        <input type="text" class="form-control" id="receivedByName" value="${userName}" readonly style="background-color:#f5f5f5;">
                        <input type="hidden" id="receivedBy" value="${userId}">
                        <small style="color:#888; display:block; margin-top:5px;">User ID: ${userId}</small>
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
// EDIT INBOUND ORDER (Admin Only)
// =====================================================

async function editInbound(orderId) {
    console.log('✏️ editInbound called:', orderId);
    
    // Check if user is admin
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin') {
        alert('⚠️ Only admin users can edit orders');
        return;
    }

    try {
        const [order, items, suppliers] = await Promise.all([
            apiRequest(`/api/inbound/${orderId}`),
            apiRequest(`/api/inbound/${orderId}/items`),
            apiRequest('/api/suppliers')
        ]);

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'editInboundModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:700px;">
                <div class="modal-header">
                    <h2>Edit Inbound Order: ${order.order_number}</h2>
                    <span class="modal-close" onclick="document.getElementById('editInboundModal').remove()">&times;</span>
                </div>
                <form id="editInboundForm" onsubmit="saveInbound(event, ${orderId})">
                    <div class="form-group">
                        <label>Supplier *</label>
                        <select class="form-control" id="editSupplier" required>
                            ${suppliers.map(s => `
                                <option value="${s.id}" ${s.id === order.supplier_id ? 'selected' : ''}>${s.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Expected Date</label>
                        <input type="date" class="form-control" id="editExpectedDate" value="${order.expected_date ? order.expected_date.split('T')[0] : ''}">
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <textarea class="form-control" id="editNotes" rows="2">${order.notes || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select class="form-control" id="editStatus">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="partial" ${order.status === 'partial' ? 'selected' : ''}>Partial</option>
                            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Items</label>
                        <div id="editItems">
                            ${items && items.length > 0 ? items.map((item, idx) => `
                                <div class="edit-item" style="display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap; align-items:center;">
                                    <span style="flex:2;">${item.product_name || 'Product ' + item.product_id}</span>
                                    <input type="number" class="form-control" placeholder="Expected Qty" style="flex:1; min-width:80px;" 
                                           id="editExpectedQty_${idx}" value="${item.expected_quantity}">
                                    <input type="number" class="form-control" placeholder="Received Qty" style="flex:1; min-width:80px;" 
                                           id="editReceivedQty_${idx}" value="${item.received_quantity || 0}">
                                    <input type="hidden" value="${item.product_id}">
                                </div>
                            `).join('') : '<p>No items</p>'}
                        </div>
                    </div>
                    <button type="submit" class="btn btn-success">Save Changes</button>
                    <button type="button" class="btn btn-danger" onclick="cancelInbound(${orderId})">Cancel Order</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error loading order: ' + error.message);
    }
}

// =====================================================
// SAVE INBOUND ORDER
// =====================================================

async function saveInbound(e, orderId) {
    e.preventDefault();
    console.log('💾 saveInbound called:', orderId);

    try {
        const supplier_id = document.getElementById('editSupplier').value;
        const expected_date = document.getElementById('editExpectedDate').value;
        const notes = document.getElementById('editNotes').value;
        const status = document.getElementById('editStatus').value;

        // Collect items
        const itemElements = document.querySelectorAll('.edit-item');
        const items = [];
        itemElements.forEach((el, idx) => {
            const productId = el.querySelector('input[type="hidden"]').value;
            const expectedQty = document.getElementById(`editExpectedQty_${idx}`).value;
            const receivedQty = document.getElementById(`editReceivedQty_${idx}`).value;
            items.push({
                product_id: parseInt(productId),
                expected_quantity: parseInt(expectedQty) || 0,
                received_quantity: parseInt(receivedQty) || 0
            });
        });

        const data = {
            supplier_id: parseInt(supplier_id),
            expected_date: expected_date || null,
            notes: notes || '',
            status: status,
            items: items
        };

        const result = await apiRequest(`/api/inbound/${orderId}`, 'PUT', data);
        alert('✅ Order updated successfully!');
        document.getElementById('editInboundModal')?.remove();
        await loadInboundOrders();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// =====================================================
// CANCEL INBOUND ORDER
// =====================================================

async function cancelInbound(orderId) {
    if (!confirm('⚠️ Are you sure you want to cancel this order?')) return;
    
    try {
        const result = await apiRequest(`/api/inbound/${orderId}/cancel`, 'PUT', { 
            status: 'cancelled',
            notes: 'Order cancelled by admin'
        });
        alert('✅ Order cancelled');
        document.getElementById('editInboundModal')?.remove();
        await loadInboundOrders();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
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
        // In loadInboundOrders function, update the actions column:
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isAdmin = user.role === 'admin';

// In the table row:
<td>
    ${o.status === 'pending' || o.status === 'partial' ? 
        `<button class="btn btn-success btn-sm" onclick="showReceiveInbound(${o.id})">Receive</button>` : ''}
    <button class="btn btn-info btn-sm" onclick="viewInbound(${o.id})">View</button>
    ${isAdmin ? 
        `<button class="btn btn-warning btn-sm" onclick="editInbound(${o.id})">Edit</button>` : ''}
</td>
        
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
// ADD INBOUND ITEM - FIXED FOR MULTIPLE ITEMS
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
    
    // Get products for dropdown
    apiRequest('/api/products').then(products => {
        const div = document.createElement('div');
        div.className = 'inbound-item';
        div.style.cssText = 'display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap; align-items:center;';
        div.innerHTML = `
            <select class="form-control" style="flex:2; min-width:150px;" id="itemProduct_${itemCounter}" onchange="updateProductName(this, ${itemCounter})">
                <option value="">Select Product</option>
                ${products.map(p => `<option value="${p.id}">${p.id} - ${p.name}</option>`).join('')}
            </select>
            <input type="number" class="form-control" placeholder="Qty" style="flex:1; min-width:80px;" id="itemQty_${itemCounter}" min="1">
            <input type="number" class="form-control" placeholder="Unit Cost" style="flex:1; min-width:100px;" id="itemCost_${itemCounter}" step="0.01">
            <span id="itemName_${itemCounter}" style="flex:1; min-width:120px; font-size:12px; color:#666;"></span>
            <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.inbound-item').remove()">✕</button>
        `;
        container.appendChild(div);
        console.log('✅ Item added, total items:', document.querySelectorAll('.inbound-item').length);
    }).catch(err => {
        console.error('Error loading products:', err);
    });
}

// Helper function to show product name when selected
function updateProductName(select, counter) {
    const nameSpan = document.getElementById(`itemName_${counter}`);
    if (select.value) {
        const selectedOption = select.options[select.selectedIndex];
        nameSpan.textContent = selectedOption.text;
    } else {
        nameSpan.textContent = '';
    }
}

// =====================================================
// CREATE INBOUND ORDER - FIXED FOR MULTIPLE ITEMS
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

        // Collect ALL items
        const itemElements = document.querySelectorAll('.inbound-item');
        console.log('📦 Found items:', itemElements.length);
        
        const items = [];
        let hasValidItem = false;
        
        itemElements.forEach((el, index) => {
            // Find the select or input for product
            const productSelect = el.querySelector(`#itemProduct_${index}`) || 
                                  el.querySelector('select');
            const qtyInput = el.querySelector(`#itemQty_${index}`) || 
                            el.querySelector('input[placeholder="Qty"]');
            const costInput = el.querySelector(`#itemCost_${index}`) || 
                            el.querySelector('input[placeholder="Unit Cost"]');
            
            const product_id = productSelect ? productSelect.value : '';
            const quantity = qtyInput ? parseInt(qtyInput.value) : 0;
            const unit_cost = costInput ? parseFloat(costInput.value) : 0;

            console.log(`📦 Item ${index}:`, { product_id, quantity, unit_cost });

            if (product_id && quantity > 0) {
                items.push({ 
                    product_id: parseInt(product_id), 
                    quantity: quantity, 
                    unit_cost: unit_cost || 0 
                });
                hasValidItem = true;
            } else if (product_id) {
                console.warn(`⚠️ Item ${index} has product but no quantity`);
            }
        });

        if (!hasValidItem || items.length === 0) {
            alert('Please add at least one valid item with product and quantity');
            return;
        }

        console.log('📤 Sending items:', items);

        const data = {
            supplier_id: parseInt(supplier_id),
            expected_date: expected_date || null,
            notes: notes || '',
            items: items,
            created_by: 1
        };

        const result = await apiRequest('/api/inbound', 'POST', data);
        console.log('✅ Result:', result);

        alert(`✅ Inbound order created successfully with ${items.length} items!`);
        document.getElementById('inboundModal')?.remove();
        await loadInboundOrders();

    } catch (error) {
        console.error('❌ Error creating inbound:', error);
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
window.editInbound = editInbound;
window.saveInbound = saveInbound;
window.cancelInbound = cancelInbound;

console.log('✅ inbound.js fully loaded and functions exposed');