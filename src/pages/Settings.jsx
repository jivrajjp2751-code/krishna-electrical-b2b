import { useState } from 'react';
import { Save, Building, CreditCard, Shield, Eye, EyeOff, Lock } from 'lucide-react';
import useStore from '../store/useStore';

export default function Settings() {
  const companyInfo = useStore(s => s.companyInfo);
  const updateCompanyInfo = useStore(s => s.updateCompanyInfo);
  const currentUser = useStore(s => s.currentUser);
  const changePassword = useStore(s => s.changePassword);
  const addToast = useStore(s => s.addToast);

  const [form, setForm] = useState({ ...companyInfo });
  const [activeTab, setActiveTab] = useState('company');

  // Password state
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    updateCompanyInfo({
      ...form,
      gstRate: Number(form.gstRate) || 18,
      reminderDays: Number(form.reminderDays) || 30,
    });
    addToast('Settings saved successfully', 'success');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      addToast('Please fill all password fields', 'error');
      return;
    }
    if (pwForm.newPw.length < 6) {
      addToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      addToast('New passwords do not match', 'error');
      return;
    }
    const result = await changePassword(currentUser.id, pwForm.current, pwForm.newPw);
    if (result.success) {
      addToast('Password changed successfully! Use new password on next login.', 'success');
      setPwForm({ current: '', newPw: '', confirm: '' });
    } else {
      addToast(result.message, 'error');
    }
  };

  return (
    <div className="slide-up">
      <div className="tabs">
        <div className={`tab ${activeTab === 'company' ? 'active' : ''}`} onClick={() => setActiveTab('company')}>Company Info</div>
        <div className={`tab ${activeTab === 'tax' ? 'active' : ''}`} onClick={() => setActiveTab('tax')}>Tax & GST</div>
        <div className={`tab ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Shield size={13} /> Security</span>
        </div>
      </div>

      {activeTab !== 'security' && (
        <div className="card">
          <form onSubmit={handleSave}>
            <div className="card-body">
              {activeTab === 'company' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                    <Building size={20} style={{ color: 'var(--primary-600)' }} />
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>Company Information</h3>
                      <p className="text-sm text-muted">This information appears on your invoices</p>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <input type="text" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <textarea className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={3} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input type="text" className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tax' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                    <CreditCard size={20} style={{ color: 'var(--primary-600)' }} />
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>Tax & GST Settings</h3>
                      <p className="text-sm text-muted">Configure GST rates and tax identifiers</p>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">GST Number</label>
                      <input type="text" className="form-input" value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value })} style={{ textTransform: 'uppercase' }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">PAN Number</label>
                      <input type="text" className="form-input" value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value })} style={{ textTransform: 'uppercase' }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Rate (%)</label>
                    <input type="number" className="form-input" value={form.gstRate} onChange={e => setForm({ ...form, gstRate: e.target.value })} min="0" max="100" style={{ maxWidth: 200 }} />
                    <p className="text-sm text-muted" style={{ marginTop: 4 }}>This rate will be split equally between CGST and SGST on invoices</p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 22px', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">
                <Save size={16} /> Save Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card" style={{ maxWidth: 520 }}>
          <form onSubmit={handleChangePassword}>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', color: 'var(--danger-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Change Admin Password</h3>
                  <p className="text-sm text-muted">Update your login password for security</p>
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--primary-50)', borderRadius: 8, border: '1px solid var(--primary-200)', marginBottom: 20, fontSize: 12, color: 'var(--primary-700)' }}>
                <strong>Logged in as:</strong> {currentUser?.name} ({currentUser?.username})
              </div>

              <div className="form-group">
                <label className="form-label">Current Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    className="form-input"
                    value={pwForm.current}
                    onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                    placeholder="Enter your current password"
                    required
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 2 }}>
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">New Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNew ? 'text' : 'password'}
                    className="form-input"
                    value={pwForm.newPw}
                    onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 2 }}>
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={pwForm.confirm}
                  onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                  placeholder="Re-enter new password"
                  required
                />
                {pwForm.confirm && pwForm.newPw && pwForm.confirm !== pwForm.newPw && (
                  <p className="form-error">Passwords do not match</p>
                )}
                {pwForm.confirm && pwForm.newPw && pwForm.confirm === pwForm.newPw && (
                  <p style={{ color: 'var(--success-600)', fontSize: 11, marginTop: 4 }}>✓ Passwords match</p>
                )}
              </div>
            </div>

            <div style={{ padding: '16px 22px', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPwForm({ current: '', newPw: '', confirm: '' })}>Clear</button>
              <button type="submit" className="btn btn-danger" disabled={!pwForm.current || !pwForm.newPw || pwForm.newPw !== pwForm.confirm}>
                <Lock size={14} /> Change Password
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
