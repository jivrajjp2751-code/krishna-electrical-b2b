import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, CheckCircle, FileCheck, MessageSquare, Download, Clock } from 'lucide-react';
import useStore from '../store/useStore';
import { useNavigate } from 'react-router-dom';

const emptyForm = {
  enquiryNo: '',
  customerId: '',
  date: new Date().toISOString().split('T')[0],
  productId: '',
  quantity: 1,
  notes: ''
};

export default function Enquiries() {
  const navigate = useNavigate();
  const enquiries = useStore(s => s.enquiries) || [];
  const customers = useStore(s => s.customers) || [];
  const products = useStore(s => s.products) || [];
  const addEnquiry = useStore(s => s.addEnquiry);
  const updateEnquiry = useStore(s => s.updateEnquiry);
  const deleteEnquiry = useStore(s => s.deleteEnquiry);
  const addToast = useStore(s => s.addToast);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return enquiries.filter(e => {
      const customer = customers.find(c => c.id === e.customerId);
      const product = products.find(p => p.id === e.productId);
      const matchSearch = !search || 
        (e.enquiryNo || '').toLowerCase().includes(search.toLowerCase()) ||
        (customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (product?.name || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || e.status === statusFilter;
      return matchSearch && matchStatus;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [enquiries, customers, products, search, statusFilter]);

  const pendingCount = enquiries.filter(e => e.status === 'pending').length;
  const completedCount = enquiries.filter(e => e.status === 'completed').length;

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };

  const openEdit = (enq) => {
    setEditId(enq.id);
    setForm({
      enquiryNo: enq.enquiryNo || '',
      customerId: enq.customerId,
      date: enq.date,
      productId: enq.productId,
      quantity: enq.quantity,
      notes: enq.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.enquiryNo || !form.customerId || !form.productId || form.quantity <= 0) {
      addToast('Please fill all required fields', 'error');
      return;
    }
    if (editId) {
      updateEnquiry(editId, form);
      addToast('Enquiry updated', 'success');
    } else {
      addEnquiry(form);
      addToast('Enquiry created', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = (id, no) => {
    if (confirm(`Delete enquiry "${no}"?`)) {
      deleteEnquiry(id);
      addToast('Enquiry deleted', 'success');
    }
  };

  const markCompleted = (id) => {
    updateEnquiry(id, { status: 'completed' });
    addToast('Enquiry marked as completed', 'success');
  };

  const generateQuotation = (enquiry) => {
    navigate(`/quotations?enquiryId=${enquiry.id}`);
  };

  return (
    <div className="slide-up">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input type="text" className="filter-input" placeholder="Search enquiries..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Enquiry</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <div className="stat-icon teal"><MessageSquare size={22} /></div>
          <div className="stat-info"><h4>Total Enquiries</h4><div className="stat-value">{enquiries.length}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Clock size={22} /></div>
          <div className="stat-info"><h4>Pending</h4><div className="stat-value">{pendingCount}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={22} /></div>
          <div className="stat-info"><h4>Completed</h4><div className="stat-value">{completedCount}</div></div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body no-padding">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Enquiry No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(enq => {
                  const customer = customers.find(c => c.id === enq.customerId);
                  const product = products.find(p => p.id === enq.productId);
                  return (
                    <tr key={enq.id}>
                      <td><span className="badge badge-info">{enq.enquiryNo}</span></td>
                      <td>{new Date(enq.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ fontWeight: 600 }}>{customer?.name || 'Unknown'}</td>
                      <td>{product?.name || 'Unknown'}</td>
                      <td style={{ textAlign: 'center' }}>{enq.quantity}</td>
                      <td>
                        {enq.status === 'completed' ? (
                          <span className="badge badge-success">Completed</span>
                        ) : (
                          <span className="badge badge-warning">Pending</span>
                        )}
                      </td>
                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--gray-500)' }}>{enq.notes || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="btn-group" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                          {enq.status === 'pending' ? (
                            <button className="btn btn-sm btn-outline" onClick={() => markCompleted(enq.id)} title="Mark Completed" style={{ color: 'var(--success-600)' }}>
                              <CheckCircle size={14} /> Done
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-primary" onClick={() => generateQuotation(enq)} title="Generate Quotation">
                              <FileCheck size={14} /> Quote
                            </button>
                          )}
                          <button className="btn btn-icon btn-outline" onClick={() => openEdit(enq)} title="Edit"><Edit2 size={15} /></button>
                          <button className="btn btn-icon btn-outline" onClick={() => handleDelete(enq.id, enq.enquiryNo)} title="Delete" style={{ color: 'var(--danger-500)' }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state"><MessageSquare size={40} /><h4>No enquiries found</h4><p>{enquiries.length === 0 ? 'Click "Add Enquiry" to create your first enquiry' : 'Try adjusting your search or filter'}</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Edit Enquiry' : 'Add New Enquiry'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Enquiry No. *</label>
                    <input type="text" className="form-input" value={form.enquiryNo} onChange={e => setForm({ ...form, enquiryNo: e.target.value })} placeholder="e.g. ENQ/SS/01-26/0121" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Enquiry Date *</label>
                    <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Customer *</label>
                  <select className="form-select" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} required>
                    <option value="">Select Customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Product *</label>
                    <select className="form-select" value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })} required>
                      <option value="">Select Product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Quantity *</label>
                    <input type="number" className="form-input" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} min="1" required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Any specific requirements..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Create'} Enquiry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
