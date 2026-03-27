import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Download, Eye, File, Image, FileSpreadsheet } from 'lucide-react';
import useStore from '../store/useStore';
import { uploadFile, getCustomerFiles, deleteFile, getFileUrl } from '../utils/api';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

const FILE_ICONS = {
  'application/pdf': { icon: FileText, color: '#ef4444' },
  'image/': { icon: Image, color: '#3b82f6' },
  'application/vnd': { icon: FileSpreadsheet, color: '#22c55e' },
  'text/': { icon: FileText, color: '#64748b' },
};

const getFileIcon = (type) => {
  for (const [key, val] of Object.entries(FILE_ICONS)) {
    if (type?.startsWith(key)) return val;
  }
  return { icon: File, color: '#94a3b8' };
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

export default function Documents() {
  const customers = useStore(s => s.customers);
  const addToast = useStore(s => s.addToast);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Load documents when customer changes
  useEffect(() => {
    if (!selectedCustomerId) { setDocs([]); return; }
    setLoading(true);
    getCustomerFiles(selectedCustomerId)
      .then(data => setDocs(data || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [selectedCustomerId]);

  // Load preview URL when a doc is selected for preview
  useEffect(() => {
    if (!previewDoc) { setPreviewUrl(''); return; }
    getFileUrl(previewDoc.id, selectedCustomerId).then(url => {
      setPreviewUrl(url || '');
    });
  }, [previewDoc, selectedCustomerId]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!selectedCustomerId) {
      addToast('Please select a customer first', 'error');
      return;
    }

    setUploading(true);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        addToast(`${file.name} exceeds 200MB limit. Skipped.`, 'error');
        continue;
      }

      try {
        const result = await uploadFile(selectedCustomerId, file);
        if (result?.success) {
          addToast(`Uploaded: ${file.name}`, 'success');
          // Refresh document list
          const updated = await getCustomerFiles(selectedCustomerId);
          setDocs(updated || []);
        } else {
          addToast(`Failed to upload: ${file.name}`, 'error');
        }
      } catch (err) {
        addToast(`Failed to upload: ${file.name}`, 'error');
      }
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    try {
      await deleteFile(doc.id);
      setDocs(docs.filter(d => d.id !== doc.id));
      addToast(`Deleted: ${doc.name}`, 'success');
    } catch (err) {
      addToast('Failed to delete document', 'error');
    }
  };

  const handleDownload = async (doc) => {
    try {
      const url = await getFileUrl(doc.id, selectedCustomerId);
      if (!url) {
        addToast('Could not get file URL', 'error');
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast(`Downloading: ${doc.name}`, 'info');
    } catch (err) {
      addToast('Download failed', 'error');
    }
  };

  const canPreview = (type) => type?.startsWith('image/') || type === 'application/pdf';

  return (
    <div className="slide-up">
      {/* Customer Selector + Upload */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 280px', marginBottom: 0 }}>
              <label className="form-label">Select Customer</label>
              <select className="form-select" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}>
                <option value="">— Choose a customer —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {selectedCustomerId && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.csv,.zip,.rar"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload (Max 200MB)'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {!selectedCustomerId ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <FileText size={48} />
              <h4>Select a Customer</h4>
              <p>Choose a customer from the dropdown to manage their documents</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3>{selectedCustomer?.name} — Documents ({docs.length})</h3>
          </div>
          <div className="card-body no-padding">
            {loading ? (
              <div className="empty-state">
                <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>Loading documents...</div>
              </div>
            ) : docs.length === 0 ? (
              <div className="empty-state">
                <Upload size={40} />
                <h4>No documents uploaded</h4>
                <p>Upload PDF, images, Word, Excel, ZIP files (max 200MB each)</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 0 }}>
                {docs.sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || '')).map(doc => {
                  const { icon: IconComp, color } = getFileIcon(doc.type);
                  return (
                    <div key={doc.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 18px', borderBottom: '1px solid var(--gray-100)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 'var(--radius-md)',
                        background: `${color}15`, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                      }}>
                        <IconComp size={20} style={{ color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                          {formatFileSize(doc.size)} • {new Date(doc.uploadDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div className="btn-group">
                        {canPreview(doc.type) && (
                          <button className="btn btn-icon btn-outline" onClick={() => setPreviewDoc(doc)} title="Preview">
                            <Eye size={15} />
                          </button>
                        )}
                        <button className="btn btn-icon btn-outline" onClick={() => handleDownload(doc)} title="Download">
                          <Download size={15} />
                        </button>
                        <button className="btn btn-icon btn-outline" onClick={() => handleDelete(doc)} title="Delete" style={{ color: 'var(--danger-500)' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3>{previewDoc.name}</h3>
              <button className="modal-close" onClick={() => setPreviewDoc(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflow: 'auto', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-100)' }}>
              {!previewUrl ? (
                <div className="empty-state">
                  <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>Loading preview...</div>
                </div>
              ) : previewDoc.type?.startsWith('image/') ? (
                <img src={previewUrl} alt={previewDoc.name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
              ) : previewDoc.type === 'application/pdf' ? (
                <iframe src={previewUrl} style={{ width: '100%', height: '70vh', border: 'none' }} title={previewDoc.name} />
              ) : (
                <div className="empty-state">
                  <FileText size={48} />
                  <h4>Preview not available</h4>
                  <p>Download the file to view it</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreviewDoc(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => handleDownload(previewDoc)}><Download size={14} /> Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
