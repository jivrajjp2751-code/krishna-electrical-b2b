import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Package, Download, AlertTriangle } from 'lucide-react';
import useStore from '../store/useStore';
import * as XLSX from 'xlsx';

const categories = ['Rewinding', 'Repairs', 'Panels', 'Valves', 'Pumps', 'Services', 'AMC', 'Cables', 'Motors', 'Other'];
const units = ['nos', 'kg', 'litre', 'meter', 'set', 'lot', 'pair'];

const emptyProduct = {
  name: '', category: 'Services', unit: 'nos',
  purchasePrice: '', sellingPrice: '', stock: '', minStock: '', hsnCode: ''
};

export default function Products() {
  const products = useStore(s => s.products);
  const addProduct = useStore(s => s.addProduct);
  const updateProduct = useStore(s => s.updateProduct);
  const deleteProduct = useStore(s => s.deleteProduct);
  const addToast = useStore(s => s.addToast);
  const currentUser = useStore(s => s.currentUser);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyProduct);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = !catFilter || p.category === catFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, catFilter]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyProduct);
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditId(product.id);
    setForm({
      name: product.name,
      category: product.category,
      unit: product.unit,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
      minStock: product.minStock,
      hsnCode: product.hsnCode || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.purchasePrice || !form.sellingPrice) {
      addToast('Please fill all required fields', 'error');
      return;
    }
    const data = {
      ...form,
      purchasePrice: Number(form.purchasePrice),
      sellingPrice: Number(form.sellingPrice),
      stock: Number(form.stock) || 0,
      minStock: Number(form.minStock) || 0,
    };
    if (editId) {
      updateProduct(editId, data);
      addToast('Product updated successfully', 'success');
    } else {
      addProduct(data);
      addToast('Product added successfully', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = (id, name) => {
    if (confirm(`Delete "${name}"? This action cannot be undone.`)) {
      deleteProduct(id);
      addToast('Product deleted', 'success');
    }
  };

  const exportToExcel = () => {
    const data = products.map(p => ({
      'Product Name': p.name,
      'Category': p.category,
      'Unit': p.unit,
      'Purchase Price (₹)': p.purchasePrice,
      'Selling Price (₹)': p.sellingPrice,
      'Current Stock': p.stock,
      'Min Stock': p.minStock,
      'Stock Value (₹)': p.stock * p.purchasePrice,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'Products_Report.xlsx');
    addToast('Exported to Excel', 'success');
  };

  return (
    <div className="slide-up">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input
              type="text"
              className="filter-input"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select className="filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-secondary" onClick={exportToExcel}>
            <Download size={16} /> Export
          </button>
          {currentUser?.role === 'admin' && (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body no-padding">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Purchase ₹</th>
                  <th style={{ textAlign: 'right' }}>Selling ₹</th>
                  <th style={{ textAlign: 'right' }}>Stock</th>
                  <th style={{ textAlign: 'right' }}>Min Stock</th>
                  <th>Status</th>
                  {currentUser?.role === 'admin' && <th style={{ textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td><span className="badge badge-info">{p.category}</span></td>
                    <td>{p.unit}</td>
                    <td style={{ textAlign: 'right' }}>₹{p.purchasePrice.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>₹{p.sellingPrice.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.stock.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>{p.minStock}</td>
                    <td>
                      {p.stock <= p.minStock ? (
                        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} /> Low
                        </span>
                      ) : (
                        <span className="badge badge-success">In Stock</span>
                      )}
                    </td>
                    {currentUser?.role === 'admin' && (
                      <td style={{ textAlign: 'center' }}>
                        <div className="btn-group" style={{ justifyContent: 'center' }}>
                          <button className="btn btn-icon btn-outline" onClick={() => openEdit(p)} title="Edit"><Edit2 size={15} /></button>
                          <button className="btn btn-icon btn-outline" onClick={() => handleDelete(p.id, p.name)} title="Delete" style={{ color: 'var(--danger-500)' }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <Package size={40} />
                        <h4>No products found</h4>
                        <p>Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Edit Product' : 'Add New Product'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. AC/DC Motor Rewinding"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit *</label>
                    <select className="form-select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Purchase Price (₹) *</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={form.purchasePrice}
                      onChange={e => setForm({ ...form, purchasePrice: e.target.value })}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Selling Price (₹) *</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={form.sellingPrice}
                      onChange={e => setForm({ ...form, sellingPrice: e.target.value })}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Current Stock</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0"
                      value={form.stock}
                      onChange={e => setForm({ ...form, stock: e.target.value })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Minimum Stock Level</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0"
                      value={form.minStock}
                      onChange={e => setForm({ ...form, minStock: e.target.value })}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">HSN/SAC Code</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 9987, 8416"
                    value={form.hsnCode}
                    onChange={e => setForm({ ...form, hsnCode: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Add'} Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
