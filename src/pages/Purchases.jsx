import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, ShoppingCart, Download } from 'lucide-react';
import useStore from '../store/useStore';
import * as XLSX from 'xlsx';
import { downloadCSV } from '../utils/csv';

export default function Purchases() {
  const purchases = useStore(s => s.purchases);
  const products = useStore(s => s.products);
  const suppliers = useStore(s => s.suppliers);
  const addPurchase = useStore(s => s.addPurchase);
  const deletePurchase = useStore(s => s.deletePurchase);
  const addToast = useStore(s => s.addToast);
  const currentUser = useStore(s => s.currentUser);

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    supplierId: '', productId: '', quantity: '', purchasePrice: '', date: new Date().toISOString().split('T')[0], invoiceNo: ''
  });

  const filtered = useMemo(() => {
    return purchases.filter(p => {
      const supplier = suppliers.find(s => s.id === p.supplierId);
      const product = products.find(pr => pr.id === p.productId);
      const matchSearch = !search || (
        supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
        product?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.invoiceNo?.toLowerCase().includes(search.toLowerCase())
      );
      const matchDate = !dateFilter || p.date.startsWith(dateFilter);
      return matchSearch && matchDate;
    });
  }, [purchases, search, dateFilter, suppliers, products]);

  const handleProductChange = (productId) => {
    const product = products.find(p => p.id === productId);
    setForm(prev => ({
      ...prev,
      productId,
      purchasePrice: product ? product.purchasePrice : ''
    }));
  };

  const totalAmount = (Number(form.quantity) || 0) * (Number(form.purchasePrice) || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.supplierId || !form.productId || !form.quantity || !form.purchasePrice || !form.date) {
      addToast('Please fill all required fields', 'error');
      return;
    }
    const invoiceNo = form.invoiceNo || `PO-${String(purchases.length + 1).padStart(3, '0')}`;
    addPurchase({
      supplierId: form.supplierId,
      productId: form.productId,
      quantity: Number(form.quantity),
      purchasePrice: Number(form.purchasePrice),
      totalAmount,
      date: form.date,
      invoiceNo,
    });
    const product = products.find(p => p.id === form.productId);
    addToast(`Purchase recorded! Stock of ${product?.name || 'product'} increased by ${form.quantity}`, 'success');
    setShowModal(false);
    setForm({ supplierId: '', productId: '', quantity: '', purchasePrice: '', date: new Date().toISOString().split('T')[0], invoiceNo: '' });
  };

  const handleDelete = (id) => {
    if (confirm('Delete this purchase? Stock will be adjusted.')) {
      deletePurchase(id);
      addToast('Purchase deleted, stock adjusted', 'success');
    }
  };

  const exportToExcel = () => {
    const data = purchases.map(p => {
      const supplier = suppliers.find(s => s.id === p.supplierId);
      const product = products.find(pr => pr.id === p.productId);
      return {
        'Invoice No': p.invoiceNo,
        'Date': p.date,
        'Supplier': supplier?.name || 'Unknown',
        'Product': product?.name || 'Unknown',
        'Quantity': p.quantity,
        'Unit Price (₹)': p.purchasePrice,
        'Total Amount (₹)': p.totalAmount,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
    XLSX.writeFile(wb, 'Purchases_Report.xlsx');
    addToast('Exported to Excel', 'success');
  };

  return (
    <div className="slide-up">
      <div className="toolbar">
        <div className="toolbar-left">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input type="text" className="filter-input" placeholder="Search purchases..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          <input type="month" className="filter-input" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ minWidth: 160 }} />
        </div>
        <div className="toolbar-right">
          <button className="btn btn-secondary" onClick={exportToExcel}><Download size={16} /> Excel</button>
          <button className="btn btn-secondary" onClick={() => { const data = purchases.map(p => { const supplier = suppliers.find(s => s.id === p.supplierId); const product = products.find(pr => pr.id === p.productId); return { 'PO No': p.invoiceNo, Date: p.date, Supplier: supplier?.name || 'Unknown', Product: product?.name || 'Unknown', Quantity: p.quantity, 'Unit Price': p.purchasePrice, 'Total': p.totalAmount }; }); downloadCSV(data, 'Purchases'); addToast('CSV exported', 'success'); }}><Download size={16} /> CSV</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> New Purchase</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <div className="stat-icon teal"><ShoppingCart size={22} /></div>
          <div className="stat-info">
            <h4>Total Purchases</h4>
            <div className="stat-value">{purchases.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><ShoppingCart size={22} /></div>
          <div className="stat-info">
            <h4>Total Amount</h4>
            <div className="stat-value">₹{purchases.reduce((s, p) => s + p.totalAmount, 0).toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body no-padding">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO No.</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  {currentUser?.role === 'admin' && <th style={{ textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(p => {
                  const supplier = suppliers.find(s => s.id === p.supplierId);
                  const product = products.find(pr => pr.id === p.productId);
                  return (
                    <tr key={p.id}>
                      <td><span className="badge badge-info">{p.invoiceNo}</span></td>
                      <td>{new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ fontWeight: 600 }}>{supplier?.name || '—'}</td>
                      <td>{product?.name || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{p.quantity} {product?.unit || ''}</td>
                      <td style={{ textAlign: 'right' }}>₹{p.purchasePrice.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{p.totalAmount.toLocaleString('en-IN')}</td>
                      {currentUser?.role === 'admin' && (
                        <td style={{ textAlign: 'center' }}>
                          <button className="btn btn-icon btn-outline" onClick={() => handleDelete(p.id)} title="Delete" style={{ color: 'var(--danger-500)' }}><Trash2 size={15} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state"><ShoppingCart size={40} /><h4>No purchases found</h4><p>Record your first purchase</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Purchase Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record New Purchase</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Supplier (Party A) *</label>
                    <select className="form-select" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} required>
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Product *</label>
                  <select className="form-select" value={form.productId} onChange={e => handleProductChange(e.target.value)} required>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock} {p.unit})</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity *</label>
                    <input type="number" className="form-input" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0" min="1" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Price (₹/unit) *</label>
                    <input type="number" className="form-input" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} placeholder="0.00" min="0" step="0.01" required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">PO / Invoice No.</label>
                  <input type="text" className="form-input" value={form.invoiceNo} onChange={e => setForm({ ...form, invoiceNo: e.target.value })} placeholder="Auto-generated if empty" />
                </div>
                {totalAmount > 0 && (
                  <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, var(--primary-50), var(--accent-50))', borderRadius: 'var(--radius-md)', textAlign: 'center', marginTop: 8 }}>
                    <div className="text-xs text-muted">Total Amount</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-700)' }}>₹{totalAmount.toLocaleString('en-IN')}</div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Record Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
