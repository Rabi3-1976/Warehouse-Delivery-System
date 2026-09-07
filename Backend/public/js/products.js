// products.js - Product Management Page

console.log('✅ products.js loaded');

async function loadProducts(container) {
    console.log('📦 loadProducts called');
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h2>Product Management</h2>
            <button class="btn btn-primary" onclick="showAddProduct()">+ Add Product</button>
        </div>
        <div style="margin-bottom:15px;">
            <input type="text" class="form-control" placeholder="Search products..." 
                   style="width:300px;display:inline-block;" id="productSearch" 
                   oninput="searchProducts(this.value)">
            <button class="btn btn-primary" onclick="searchProducts(document.getElementById('productSearch').value)">Search</button>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>SKU</th>
                        <th>Barcode</th>
                        <th>Unit</th>
                        <th>Min Stock</th>
                        <th>Max Stock</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="productsTableBody">
                    <tr><td colspan="8">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    await loadProductList();
}

async function loadProductList(search = '') {
    try {
        const url = search ? `/api/products?search=${search}` : '/api/products';
        const products = await apiRequest(url);
        const tbody = document.getElementById('productsTableBody');
        
        if (!products || products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No products found</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td>${p.id}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.sku || '-'}</td>
                <td>${p.barcode || '-'}</td>
                <td>${p.unit || 'pcs'}</td>
                <td>${p.min_stock || 0}</td>
                <td>${p.max_stock || 9999}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editProduct(${p.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('productsTableBody').innerHTML = `<tr><td colspan="8">Error: ${error.message}</td></tr>`;
    }
}

function searchProducts(query) {
    loadProductList(query);
}

// Show Add Product Modal
function showAddProduct() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'productModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Product</h2>
                <span class="modal-close" onclick="document.getElementById('productModal').remove()">&times;</span>
            </div>
            <form id="addProductForm" onsubmit="addProduct(event)">
                <div class="form-group">
                    <label>Product Name *</label>
                    <input type="text" class="form-control" id="productName" required>
                </div>
                <div class="form-group">
                    <label>SKU *</label>
                    <input type="text" class="form-control" id="productSku" required>
                </div>
                <div class="form-group">
                    <label>Barcode</label>
                    <input type="text" class="form-control" id="productBarcode">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="form-control" id="productDescription" rows="2"></textarea>
                </div>
                <div class="form-group">
                    <label>Unit</label>
                    <select class="form-control" id="productUnit">
                        <option value="pcs">Pieces (pcs)</option>
                        <option value="kg">Kilogram (kg)</option>
                        <option value="g">Gram (g)</option>
                        <option value="L">Liter (L)</option>
                        <option value="ml">Milliliter (ml)</option>
                        <option value="box">Box</option>
                        <option value="pack">Pack</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Min Stock</label>
                    <input type="number" class="form-control" id="productMinStock" value="5">
                </div>
                <div class="form-group">
                    <label>Max Stock</label>
                    <input type="number" class="form-control" id="productMaxStock" value="100">
                </div>
                <button type="submit" class="btn btn-success">Add Product</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

// Add Product
async function addProduct(e) {
    e.preventDefault();
    try {
        const data = {
            name: document.getElementById('productName').value,
            sku: document.getElementById('productSku').value,
            barcode: document.getElementById('productBarcode').value,
            description: document.getElementById('productDescription').value,
            unit: document.getElementById('productUnit').value,
            min_stock: parseInt(document.getElementById('productMinStock').value) || 0,
            max_stock: parseInt(document.getElementById('productMaxStock').value) || 9999
        };

        const result = await apiRequest('/api/products', 'POST', data);
        alert('✅ Product added successfully!');
        document.getElementById('productModal')?.remove();
        await loadProductList();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// Edit Product
async function editProduct(id) {
    try {
        const product = await apiRequest(`/api/products/${id}`);
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'productModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit Product</h2>
                    <span class="modal-close" onclick="document.getElementById('productModal').remove()">&times;</span>
                </div>
                <form id="editProductForm" onsubmit="updateProduct(event, ${id})">
                    <div class="form-group">
                        <label>Product Name *</label>
                        <input type="text" class="form-control" id="productName" value="${product.name}" required>
                    </div>
                    <div class="form-group">
                        <label>SKU</label>
                        <input type="text" class="form-control" id="productSku" value="${product.sku || ''}">
                    </div>
                    <div class="form-group">
                        <label>Barcode</label>
                        <input type="text" class="form-control" id="productBarcode" value="${product.barcode || ''}">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea class="form-control" id="productDescription" rows="2">${product.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Unit</label>
                        <select class="form-control" id="productUnit">
                            <option value="pcs" ${product.unit === 'pcs' ? 'selected' : ''}>Pieces (pcs)</option>
                            <option value="kg" ${product.unit === 'kg' ? 'selected' : ''}>Kilogram (kg)</option>
                            <option value="g" ${product.unit === 'g' ? 'selected' : ''}>Gram (g)</option>
                            <option value="L" ${product.unit === 'L' ? 'selected' : ''}>Liter (L)</option>
                            <option value="ml" ${product.unit === 'ml' ? 'selected' : ''}>Milliliter (ml)</option>
                            <option value="box" ${product.unit === 'box' ? 'selected' : ''}>Box</option>
                            <option value="pack" ${product.unit === 'pack' ? 'selected' : ''}>Pack</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Min Stock</label>
                        <input type="number" class="form-control" id="productMinStock" value="${product.min_stock || 5}">
                    </div>
                    <div class="form-group">
                        <label>Max Stock</label>
                        <input type="number" class="form-control" id="productMaxStock" value="${product.max_stock || 100}">
                    </div>
                    <button type="submit" class="btn btn-success">Update Product</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error loading product: ' + error.message);
    }
}

async function updateProduct(e, id) {
    e.preventDefault();
    try {
        const data = {
            name: document.getElementById('productName').value,
            sku: document.getElementById('productSku').value,
            barcode: document.getElementById('productBarcode').value,
            description: document.getElementById('productDescription').value,
            unit: document.getElementById('productUnit').value,
            min_stock: parseInt(document.getElementById('productMinStock').value) || 0,
            max_stock: parseInt(document.getElementById('productMaxStock').value) || 9999
        };

        const result = await apiRequest(`/api/products/${id}`, 'PUT', data);
        alert('✅ Product updated successfully!');
        document.getElementById('productModal')?.remove();
        await loadProductList();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function deleteProduct(id) {
    if (!confirm('Delete this product? This will also remove related stock records.')) return;
    try {
        await apiRequest(`/api/products/${id}`, 'DELETE');
        alert('✅ Product deleted');
        await loadProductList();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// EXPOSE GLOBALLY
window.loadProducts = loadProducts;
window.showAddProduct = showAddProduct;
window.addProduct = addProduct;
window.editProduct = editProduct;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.searchProducts = searchProducts;
window.loadProductList = loadProductList;