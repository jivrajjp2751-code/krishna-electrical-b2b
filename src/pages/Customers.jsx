import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Users, Download, Phone, Mail, MapPin, Calendar, IndianRupee, UserPlus, X } from 'lucide-react';
import useStore from '../store/useStore';
import * as XLSX from 'xlsx';

const emptyContact = { name: '', phone: '', email: '', designation: '' };

const emptyCustomer = {
  name: '', contactPerson: '', phone: '', email: '', address: '',
  gstNumber: '', creditLimit: '', lastOrderDate: '', contacts: []
};

export default function Customers() {
  const customers = useStore(s => s.customers);
  const addCustomer = useStore(s => s.addCustomer);
  const updateCustomer = useStore(s => s.updateCustomer);
  const deleteCustomer = useStore(s => s.deleteCustomer);
  const addToast = useStore(s => s.addToast);
  const currentUser = useStore(s => s.currentUser);
  const sales = useStore(s => s.sales);
  const companyInfo = useStore(s => s.companyInfo);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [viewCustomer, setViewCustomer] = useState(null);

  const filtered = useMemo(() => {
    return customers.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contactPerson || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.gstNumber || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [customers, search]);

  const getCustomerSalesTotal = (customerId) => {
    return sales.filter(s => s.customerId === customerId).reduce((sum, s) => sum + s.totalAmount, 0);
  };

  const isInactive = (customer) => {
    const days = companyInfo.reminderDays || 30;
    if (!customer.lastOrderDate) return true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(customer.lastOrderDate) < cutoff;
  };

  const openAdd = () => { setEditId(null); setForm(emptyCustomer); setShowModal(true); };

  const openEdit = (customer) => {
    setEditId(customer.id);
    setForm({
      name: customer.name, contactPerson: customer.contactPerson,
      phone: customer.phone, email: customer.email,
      address: customer.address, gstNumber: customer.gstNumber,
      creditLimit: customer.creditLimit, lastOrderDate: customer.lastOrderDate || '',
      contacts: customer.contacts || [],
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.contactPerson || !form.phone) {
      addToast('Please fill all required fields', 'error');
      return;
    }
    const data = { ...form, creditLimit: Number(form.creditLimit) || 0 };
    if (editId) {
      updateCustomer(editId, data);
      addToast('Customer updated successfully', 'success');
    } else {
      addCustomer(data);
      addToast('Customer added successfully', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = (id, name) => {
    if (confirm(`Delete customer "${name}"?`)) {
      deleteCustomer(id);
      addToast('Customer deleted', 'success');
    }
  };

  // Contacts helpers
  const addContact = () => setForm(f => ({ ...f, contacts: [...(f.contacts || []), { ...emptyContact }] }));
  const removeContact = (i) => setForm(f => ({ ...f, contacts: f.contacts.filter((_, idx) => idx !== i) }));
  const updateContact = (i, field, value) => {
    setForm(f => {
      const contacts = [...(f.contacts || [])];
      contacts[i] = { ...contacts[i], [field]: value };
      return { ...f, contacts };
    });
  };

  const exportToExcel = () => {
    const data = customers.map(c => ({
      'Company Name': c.name, 'Primary Contact': c.contactPerson,
      'Phone': c.phone, 'Email': c.email,
      'Address': c.address, 'GST Number': c.gstNumber,
      'Additional Contacts': (c.contacts || []).map(ct => `${ct.name} (${ct.phone})`).join('; '),
      'Credit Limit (₹)': c.creditLimit,
      'Last Order Date': c.lastOrderDate || 'N/A',
      'Total Sales (₹)': getCustomerSalesTotal(c.id),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'Customers_Report.xlsx');
    addToast('Exported to Excel', 'success');
  };

  const getAllContacts = (c) => {
    const primary = { name: c.contactPerson, phone: c.phone, email: c.email, designation: 'Primary' };
    return [primary, ...(c.contacts || [])];
  };

  return (
    <div className="slide-up">
      <div className="toolbar">
        <div className="toolbar-left">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input type="text" className="filter-input" placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-secondary" onClick={exportToExcel}><Download size={16} /> Export</button>
          {currentUser?.role === 'admin' && (
            <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Customer</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body no-padding">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>GST Number</th>
                  <th style={{ textAlign: 'right' }}>Credit Limit</th>
                  <th>Last Order</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total Sales</th>
                  {currentUser?.role === 'admin' && <th style={{ textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary-600)' }} onClick={() => setViewCustomer(c)}>
                      {c.name}
                      {(c.contacts || []).length > 0 && (
                        <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--primary-100)', color: 'var(--primary-700)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                          +{c.contacts.length}
                        </span>
                      )}
                    </td>
                    <td>{c.contactPerson}</td>
                    <td>{c.phone}</td>
                    <td><span className="badge badge-neutral">{c.gstNumber}</span></td>
                    <td style={{ textAlign: 'right' }}>₹{(c.creditLimit || 0).toLocaleString('en-IN')}</td>
                    <td>{c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td>
                      {isInactive(c) ? (
                        <span className="badge badge-warning">Inactive</span>
                      ) : (
                        <span className="badge badge-success">Active</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{getCustomerSalesTotal(c.id).toLocaleString('en-IN')}</td>
                    {currentUser?.role === 'admin' && (
                      <td style={{ textAlign: 'center' }}>
                        <div className="btn-group" style={{ justifyContent: 'center' }}>
                          <button className="btn btn-icon btn-outline" onClick={() => openEdit(c)} title="Edit"><Edit2 size={15} /></button>
                          <button className="btn btn-icon btn-outline" onClick={() => handleDelete(c.id, c.name)} title="Delete" style={{ color: 'var(--danger-500)' }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9}><div className="empty-state"><Users size={40} /><h4>No customers found</h4><p>Try adjusting your search</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Customer */}
      {viewCustomer && (
        <div className="modal-overlay" onClick={() => setViewCustomer(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
            <div className="modal-header">
              <h3>{viewCustomer.name}</h3>
              <button className="modal-close" onClick={() => setViewCustomer(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gap: 16 }}>
                {/* All contacts */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contact Persons</div>
                  {getAllContacts(viewCustomer).map((ct, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: i === 0 ? 'var(--primary-50)' : 'var(--gray-50)', borderRadius: 8, marginBottom: 6, border: i === 0 ? '1px solid var(--primary-200)' : '1px solid var(--gray-150)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? 'var(--primary-600)' : 'var(--gray-300)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{(ct.name || '?')[0]?.toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{ct.name} {ct.designation && <span style={{ fontWeight: 400, color: 'var(--gray-500)', fontSize: 11 }}>({ct.designation})</span>}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-600)', display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                          {ct.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} />{ct.phone}</span>}
                          {ct.email && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={11} />{ct.email}</span>}
                        </div>
                      </div>
                      {i === 0 && <span className="badge badge-primary" style={{ fontSize: 9 }}>Primary</span>}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><MapPin size={16} style={{ color: 'var(--gray-400)' }} /><div><div className="text-xs text-muted">Address</div><div>{viewCustomer.address}</div></div></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                    <div className="text-xs text-muted">GST Number</div>
                    <div style={{ fontWeight: 700, letterSpacing: 1 }}>{viewCustomer.gstNumber}</div>
                  </div>
                  <div style={{ padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                    <div className="text-xs text-muted">Credit Limit</div>
                    <div style={{ fontWeight: 700 }}>₹{(viewCustomer.creditLimit || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: '12px 16px', background: 'var(--warning-50)', borderRadius: 'var(--radius-md)' }}>
                    <div className="text-xs text-muted">Last Order Date</div>
                    <div style={{ fontWeight: 700 }}>{viewCustomer.lastOrderDate ? new Date(viewCustomer.lastOrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'}</div>
                  </div>
                  <div style={{ padding: '12px 16px', background: 'var(--primary-50)', borderRadius: 'var(--radius-md)' }}>
                    <div className="text-xs text-muted">Total Sales</div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary-700)' }}>₹{getCustomerSalesTotal(viewCustomer.id).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Company Name *</label>
                  <input type="text" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Reliance Industries Ltd." required />
                </div>

                {/* Primary Contact */}
                <div style={{ padding: '12px 14px', background: 'var(--primary-50)', borderRadius: 8, border: '1px solid var(--primary-200)', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-700)', marginBottom: 8, textTransform: 'uppercase' }}>Primary Contact</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Contact Person *</label>
                      <input type="text" className="form-input" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} placeholder="Full name" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone *</label>
                      <input type="text" className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" required />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@company.in" />
                  </div>
                </div>

                {/* Additional Contacts */}
                {(form.contacts || []).map((ct, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)', marginBottom: 10, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase' }}>Contact #{i + 2}</div>
                      <button type="button" onClick={() => removeContact(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-500)', padding: 2 }}><X size={16} /></button>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Name</label>
                        <input type="text" className="form-input" value={ct.name} onChange={e => updateContact(i, 'name', e.target.value)} placeholder="Full name" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Designation</label>
                        <input type="text" className="form-input" value={ct.designation} onChange={e => updateContact(i, 'designation', e.target.value)} placeholder="e.g. Manager, CEO" />
                      </div>
                    </div>
                    <div className="form-row" style={{ marginBottom: 0 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Phone</label>
                        <input type="text" className="form-input" value={ct.phone} onChange={e => updateContact(i, 'phone', e.target.value)} placeholder="+91" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Email</label>
                        <input type="email" className="form-input" value={ct.email} onChange={e => updateContact(i, 'email', e.target.value)} placeholder="email" />
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" className="btn btn-secondary" onClick={addContact} style={{ width: '100%', marginBottom: 14, borderStyle: 'dashed' }}>
                  <UserPlus size={15} /> Add Another Contact Person
                </button>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">GST Number</label>
                    <input type="text" className="form-input" value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value })} placeholder="e.g. 27AABCR5678Q1ZS" style={{ textTransform: 'uppercase' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Limit (₹)</label>
                    <input type="number" className="form-input" value={form.creditLimit} onChange={e => setForm({ ...form, creditLimit: e.target.value })} placeholder="0" min="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Last Order Date</label>
                  <input type="date" className="form-input" value={form.lastOrderDate} onChange={e => setForm({ ...form, lastOrderDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address with pincode" rows={3} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Add'} Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
