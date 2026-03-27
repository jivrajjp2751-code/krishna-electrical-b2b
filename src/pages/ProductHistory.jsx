import { useState, useMemo } from 'react';
import { Package, Download, IndianRupee, TrendingUp, Calendar, Users, BarChart3 } from 'lucide-react';
import useStore from '../store/useStore';
import { downloadCSV } from '../utils/csv';

export default function ProductHistory() {
  const products = useStore(s => s.products);
  const sales = useStore(s => s.sales);
  const customers = useStore(s => s.customers);
  const addToast = useStore(s => s.addToast);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // All sales containing this product
  const productSales = useMemo(() => {
    if (!selectedProductId) return [];
    let results = [];
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (item.productId === selectedProductId) {
          results.push({
            date: sale.date,
            invoiceNo: sale.invoiceNo,
            customerId: sale.customerId,
            customerName: customers.find(c => c.id === sale.customerId)?.name || 'Unknown',
            quantity: Number(item.quantity),
            unitPrice: Number(item.sellingPrice),
            amount: Number(item.total),
            unit: selectedProduct?.unit || '',
          });
        }
      });
    });
    if (dateFrom) results = results.filter(r => r.date >= dateFrom);
    if (dateTo) results = results.filter(r => r.date <= dateTo);
    return results.sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedProductId, sales, customers, dateFrom, dateTo, selectedProduct]);

  // Top buyers
  const topBuyers = useMemo(() => {
    const map = {};
    productSales.forEach(s => {
      if (!map[s.customerId]) map[s.customerId] = { name: s.customerName, qty: 0, revenue: 0, orders: 0 };
      map[s.customerId].qty += s.quantity;
      map[s.customerId].revenue += s.amount;
      map[s.customerId].orders += 1;
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [productSales]);

  // Stats
  const stats = useMemo(() => {
    if (!selectedProductId || productSales.length === 0) return null;
    const totalUnits = productSales.reduce((s, i) => s + i.quantity, 0);
    const totalRevenue = productSales.reduce((s, i) => s + i.amount, 0);
    const totalOrders = new Set(productSales.map(s => s.invoiceNo)).size;
    const uniqueCustomers = new Set(productSales.map(s => s.customerId)).size;
    const avgPrice = totalUnits > 0 ? Math.round(totalRevenue / totalUnits) : 0;
    return { totalUnits, totalRevenue, totalOrders, uniqueCustomers, avgPrice };
  }, [selectedProductId, productSales]);

  const exportHistory = () => {
    if (!productSales.length) { addToast('No history to export', 'error'); return; }
    const data = productSales.map(h => ({
      'Date': h.date,
      'Invoice No': h.invoiceNo,
      'Customer': h.customerName,
      'Quantity': `${h.quantity} ${h.unit}`,
      'Unit Price (₹)': h.unitPrice,
      'Amount (₹)': h.amount,
    }));
    downloadCSV(data, `${selectedProduct?.name || 'Product'}_History`);
    addToast('Product history exported', 'success');
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="slide-up">
      {/* Product Selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 250px', marginBottom: 0 }}>
              <label className="form-label">Select Product</label>
              <select className="form-select" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                <option value="">— Choose a product to view history —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: '0 1 160px', marginBottom: 0 }}>
              <label className="form-label">From Date</label>
              <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '0 1 160px', marginBottom: 0 }}>
              <label className="form-label">To Date</label>
              <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            {selectedProductId && (
              <button className="btn btn-secondary" onClick={exportHistory}><Download size={14} /> Export CSV</button>
            )}
          </div>
        </div>
      </div>

      {!selectedProductId ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <Package size={48} />
              <h4>Select a Product</h4>
              <p>Choose a product from the dropdown to view its detailed sales analysis</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          {stats && (
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-icon blue"><IndianRupee size={20} /></div>
                <div className="stat-info">
                  <h4>Total Revenue</h4>
                  <div className="stat-value">₹{stats.totalRevenue.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><TrendingUp size={20} /></div>
                <div className="stat-info">
                  <h4>Total Units Sold</h4>
                  <div className="stat-value">{stats.totalUnits} {selectedProduct?.unit}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon teal"><Users size={20} /></div>
                <div className="stat-info">
                  <h4>Unique Buyers</h4>
                  <div className="stat-value">{stats.uniqueCustomers}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><BarChart3 size={20} /></div>
                <div className="stat-info">
                  <h4>Avg. Selling Price</h4>
                  <div className="stat-value">₹{stats.avgPrice.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>
          )}

          {/* Product Info Card */}
          {selectedProduct && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <h3>Product Profile — {selectedProduct.name}</h3>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  {[
                    { label: 'Category', value: selectedProduct.category },
                    { label: 'Unit', value: selectedProduct.unit },
                    { label: 'Purchase Price', value: `₹${(selectedProduct.purchasePrice || 0).toLocaleString('en-IN')}` },
                    { label: 'Selling Price', value: `₹${(selectedProduct.sellingPrice || 0).toLocaleString('en-IN')}` },
                    { label: 'Current Stock', value: `${selectedProduct.stock} ${selectedProduct.unit}` },
                    { label: 'HSN Code', value: selectedProduct.hsnCode || '—' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
            {/* Top Buyers */}
            <div className="card">
              <div className="card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} />
                  Top Buyers ({topBuyers.length})
                </h3>
              </div>
              <div className="card-body no-padding">
                {topBuyers.length === 0 ? (
                  <div className="empty-state">
                    <Users size={36} />
                    <h4>No sales recorded</h4>
                    <p>This product hasn't been sold yet</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Customer</th>
                          <th style={{ textAlign: 'right' }}>Qty Bought</th>
                          <th style={{ textAlign: 'right' }}>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topBuyers.map((b, i) => (
                          <tr key={i}>
                            <td>
                              {i === 0 ? <span style={{ fontSize: 16 }}>🥇</span> :
                               i === 1 ? <span style={{ fontSize: 16 }}>🥈</span> :
                               i === 2 ? <span style={{ fontSize: 16 }}>🥉</span> :
                               <span style={{ color: 'var(--gray-400)' }}>{i + 1}</span>}
                            </td>
                            <td style={{ fontWeight: 600 }}>{b.name}</td>
                            <td style={{ textAlign: 'right' }}>{b.qty} {selectedProduct?.unit}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary-700)' }}>₹{b.revenue.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Transaction History */}
            <div className="card">
              <div className="card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} />
                  Sales History ({productSales.length} entries)
                </h3>
              </div>
              <div className="card-body no-padding">
                {productSales.length === 0 ? (
                  <div className="empty-state">
                    <Package size={40} />
                    <h4>No transactions found</h4>
                    <p>{dateFrom || dateTo ? 'Try adjusting the date range' : 'This product has no recorded sales yet'}</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Invoice</th>
                          <th>Customer</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Unit Price</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productSales.map((h, i) => (
                          <tr key={i}>
                            <td>{formatDate(h.date)}</td>
                            <td><span className="badge badge-info">{h.invoiceNo}</span></td>
                            <td style={{ fontWeight: 600 }}>{h.customerName}</td>
                            <td style={{ textAlign: 'right' }}>{h.quantity} {h.unit}</td>
                            <td style={{ textAlign: 'right' }}>₹{h.unitPrice.toLocaleString('en-IN')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-700)' }}>₹{h.amount.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--gray-50)' }}>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>Total</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--primary-700)' }}>
                            ₹{productSales.reduce((sum, h) => sum + h.amount, 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
