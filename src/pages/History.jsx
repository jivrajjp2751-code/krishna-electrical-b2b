import { useState, useMemo } from 'react';
import { Clock, Download, IndianRupee, Receipt, TrendingUp, Calendar, ArrowRight } from 'lucide-react';
import useStore from '../store/useStore';
import { downloadCSV } from '../utils/csv';

export default function History() {
  const customers = useStore(s => s.customers);
  const sales = useStore(s => s.sales);
  const products = useStore(s => s.products);
  const getCustomerHistory = useStore(s => s.getCustomerHistory);
  const addToast = useStore(s => s.addToast);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const history = useMemo(() => {
    if (!selectedCustomerId) return [];
    let data = getCustomerHistory(selectedCustomerId);
    if (dateFrom) data = data.filter(d => d.date >= dateFrom);
    if (dateTo) data = data.filter(d => d.date <= dateTo);
    return data;
  }, [selectedCustomerId, dateFrom, dateTo, getCustomerHistory]);

  const customerSales = useMemo(() => {
    return sales.filter(s => s.customerId === selectedCustomerId);
  }, [sales, selectedCustomerId]);

  const stats = useMemo(() => {
    if (!selectedCustomerId) return null;
    const totalAmount = customerSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalOrders = customerSales.length;
    const firstOrder = customerSales.length > 0
      ? customerSales.reduce((min, s) => s.date < min ? s.date : min, customerSales[0].date)
      : null;
    const lastOrder = customerSales.length > 0
      ? customerSales.reduce((max, s) => s.date > max ? s.date : max, customerSales[0].date)
      : null;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0;
    return { totalAmount, totalOrders, firstOrder, lastOrder, avgOrderValue };
  }, [customerSales, selectedCustomerId]);

  const exportHistory = () => {
    if (!history.length) {
      addToast('No history to export', 'error');
      return;
    }
    const data = history.map(h => ({
      'Date': h.date,
      'Type': h.type === 'sale' ? 'Sale' : 'Purchase',
      'Invoice No': h.invoiceNo,
      'Product': h.product,
      'Quantity': `${h.quantity} ${h.unit}`,
      'Unit Price (₹)': h.unitPrice,
      'Amount (₹)': h.amount,
    }));
    downloadCSV(data, `${selectedCustomer?.name || 'Customer'}_History`);
    addToast('History exported as CSV', 'success');
  };

  const exportCustomerData = () => {
    if (!selectedCustomer) return;
    const data = [{
      'Name': selectedCustomer.name,
      'Contact Person': selectedCustomer.contactPerson,
      'Phone': selectedCustomer.phone,
      'Email': selectedCustomer.email,
      'Address': selectedCustomer.address,
      'GST Number': selectedCustomer.gstNumber,
      'Credit Limit (₹)': selectedCustomer.creditLimit,
      'Last Order Date': selectedCustomer.lastOrderDate || 'N/A',
      'Total Business (₹)': stats?.totalAmount || 0,
      'Total Orders': stats?.totalOrders || 0,
      'Avg Order Value (₹)': stats?.avgOrderValue || 0,
      'First Order': stats?.firstOrder || 'N/A',
      'Status': selectedCustomer.lastOrderDate ? 'Active' : 'New',
    }];
    downloadCSV(data, `${selectedCustomer.name}_Profile`);
    addToast('Customer data exported', 'success');
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="slide-up">
      {/* Customer Selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 250px', marginBottom: 0 }}>
              <label className="form-label">Select Customer</label>
              <select className="form-select" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}>
                <option value="">— Choose a customer to view history —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            {selectedCustomerId && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={exportHistory}><Download size={14} /> History CSV</button>
                <button className="btn btn-primary" onClick={exportCustomerData}><Download size={14} /> Profile CSV</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!selectedCustomerId ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <Clock size={48} />
              <h4>Select a Customer</h4>
              <p>Choose a customer from the dropdown to view their complete transaction history</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Customer Summary */}
          {stats && (
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-icon blue"><IndianRupee size={20} /></div>
                <div className="stat-info">
                  <h4>Total Business</h4>
                  <div className="stat-value">₹{stats.totalAmount.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><Receipt size={20} /></div>
                <div className="stat-info">
                  <h4>Total Orders</h4>
                  <div className="stat-value">{stats.totalOrders}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon teal"><TrendingUp size={20} /></div>
                <div className="stat-info">
                  <h4>Avg Order Value</h4>
                  <div className="stat-value">₹{stats.avgOrderValue.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><Calendar size={20} /></div>
                <div className="stat-info">
                  <h4>Customer Since</h4>
                  <div className="stat-value" style={{ fontSize: 15 }}>{stats.firstOrder ? formatDate(stats.firstOrder) : 'N/A'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Customer Info Card */}
          {selectedCustomer && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <h3>Customer Profile — {selectedCustomer.name}</h3>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  {[
                    { label: 'Contact Person', value: selectedCustomer.contactPerson },
                    { label: 'Phone', value: selectedCustomer.phone },
                    { label: 'Email', value: selectedCustomer.email },
                    { label: 'GST Number', value: selectedCustomer.gstNumber },
                    { label: 'Credit Limit', value: `₹${(selectedCustomer.creditLimit || 0).toLocaleString('en-IN')}` },
                    { label: 'Last Order', value: selectedCustomer.lastOrderDate ? formatDate(selectedCustomer.lastOrderDate) : 'N/A' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)', wordBreak: 'break-word' }}>{item.value || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Transaction Timeline */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} />
                Transaction History ({history.length} entries)
              </h3>
            </div>
            <div className="card-body no-padding">
              {history.length === 0 ? (
                <div className="empty-state">
                  <Receipt size={40} />
                  <h4>No transactions found</h4>
                  <p>{dateFrom || dateTo ? 'Try adjusting the date range' : 'This customer has no recorded transactions yet'}</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Invoice</th>
                        <th>Product</th>
                        <th style={{ textAlign: 'right' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Unit Price</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={i}>
                          <td>{formatDate(h.date)}</td>
                          <td>
                            <span className={`badge ${h.type === 'sale' ? 'badge-success' : 'badge-info'}`}>
                              {h.type === 'sale' ? 'Sale' : 'Purchase'}
                            </span>
                          </td>
                          <td><span className="badge badge-info">{h.invoiceNo}</span></td>
                          <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.product}</td>
                          <td style={{ textAlign: 'right' }}>{h.quantity} {h.unit}</td>
                          <td style={{ textAlign: 'right' }}>₹{h.unitPrice.toLocaleString('en-IN')}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-700)' }}>₹{h.amount.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                      {/* Summary Row */}
                      <tr style={{ background: 'var(--gray-50)' }}>
                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>Total</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--primary-700)' }}>
                          ₹{history.reduce((sum, h) => sum + h.amount, 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
