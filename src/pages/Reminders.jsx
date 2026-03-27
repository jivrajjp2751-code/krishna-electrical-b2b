import { useMemo } from 'react';
import { Bell, AlertTriangle, Package, Users, Clock, Mail, Phone, MessageSquare, ArrowRight } from 'lucide-react';
import useStore from '../store/useStore';

export default function Reminders() {
  const getLowStockProducts = useStore(s => s.getLowStockProducts);
  const getInactiveCustomers = useStore(s => s.getInactiveCustomers);
  const getPendingEnquiries = useStore(s => s.getPendingEnquiries);
  const companyInfo = useStore(s => s.companyInfo);
  const addToast = useStore(s => s.addToast);
  const customers = useStore(s => s.customers);
  const products = useStore(s => s.products);

  const lowStock = getLowStockProducts();
  const inactive = getInactiveCustomers();
  const pendingEnquiries = getPendingEnquiries();
  const totalAlerts = lowStock.length + inactive.length + pendingEnquiries.length;

  const sendFollowUp = (customer) => {
    const subject = encodeURIComponent(`Follow-up - ${companyInfo.name}`);
    const body = encodeURIComponent(
      `Dear ${customer.contactPerson || 'Sir/Madam'},\n\n` +
      `We hope this message finds you well. We noticed it's been a while since your last order with us.\n\n` +
      `We'd love to reconnect and discuss how we can serve your chemical requirements.\n\n` +
      `Please feel free to reach out to us at ${companyInfo.phone} or reply to this email.\n\n` +
      `Warm Regards,\n${companyInfo.name}\n${companyInfo.phone}`
    );
    window.open(`mailto:${customer.email || ''}?subject=${subject}&body=${body}`);
    addToast(`Follow-up email draft opened for ${customer.name}`, 'info');
  };

  const getDaysSince = (dateStr) => {
    if (!dateStr) return 'Never';
    const diff = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    return `${diff} days ago`;
  };

  return (
    <div className="slide-up">
      {/* Summary */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={22} /></div>
          <div className="stat-info">
            <h4>Total Alerts</h4>
            <div className="stat-value">{totalAlerts}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Package size={22} /></div>
          <div className="stat-info">
            <h4>Low Stock Items</h4>
            <div className="stat-value">{lowStock.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={22} /></div>
          <div className="stat-info">
            <h4>Inactive Customers</h4>
            <div className="stat-value">{inactive.length}</div>
            <div className="stat-change" style={{ color: 'var(--gray-500)' }}>No orders in {companyInfo.reminderDays || 30}+ days</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><MessageSquare size={22} /></div>
          <div className="stat-info">
            <h4>Pending Enquiries</h4>
            <div className="stat-value">{pendingEnquiries.length}</div>
            <div className="stat-change" style={{ color: 'var(--gray-500)' }}>Requires quotation</div>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={18} style={{ color: 'var(--danger-500)' }} />
            Inventory Alerts - Low Stock
          </h3>
          {lowStock.length > 0 && <span className="badge badge-danger">{lowStock.length}</span>}
        </div>
        <div className="card-body no-padding">
          {lowStock.length === 0 ? (
            <div className="empty-state">
              <Package size={40} />
              <h4>All stocks are healthy</h4>
              <p>No products below minimum stock level</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Current Stock</th>
                    <th style={{ textAlign: 'right' }}>Min Stock</th>
                    <th style={{ textAlign: 'right' }}>Deficit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td><span className="badge badge-info">{p.category}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-600)' }}>{p.stock} {p.unit}</td>
                      <td style={{ textAlign: 'right' }}>{p.minStock} {p.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-600)' }}>
                        {p.minStock - p.stock > 0 ? `-${p.minStock - p.stock}` : '0'} {p.unit}
                      </td>
                      <td>
                        {p.stock === 0 ? (
                          <span className="badge badge-danger">Out of Stock</span>
                        ) : (
                          <span className="badge badge-warning">Low Stock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pending Enquiries */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={18} style={{ color: 'var(--primary-500)' }} />
            Pending Enquiries
          </h3>
          {pendingEnquiries.length > 0 && <span className="badge badge-primary" style={{ background: 'var(--primary-100)', color: 'var(--primary-700)'}}>{pendingEnquiries.length}</span>}
        </div>
        <div className="card-body no-padding">
          {pendingEnquiries.length === 0 ? (
            <div className="empty-state">
              <MessageSquare size={40} />
              <h4>No pending enquiries</h4>
              <p>All customer enquiries have been addressed</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Enquiry No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Product Needed</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingEnquiries.map(enq => {
                    const customer = customers.find(c => c.id === enq.customerId);
                    const product = products.find(p => p.id === enq.productId);
                    return (
                      <tr key={enq.id}>
                        <td><strong>{enq.enquiryNo}</strong></td>
                        <td>{new Date(enq.date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{customer?.name || 'Unknown'}</td>
                        <td>{product?.name || 'Unknown'}</td>
                        <td style={{ textAlign: 'center' }}>{enq.quantity}</td>
                        <td style={{ textAlign: 'right' }}>
                          <a href="/enquiries" className="btn btn-sm btn-primary">
                            View <ArrowRight size={14} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Inactive Customers */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} style={{ color: 'var(--warning-500)' }} />
            Customer Follow-Up Reminders
          </h3>
          {inactive.length > 0 && <span className="badge badge-warning">{inactive.length}</span>}
        </div>
        <div className="card-body no-padding">
          {inactive.length === 0 ? (
            <div className="empty-state">
              <Users size={40} />
              <h4>All customers are active</h4>
              <p>No follow-ups needed at this time</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact Person</th>
                    <th>Phone</th>
                    <th>Last Order</th>
                    <th>Inactive Since</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inactive.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.contactPerson}</td>
                      <td>{c.phone}</td>
                      <td>{c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'}</td>
                      <td>
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          {getDaysSince(c.lastOrderDate)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="btn-group" style={{ justifyContent: 'center' }}>
                          <button className="btn btn-sm btn-primary" onClick={() => sendFollowUp(c)}>
                            <Mail size={14} /> Follow Up
                          </button>
                          <a href={`tel:${c.phone?.replace(/\s/g, '')}`} className="btn btn-sm btn-secondary">
                            <Phone size={14} /> Call
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
