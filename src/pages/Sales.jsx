import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, Receipt, Download, Eye, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import * as XLSX from 'xlsx';
import { downloadCSV } from '../utils/csv';

const emptyItem = { productId: '', quantity: '', sellingPrice: '', total: 0, hsnCode: '', uom: 'nos' };

export default function Sales() {
  const sales = useStore(s => s.sales);
  const products = useStore(s => s.products);
  const customers = useStore(s => s.customers);
  const addSale = useStore(s => s.addSale);
  const deleteSale = useStore(s => s.deleteSale);
  const addToast = useStore(s => s.addToast);
  const currentUser = useStore(s => s.currentUser);
  const companyInfo = useStore(s => s.companyInfo);
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([{ ...emptyItem }]);

  const filtered = useMemo(() => {
    return sales.filter(s => {
      const customer = customers.find(c => c.id === s.customerId);
      const matchSearch = !search || (
        customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.invoiceNo?.toLowerCase().includes(search.toLowerCase())
      );
      const matchDate = !dateFilter || s.date.startsWith(dateFilter);
      return matchSearch && matchDate;
    });
  }, [sales, search, dateFilter, customers]);

  const handleProductChange = (index, productId) => {
    const product = products.find(p => p.id === productId);
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId,
      sellingPrice: product ? product.sellingPrice : '',
      hsnCode: product ? (product.hsnCode || '') : '',
      uom: product ? (product.unit || 'nos') : 'nos',
    };
    updateItemTotal(newItems, index);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    updateItemTotal(newItems, index);
  };

  const updateItemTotal = (newItems, index) => {
    const qty = Number(newItems[index].quantity) || 0;
    const price = Number(newItems[index].sellingPrice) || 0;
    newItems[index].total = qty * price;
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { ...emptyItem }]);

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const gstRate = companyInfo.gstRate || 18;
  const gstAmount = Math.round((subtotal * gstRate) / 100);
  const totalAmount = subtotal + gstAmount;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerId || items.some(i => !i.productId || !i.quantity || !i.sellingPrice)) {
      addToast('Please fill all required fields for each item', 'error');
      return;
    }

    // Check stock availability
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (product && Number(item.quantity) > product.stock) {
        addToast(`Insufficient stock for ${product.name}. Available: ${product.stock}`, 'error');
        return;
      }
    }

    const saleItems = items.map(i => ({
      productId: i.productId,
      quantity: Number(i.quantity),
      sellingPrice: Number(i.sellingPrice),
      total: i.total,
      hsnCode: i.hsnCode || '',
      uom: i.uom || 'nos'
    }));

    const newSale = addSale({
      customerId,
      items: saleItems,
      subtotal,
      gstAmount,
      totalAmount,
      date: saleDate,
    });

    addToast(`Sale recorded! Invoice ${newSale.invoiceNo} generated. Loading preview to finalize...`, 'success');
    setShowModal(false);
    setCustomerId('');
    setItems([{ ...emptyItem }]);
    // Navigate to editable invoice preview
    navigate(`/invoices?id=${newSale.id}&edit=true`);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this sale? Stock will be restored.')) {
      deleteSale(id);
      addToast('Sale deleted, stock restored', 'success');
    }
  };

  const exportToExcel = () => {
    const data = sales.map(s => {
      const customer = customers.find(c => c.id === s.customerId);
      return {
        'Invoice No': s.invoiceNo,
        'Date': s.date,
        'Customer': customer?.name || 'Unknown',
        'Items': s.items.length,
        'Subtotal (₹)': s.subtotal,
        'GST (₹)': s.gstAmount,
        'Total Amount (₹)': s.totalAmount,
        'Status': s.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, 'Sales_Report.xlsx');
    addToast('Exported to Excel', 'success');
  };

  return (
    <div className="slide-up">
      <div className="toolbar">
        <div className="toolbar-left">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input type="text" className="filter-input" placeholder="Search sales..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          <input type="month" className="filter-input" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ minWidth: 160 }} />
        </div>
        <div className="toolbar-right">
          <button className="btn btn-secondary" onClick={exportToExcel}><Download size={16} /> Excel</button>
          <button className="btn btn-secondary" onClick={() => { const data = sales.map(s => { const customer = customers.find(c => c.id === s.customerId); return { Invoice: s.invoiceNo, Date: s.date, Customer: customer?.name || 'Unknown', Items: s.items.length, Subtotal: s.subtotal, GST: s.gstAmount, Total: s.totalAmount }; }); downloadCSV(data, 'Sales'); addToast('CSV exported', 'success'); }}><Download size={16} /> CSV</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> New Sale</button>
        </div>
      </div>

      {/* Summary */}
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <div className="stat-icon blue"><Receipt size={22} /></div>
          <div className="stat-info">
            <h4>Total Sales</h4>
            <div className="stat-value">{sales.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Receipt size={22} /></div>
          <div className="stat-info">
            <h4>Total Revenue</h4>
            <div className="stat-value">₹{sales.reduce((s, sale) => s + sale.totalAmount, 0).toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body no-padding">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th style={{ textAlign: 'center' }}>Items</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(s => {
                  const customer = customers.find(c => c.id === s.customerId);
                  return (
                    <tr key={s.id}>
                      <td><span className="badge badge-info">{s.invoiceNo}</span></td>
                      <td>{new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ fontWeight: 600 }}>{customer?.name || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{s.items.length}</td>
                      <td style={{ textAlign: 'right' }}>₹{s.subtotal.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>₹{s.gstAmount.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-700)' }}>₹{s.totalAmount.toLocaleString('en-IN')}</td>
                      <td><span className="badge badge-success">Completed</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="btn-group" style={{ justifyContent: 'center' }}>
                          <button className="btn btn-icon btn-outline" onClick={() => navigate(`/invoices?id=${s.id}`)} title="View Invoice"><Eye size={15} /></button>
                          {currentUser?.role === 'admin' && (
                            <button className="btn btn-icon btn-outline" onClick={() => handleDelete(s.id)} title="Delete" style={{ color: 'var(--danger-500)' }}><Trash2 size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9}><div className="empty-state"><Receipt size={40} /><h4>No sales found</h4><p>Record your first sale</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Sale Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record New Sale</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Customer (Party B) *</label>
                    <select className="form-select" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                      <option value="">Select Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input type="date" className="form-input" value={saleDate} onChange={e => setSaleDate(e.target.value)} required />
                  </div>
                </div>

                <div style={{ margin: '16px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ margin: 0 }}>Sale Items *</label>
                  <button type="button" className="btn btn-sm btn-outline" onClick={addItem}><Plus size={14} /> Add Item</button>
                </div>

                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div className="table-container">
                    <table className="data-table" style={{ marginBottom: 0, width: '100%', minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th style={{ width: 80 }}>HSN/SAC</th>
                          <th style={{ width: 60 }}>UOM</th>
                          <th style={{ width: 70 }}>Qty</th>
                          <th style={{ width: 90 }}>Price (₹)</th>
                          <th style={{ width: 90, textAlign: 'right' }}>Total</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i}>
                            <td>
                              <select className="form-select" value={item.productId} onChange={e => handleProductChange(i, e.target.value)} required style={{ fontSize: 13, padding: '8px 10px' }}>
                                <option value="">Select</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input type="text" className="form-input" value={item.hsnCode} onChange={e => handleItemChange(i, 'hsnCode', e.target.value)} style={{ padding: '8px 10px', fontSize: 13 }} />
                            </td>
                            <td>
                              <input type="text" className="form-input" value={item.uom} onChange={e => handleItemChange(i, 'uom', e.target.value)} style={{ padding: '8px 10px', fontSize: 13 }} />
                            </td>
                            <td>
                              <input type="number" className="form-input" value={item.quantity} onChange={e => handleItemChange(i, 'quantity', e.target.value)} min="1" style={{ padding: '8px 10px', fontSize: 13 }} required />
                            </td>
                            <td>
                              <input type="number" className="form-input" value={item.sellingPrice} onChange={e => handleItemChange(i, 'sellingPrice', e.target.value)} min="0" step="0.01" style={{ padding: '8px 10px', fontSize: 13 }} required />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>₹{item.total.toLocaleString('en-IN')}</td>
                            <td>
                              {items.length > 1 && (
                                <button type="button" className="btn btn-icon" onClick={() => removeItem(i)} style={{ color: 'var(--danger-500)' }}><X size={18} /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <div style={{ width: 280, maxWidth: '100%', padding: '14px 18px', background: 'linear-gradient(135deg, var(--primary-50), var(--accent-50))', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span className="text-muted">Subtotal</span>
                      <span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span className="text-muted">GST ({gstRate}%)</span>
                      <span style={{ fontWeight: 600 }}>₹{gstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--gray-300)', paddingTop: 8, marginTop: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>Grand Total</span>
                      <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--primary-700)' }}>₹{totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Record Sale & Generate Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
