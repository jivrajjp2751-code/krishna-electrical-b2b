import { useMemo, useState } from 'react';
import { Bell, AlertTriangle, Package, Users, Clock, Mail, Phone, MessageSquare, ArrowRight, Plus, Trash2, CheckCircle, Calendar } from 'lucide-react';
import useStore from '../store/useStore';

export default function Reminders() {
  const getLowStockProducts = useStore(s => s.getLowStockProducts);
  const getInactiveCustomers = useStore(s => s.getInactiveCustomers);
  const getPendingEnquiries = useStore(s => s.getPendingEnquiries);
  const companyInfo = useStore(s => s.companyInfo);
  const addToast = useStore(s => s.addToast);
  const customers = useStore(s => s.customers);
  const products = useStore(s => s.products);
  const customReminders = useStore(s => s.customReminders) || [];
  const addCustomReminder = useStore(s => s.addCustomReminder);
  const completeCustomReminder = useStore(s => s.completeCustomReminder);
  const deleteCustomReminder = useStore(s => s.deleteCustomReminder);

  const [showModal, setShowModal] = useState(false);
  const [newReminder, setNewReminder] = useState({ text: '', type: 'Call Client', targetDate: '', targetTime: '' });

  const lowStock = getLowStockProducts();
  const inactive = getInactiveCustomers();
  const pendingEnquiries = getPendingEnquiries();
  const pendingCustoms = customReminders.filter(r => r.status === 'pending');
  const totalAlerts = lowStock.length + inactive.length + pendingEnquiries.length + pendingCustoms.length;

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

  const handleAddReminder = (e) => {
    e.preventDefault();
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
    if (!newReminder.text || !newReminder.targetDate) return addToast('Please fill all required fields', 'error');
    addCustomReminder(newReminder);
    setShowModal(false);
    setNewReminder({ text: '', type: 'Call Client', targetDate: '', targetTime: '' });
    addToast('Reminder scheduled successfully', 'success');
  };

  return (
    <div className="slide-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Reminders & Follow-Ups</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Custom Reminder
        </button>
      </div>

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

      {/* Custom Reminders */}
      <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--primary-500)' }}>
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} style={{ color: 'var(--primary-600)' }} />
            My Scheduled Reminders
          </h3>
          {pendingCustoms.length > 0 && <span className="badge badge-primary">{pendingCustoms.length} Pending</span>}
        </div>
        <div className="card-body no-padding">
          {customReminders.length === 0 ? (
            <div className="empty-state">
              <Bell size={40} />
              <h4>No custom reminders set</h4>
              <p>Schedule order placements or client calls</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task / Description</th>
                    <th>Type</th>
                    <th>Scheduled For</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customReminders.sort((a,b) => new Date(a.targetDate) - new Date(b.targetDate)).map(r => (
                    <tr key={r.id} style={{ opacity: r.status === 'completed' ? 0.6 : 1 }}>
                      <td style={{ fontWeight: 500 }}>{r.text}</td>
                      <td><span className="badge badge-info">{r.type}</span></td>
                      <td>
                        <div style={{ fontWeight: 600, color: r.status === 'pending' && new Date() > new Date(`${r.targetDate}T${r.targetTime||'00:00'}`) ? 'var(--danger-600)' : 'inherit' }}>
                          {new Date(r.targetDate).toLocaleDateString()} {r.targetTime && `at ${r.targetTime}`}
                        </div>
                      </td>
                      <td>
                        {r.status === 'completed' ? <span className="badge badge-success">Completed</span> : <span className="badge badge-warning">Pending</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                          {r.status === 'pending' && (
                            <button className="btn btn-sm btn-success" onClick={() => completeCustomReminder(r.id)} title="Mark as Done">
                              <CheckCircle size={14} />
                            </button>
                          )}
                          <button className="btn btn-sm btn-outline" style={{ color: 'var(--danger-500)' }} onClick={() => deleteCustomReminder(r.id)} title="Delete">
                            <Trash2 size={14} />
                          </button>
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Schedule Reminder</h2>
            </div>
            <form onSubmit={handleAddReminder}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Reminder Type</label>
                  <select className="form-input" value={newReminder.type} onChange={e => setNewReminder({...newReminder, type: e.target.value})}>
                    <option value="Call Client">Call Client</option>
                    <option value="Call Supplier">Call Supplier</option>
                    <option value="Place Order">Place Order</option>
                    <option value="Follow up">Follow up</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Description / Details *</label>
                  <textarea className="form-input" required rows={3} placeholder="e.g. Call Krishna to restock Acid" value={newReminder.text} onChange={e => setNewReminder({...newReminder, text: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label>Date *</label>
                    <input type="date" className="form-input" required min={new Date().toISOString().split('T')[0]} value={newReminder.targetDate} onChange={e => setNewReminder({...newReminder, targetDate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Time</label>
                    <input type="time" className="form-input" value={newReminder.targetTime} onChange={e => setNewReminder({...newReminder, targetTime: e.target.value})} />
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 8 }}>Note: You must keep this app open in your browser to receive desktop/phone notifications when the time arrives.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
