import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, Mail, MessageCircle, FileCheck, Search, Eye, ArrowLeft, FolderOpen, Upload, FileText, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
applyPlugin(jsPDF);
import { useSearchParams } from 'react-router-dom';
import useStore from '../store/useStore';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const STORAGE_KEY = 'quotationFiles';

const loadFiles = () => {
  try {
    const files = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (files.length > 0) return files;
    // Migrate old quotations into files grouped by customer
    const old = JSON.parse(localStorage.getItem('quotations') || '[]');
    if (old.length === 0) return [];
    const grouped = {};
    old.forEach(q => {
      const key = q.customerId + '|' + (q.refEnquiryNo || 'general');
      if (!grouped[key]) grouped[key] = { customerId: q.customerId, customerName: q.customerName, refEnquiryNo: q.refEnquiryNo || '', refEnquiryDate: q.refEnquiryDate || '', quotations: [] };
      grouped[key].quotations.push(q);
    });
    const migrated = Object.values(grouped).map(g => ({
      id: generateId(), name: `${g.customerName}${g.refEnquiryNo ? ' - ' + g.refEnquiryNo : ''}`,
      customerId: g.customerId, customerName: g.customerName,
      refEnquiryNo: g.refEnquiryNo, refEnquiryDate: g.refEnquiryDate,
      poFile: null, poFileName: '', createdAt: g.quotations[0]?.createdAt || new Date().toISOString(),
      quotations: g.quotations.map((q, i) => ({ ...q, version: i + 1 })),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch { return []; }
};

const saveFiles = (files) => localStorage.setItem(STORAGE_KEY, JSON.stringify(files));

export default function Quotations() {
  const products = useStore(s => s.products);
  const customers = useStore(s => s.customers);
  const enquiries = useStore(s => s.enquiries);
  const companyInfo = useStore(s => s.companyInfo);
  const addToast = useStore(s => s.addToast);
  const [searchParams, setSearchParams] = useSearchParams();

  const [files, setFiles] = useState(loadFiles);
  const [activeFileId, setActiveFileId] = useState(null);
  const [viewQuot, setViewQuot] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [search, setSearch] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileCustomerId, setFileCustomerId] = useState('');
  const [fileEnqNo, setFileEnqNo] = useState('');
  const [fileEnqDate, setFileEnqDate] = useState('');
  const poInputRef = useRef(null);

  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return {
      revisionName: '',
      date: new Date().toISOString().split('T')[0],
      validity: '1 month',
      notes: 'Taxes are extra as applicable,',
      items: [{ description: '', uom: 'Nos', quantity: 1, rate: '', hsnCode: '', discount: '' }],
    };
  }

  const activeFile = files.find(f => f.id === activeFileId);

  // Handle enquiry deep-link
  useEffect(() => {
    const enquiryId = searchParams.get('enquiryId');
    if (enquiryId && enquiries) {
      const enq = enquiries.find(e => e.id === enquiryId);
      if (enq) {
        const product = products.find(p => p.id === enq.productId);
        const customer = customers.find(c => c.id === enq.customerId);
        setTimeout(() => {
          // Create a new file for this enquiry
          setFileCustomerId(enq.customerId);
          setFileEnqNo(enq.enquiryNo || '');
          setFileEnqDate(enq.date || '');
          setFileName(`${customer?.name || ''} - ${enq.enquiryNo || 'Quotation'}`);
          setForm({
            date: new Date().toISOString().split('T')[0],
            validity: '1 month', notes: 'Taxes are extra as applicable,',
            items: [{ description: product?.name || '', uom: product?.unit || 'Nos', quantity: enq.quantity || 1, rate: product?.sellingPrice || '', hsnCode: product?.hsnCode || '', discount: '' }],
          });
          setShowFileModal(true);
        }, 0);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, enquiries, products, customers, setSearchParams]);

  const updateFiles = (updated) => { setFiles(updated); saveFiles(updated); };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', uom: 'Nos', quantity: 1, rate: '', hsnCode: '', discount: '' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) => { setForm(f => { const items = [...f.items]; items[i] = { ...items[i], [field]: value }; return { ...f, items }; }); };
  const selectProduct = (i, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) setForm(f => { const items = [...f.items]; items[i] = { ...items[i], description: product.name, uom: product.unit || 'Nos', rate: product.sellingPrice, hsnCode: product.hsnCode || '' }; return { ...f, items }; });
  };

  const getItemTotal = (item) => {
    const raw = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    const disc = Number(item.discount) || 0;
    return raw - (raw * disc / 100);
  };
  const getItemRawTotal = (item) => (Number(item.quantity) || 0) * (Number(item.rate) || 0);
  const grandTotal = form.items.reduce((s, it) => s + getItemTotal(it), 0);
  const rawTotal = form.items.reduce((s, it) => s + getItemRawTotal(it), 0);
  const totalDiscount = rawTotal - grandTotal;

  // Create new file
  const createFile = () => {
    if (!fileCustomerId) { addToast('Select a customer', 'error'); return; }
    if (!fileName.trim()) { addToast('Enter a file name', 'error'); return; }
    const customer = customers.find(c => c.id === fileCustomerId);
    const newFile = {
      id: generateId(), name: fileName.trim(), customerId: fileCustomerId, customerName: customer?.name || '',
      refEnquiryNo: fileEnqNo, refEnquiryDate: fileEnqDate, poFile: null, poFileName: '',
      createdAt: new Date().toISOString(), quotations: [],
    };
    const updated = [newFile, ...files];
    updateFiles(updated);
    setActiveFileId(newFile.id);
    setShowFileModal(false);
    setFileName(''); setFileCustomerId(''); setFileEnqNo(''); setFileEnqDate('');
    addToast(`File "${newFile.name}" created!`, 'success');
    // If form has items from enquiry, open quotation modal
    if (form.items[0]?.description) setShowModal(true);
  };

  const deleteFile = (id) => {
    if (!confirm('Delete this file and all its quotations?')) return;
    updateFiles(files.filter(f => f.id !== id));
    if (activeFileId === id) setActiveFileId(null);
    addToast('File deleted', 'success');
  };

  // Save quotation inside active file
  const saveQuotation = (e) => {
    e.preventDefault();
    if (!activeFile) return;
    if (!form.revisionName.trim()) { addToast('Enter a revision name', 'error'); return; }
    if (form.items.some(it => !it.description || !it.quantity || !it.rate)) { addToast('Fill all item fields', 'error'); return; }

    const yr = new Date().getFullYear().toString().slice(-2);
    const allQuots = files.reduce((n, f) => n + (f.quotations?.length || 0), 0);
    const quotNo = `${allQuots + 1}/${yr}-${Number(yr) + 1}`;

    const quot = {
      id: generateId(), quotNo, revisionName: form.revisionName.trim(), date: form.date, validity: form.validity, notes: form.notes,
      customerId: activeFile.customerId, customerName: activeFile.customerName,
      refEnquiryNo: activeFile.refEnquiryNo, refEnquiryDate: activeFile.refEnquiryDate,
      items: form.items.map(it => ({ ...it, total: getItemTotal(it), rawTotal: getItemRawTotal(it) })),
      grandTotal, rawTotal, totalDiscount, createdAt: new Date().toISOString(),
    };
    const updated = files.map(f => f.id === activeFileId ? { ...f, quotations: [...(f.quotations || []), quot] } : f);
    updateFiles(updated);
    addToast(`Quotation "${quot.revisionName}" saved!`, 'success');
    setShowModal(false);
    setForm(getEmptyForm());
  };

  const deleteQuotation = (quotId) => {
    if (!confirm('Delete this quotation revision?')) return;
    const updated = files.map(f => f.id === activeFileId ? { ...f, quotations: f.quotations.filter(q => q.id !== quotId) } : f);
    updateFiles(updated);
    setViewQuot(null);
    addToast('Quotation deleted', 'success');
  };

  // PO Upload
  const handlePOUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const updated = files.map(f => f.id === activeFileId ? { ...f, poFile: ev.target.result, poFileName: file.name } : f);
      updateFiles(updated);
      addToast('PO uploaded!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const viewPO = () => {
    if (!activeFile?.poFile) return;
    const win = window.open();
    if (activeFile.poFile.startsWith('data:application/pdf')) {
      win.document.write(`<iframe src="${activeFile.poFile}" style="width:100%;height:100%;border:none"></iframe>`);
    } else {
      win.document.write(`<img src="${activeFile.poFile}" style="max-width:100%;height:auto">`);
    }
  };

  // ═══════════════════════════════════════════
  //  QUOTATION PDF — accepts fileData so it works from any context
  // ═══════════════════════════════════════════
  const buildQuotPDF = (quot, fileData) => {
    const fd = fileData || activeFile || {};
    const customer = customers.find(c => c.id === (quot.customerId || fd.customerId));
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const m = 10;
    let y = 8;

    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`(M): ${companyInfo.phone}`, m, y + 3);
    if (companyInfo.phone2) { doc.setFont('helvetica', 'italic'); doc.text(`(M):`, pw - m - 30, y); doc.text(companyInfo.phone2, pw - m, y + 3, { align: 'right' }); }
    y += 7;

    doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 100, 0);
    doc.text('KRISHNA ELECTRICAL WORKS', pw / 2, y + 2, { align: 'center' }); y += 10;

    doc.setFontSize(8); doc.setTextColor(0, 0, 180); doc.setFont('helvetica', 'bold');
    doc.text('-: SPECILIST IN:-', pw / 2, y, { align: 'center' }); y += 4;

    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
    const specLines = doc.splitTextToSize(companyInfo.specialty || '', pw - m * 2 - 10);
    specLines.forEach(l => { doc.text(l, pw / 2, y, { align: 'center' }); y += 3; }); y += 2;

    doc.setDrawColor(0, 100, 0); doc.setLineWidth(1); doc.line(m, y, pw - m, y); y += 4;
    doc.setFontSize(7); doc.setTextColor(0, 100, 0);
    doc.text(`Office: ${companyInfo.address}`, pw / 2, y, { align: 'center' }); y += 5;

    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 100, 0);
    doc.text('QUOTATION', pw / 2, y + 2, { align: 'center' }); y += 8;

    doc.setTextColor(0, 0, 0); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('Client', m, y); doc.text('Name:', m, y + 4);
    const cname = doc.splitTextToSize(customer?.name || fd.customerName || quot.customerName || '', 55);
    let cny = y + 8;
    cname.forEach(l => { doc.text(l, m, cny); cny += 4; });

    const rx = pw / 2 + 8; let ry = y;
    doc.text('Quot No.', rx, ry); doc.text(quot.quotNo || '', rx + 35, ry); ry += 5;
    doc.text('Date:', rx, ry); doc.text(new Date(quot.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }), rx + 35, ry); ry += 5;
    const enqNo = quot.refEnquiryNo || fd.refEnquiryNo;
    const enqDate = quot.refEnquiryDate || fd.refEnquiryDate;
    if (enqNo) { doc.text('Ref/ Enqu No:', rx, ry); doc.text(enqNo, rx + 35, ry); ry += 5; }
    if (enqDate) { doc.text('Date:', rx, ry); doc.text(new Date(enqDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }), rx + 35, ry); ry += 5; }

    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    const caddr = doc.splitTextToSize(customer?.address || '', 70);
    caddr.forEach(l => { doc.text(l, m, cny); cny += 3.5; });
    if (customer?.gstNumber) { doc.setFont('helvetica', 'bold'); doc.text(`GSTN/UIN:  ${customer.gstNumber}`, m, cny); cny += 4; }
    doc.setFont('helvetica', 'normal'); doc.text('PAN NO:', m, cny);
    if (customer?.email) doc.text(`Mail ID-`, m + 60, cny); cny += 4;

    y = Math.max(cny, ry) + 3;
    doc.setDrawColor(0); doc.setLineWidth(0.4);

    const itemRows = quot.items.map((item, i) => [
      `${i + 1}]`, item.description + (item.hsnCode ? `\nHSN- ${item.hsnCode}` : ''), item.uom,
      Number(item.quantity), Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      Number(item.rawTotal || item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    ]);

    doc.autoTable({
      startY: y, head: [['SR. NO.', 'DISCRIPTION', 'UOM', 'Qty', 'RATE', 'AMOUNT']],
      body: itemRows, theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineWidth: 0.4, lineColor: [0, 0, 0], halign: 'center' },
      styles: { fontSize: 8, cellPadding: 3, lineWidth: 0.4, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: 18, halign: 'center' }, 1: { cellWidth: 70 }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 14, halign: 'center' }, 4: { cellWidth: 28, halign: 'right' }, 5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' } },
      margin: { left: m, right: m },
    });

    let fy = doc.lastAutoTable.finalY;
    if (quot.validity) { fy += 6; doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(`Validity- ${quot.validity}`, m + 5, fy); fy += 8; }
    if (quot.notes) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(quot.notes, m + 5, fy); fy += 10; }

    // Totals: Sub Total → Discount → CGST → SGST → Round off → Total
    const subtotalRaw = quot.rawTotal || quot.grandTotal;
    const discAmt = quot.totalDiscount || 0;
    const subtotalAfterDisc = quot.grandTotal;
    const halfGst = (companyInfo.gstRate || 18) / 2;
    const cgst = subtotalAfterDisc * halfGst / 100;
    const sgst = subtotalAfterDisc * halfGst / 100;
    const totalBR = subtotalAfterDisc + cgst + sgst;
    const total = Math.round(totalBR);
    const roundOff = total - totalBR;

    const tw = pw - m * 2; const tlw = tw * 0.55; const trw = tw * 0.45;
    const boxH = discAmt > 0 ? 52 : 44;
    doc.rect(m, fy, tlw, boxH); doc.rect(m + tlw, fy, trw, boxH);

    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
    const cenvat = '"This is to certify that we are not availing any CENVAT Credit on inputs and that our firm is individual / HUF / Proprietary Firm / Partnership Firm / AQP"';
    const cenLines = doc.splitTextToSize(cenvat, tlw - 8);
    let cey = fy + 8; cenLines.forEach(l => { doc.text(l, m + 4, cey); cey += 3.5; });

    const trx2 = m + tlw + 3; const trr2 = pw - m - 4; let tr2y = fy + 8;
    const drawT = (label, val, bold) => { doc.setFontSize(8); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(label, trx2, tr2y); doc.text(val, trr2, tr2y, { align: 'right' }); tr2y += 8; };
    drawT('Sub Total', subtotalRaw.toLocaleString('en-IN', { minimumFractionDigits: 2 }), false);
    if (discAmt > 0) { const discPct = subtotalRaw > 0 ? ((discAmt / subtotalRaw) * 100).toFixed(1) : '0'; drawT(`Discount @ ${discPct}%`, `- ${discAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, true); }
    drawT(`CGST @ ${halfGst}%`, cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }), true);
    drawT(`SGST @  ${halfGst}%`, sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }), true);
    drawT('Round off', roundOff.toFixed(2), false);

    fy += boxH;
    doc.rect(m, fy, tlw, 10); doc.rect(m + tlw, fy, trw, 10);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Rs:', m + 3, fy + 7); doc.text('Total Rs.', m + tlw + 3, fy + 7);
    doc.text(total.toLocaleString('en-IN', { minimumFractionDigits: 2 }), trr2, fy + 7, { align: 'right' }); fy += 10;

    doc.rect(m, fy, tw, 20); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`GSTN NO:  ${companyInfo.gstNumber}`, m + 3, fy + 7);
    doc.text('Client Sign.', m + 3, fy + 15);
    doc.text(`FOR   Krishna Electrical Works`, m + tw * 0.55, fy + 10);
    return doc;
  };

  const generateQuotPDF = (quot, fileData) => {
    try {
      const doc = buildQuotPDF(quot, fileData);
      doc.save(`Quotation_${quot.quotNo.replace(/\//g, '-')}.pdf`);
      addToast('PDF downloaded', 'success');
    } catch (err) {
      console.error('PDF generation error:', err);
      addToast('Error generating PDF: ' + err.message, 'error');
    }
  };

  // Share: Open direct contact (File must be attached manually by user)
  const shareQuot = async (quot, method, fileData) => {
    try {
      const doc = buildQuotPDF(quot, fileData);
      const filename = `Quotation_${quot.quotNo.replace(/\//g, '-')}.pdf`;
      
      const custId = quot.customerId || fileData?.customerId || activeFile?.customerId;
      const customer = customers.find(c => c.id === custId);
      const phone = (customer?.phone || '').replace(/[^0-9]/g, '');

      // Download PDF first because we cannot auto-attach to direct chat links
      doc.save(filename);
      addToast('PDF Downloaded! Please attach it to your message manually.', 'info');
      
      setTimeout(() => {
        if (method === 'whatsapp') {
          const text = encodeURIComponent(`*QUOTATION - Krishna Electrical Works*\nQuot No: ${quot.quotNo}\nTotal: ₹${quot.grandTotal.toLocaleString('en-IN')}\n\nPDF is attached separately.\n\nMob: ${companyInfo.phone}`);
          window.open(`https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${text}`, '_blank');
        } else {
          const subject = encodeURIComponent(`Quotation ${quot.quotNo} - Krishna Electrical Works`);
          const body = encodeURIComponent(`Dear Sir/Madam,\n\nPlease find our quotation PDF attached.\n\nQuot No: ${quot.quotNo}\nTotal: Rs.${quot.grandTotal.toLocaleString('en-IN')}\n\nRegards,\nKrishna Electrical Works\nMob: ${companyInfo.phone}`);
          const toEmail = customer?.email || '';
          window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${toEmail}&su=${subject}&body=${body}`, '_blank');
        }
      }, 500);
    } catch (err) {
      console.error('Share error:', err);
      addToast('Error: ' + err.message, 'error');
    }
  };

  const filteredFiles = files.filter(f => !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.customerName?.toLowerCase().includes(search.toLowerCase()));

  // ═══════════════════════════════════
  //  VIEW QUOTATION MODE
  // ═══════════════════════════════════
  if (viewQuot && activeFile) {
    const customer = customers.find(c => c.id === activeFile.customerId);
    const halfGst = (companyInfo.gstRate || 18) / 2;
    const subtotalRaw = viewQuot.rawTotal || viewQuot.grandTotal;
    const discAmt = viewQuot.totalDiscount || 0;
    const sub = viewQuot.grandTotal;
    const cgst = sub * halfGst / 100;
    const sgst = sub * halfGst / 100;
    const total = Math.round(sub + cgst + sgst);

    return (
      <div className="slide-up">
        <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setViewQuot(null)}><ArrowLeft size={16} /> Back</button>
          <button className="btn btn-primary" onClick={() => generateQuotPDF(viewQuot, activeFile)}><Download size={16} /> Download PDF</button>
          <button className="btn btn-success" onClick={() => shareQuot(viewQuot, 'whatsapp', activeFile)}><MessageCircle size={16} /> WhatsApp</button>
          <button className="btn btn-secondary" onClick={() => shareQuot(viewQuot, 'email', activeFile)}><Mail size={16} /> Email</button>
        </div>

        <div className="card">
          <div className="card-body" style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: 'var(--gray-500)' }}>(M): {companyInfo.phone} &nbsp;&nbsp; {companyInfo.phone2 ? `(M): ${companyInfo.phone2}` : ''}</div>
              <h2 style={{ fontSize: 22, color: '#006400', margin: '4px 0' }}>KRISHNA ELECTRICAL WORKS</h2>
              <div style={{ fontSize: 9, color: '#0000b4', fontWeight: 700 }}>-: SPECILIST IN:-</div>
              <div style={{ fontSize: 8, color: 'var(--gray-700)', margin: '4px 20px', lineHeight: 1.4 }}>{companyInfo.specialty}</div>
              <div style={{ borderTop: '2px solid #006400', margin: '8px 0', paddingTop: 4, fontSize: 8, color: '#006400' }}>Office: {companyInfo.address}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#006400', marginTop: 8 }}>QUOTATION</div>
            </div>

            <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 11, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div><strong>Client Name:</strong></div>
                <div style={{ fontWeight: 700 }}>{customer?.name || activeFile.customerName}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-600)', marginTop: 2 }}>{customer?.address}</div>
                {customer?.gstNumber && <div><strong>GSTN/UIN:</strong> {customer.gstNumber}</div>}
              </div>
              <div style={{ minWidth: 180 }}>
                <div><strong>Quot No.</strong> &nbsp; {viewQuot.quotNo}</div>
                <div><strong>Date:</strong> &nbsp; {new Date(viewQuot.date).toLocaleDateString('en-IN')}</div>
                {activeFile.refEnquiryNo && <div><strong>Ref/ Enqu No:</strong> &nbsp; {activeFile.refEnquiryNo}</div>}
              </div>
            </div>

            <table className="invoice-table" style={{ marginBottom: 12 }}>
              <thead><tr><th>SR.</th><th>DESCRIPTION</th><th>UOM</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>RATE</th><th style={{ textAlign: 'right' }}>AMOUNT</th></tr></thead>
              <tbody>
                {viewQuot.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>{i + 1}]</td>
                    <td style={{ fontWeight: 600 }}>{it.description}{it.hsnCode ? <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>HSN- {it.hsnCode}</div> : null}</td>
                    <td>{it.uom}</td>
                    <td style={{ textAlign: 'right' }}>{it.quantity}</td>
                    <td style={{ textAlign: 'right' }}>₹{Number(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(it.rawTotal || it.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {viewQuot.validity && <div style={{ fontSize: 13, fontWeight: 'bold', color: '#b91c1c', marginBottom: 4, padding: '4px 8px', background: '#fef2f2', display: 'inline-block', borderRadius: 4 }}>Validity- {viewQuot.validity}</div>}
            {viewQuot.notes && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 12 }}>{viewQuot.notes}</div>}

            {/* Totals with discount shown like GST */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <div style={{ width: 280, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--gray-200)' }}><span>Sub Total</span><span>₹{subtotalRaw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                {discAmt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--gray-200)', color: '#dc2626' }}><strong>Discount</strong><span>- ₹{discAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--gray-200)' }}><strong>CGST @ {halfGst}%</strong><span>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--gray-200)' }}><strong>SGST @ {halfGst}%</strong><span>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: 800, fontSize: 14, color: 'var(--primary-700)' }}><span>Total Rs.</span><span>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-200)', paddingTop: 12 }}>
              <div>GSTN NO: {companyInfo.gstNumber}<br />Client Sign.</div>
              <div style={{ textAlign: 'right' }}>FOR Krishna Electrical Works</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  //  FILE DETAIL VIEW (inside a file)
  // ═══════════════════════════════════
  if (activeFile) {
    return (
      <div className="slide-up">
        <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setActiveFileId(null)}><ArrowLeft size={16} /> Back to Files</button>
          <h3 style={{ margin: 0, flex: 1 }}><FolderOpen size={18} style={{ marginRight: 6 }} />{activeFile.name}</h3>
        </div>

        {/* File Info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
              <div><strong>Customer:</strong> {activeFile.customerName}</div>
              {activeFile.refEnquiryNo && <div><strong>Enquiry Ref:</strong> {activeFile.refEnquiryNo}</div>}
              <div><strong>Created:</strong> {new Date(activeFile.createdAt).toLocaleDateString('en-IN')}</div>
              <div><strong>Revisions:</strong> {activeFile.quotations?.length || 0}</div>
            </div>
          </div>
        </div>

        {/* PO Upload Section */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header" style={{ background: 'var(--accent-50)' }}><h4 style={{ margin: 0, fontSize: 13 }}>📋 Purchase Order (PO)</h4></div>
          <div className="card-body" style={{ padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" ref={poInputRef} accept="image/*,.pdf" onChange={handlePOUpload} style={{ display: 'none' }} />
            <button className="btn btn-outline" onClick={() => poInputRef.current?.click()}><Upload size={14} /> {activeFile.poFile ? 'Replace PO' : 'Upload PO'}</button>
            {activeFile.poFile && (
              <>
                <button className="btn btn-primary" onClick={viewPO}><Eye size={14} /> View PO: {activeFile.poFileName}</button>
                <button className="btn btn-outline" onClick={() => { const updated = files.map(f => f.id === activeFileId ? { ...f, poFile: null, poFileName: '' } : f); updateFiles(updated); }} style={{ color: 'var(--danger-500)' }}><Trash2 size={14} /></button>
              </>
            )}
            {!activeFile.poFile && <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>No PO uploaded yet</span>}
          </div>
        </div>

        {/* Quotation Revisions */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Quotation Revisions</h4>
            <button className="btn btn-primary btn-sm" onClick={() => { setForm(getEmptyForm()); setShowModal(true); }}><Plus size={14} /> New Revision</button>
          </div>
          <div className="card-body no-padding">
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Quot No.</th><th>Date</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
                <tbody>
                  {(activeFile.quotations || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(q => (
                    <tr key={q.id}>
                      <td><span className="badge badge-info">{q.revisionName || `v${q.version || '?'}`}</span></td>
                      <td>{q.quotNo}</td>
                      <td>{new Date(q.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{(q.grandTotal || 0).toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="btn-group" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button className="btn btn-sm btn-outline" onClick={() => setViewQuot(q)}><Eye size={13} /> View</button>
                          <button className="btn btn-sm btn-primary" onClick={() => generateQuotPDF(q, activeFile)}><Download size={13} /> PDF</button>
                          <button className="btn btn-sm btn-success" onClick={() => shareQuot(q, 'whatsapp', activeFile)} title="WhatsApp"><MessageCircle size={13} /></button>
                          <button className="btn btn-sm btn-secondary" onClick={() => shareQuot(q, 'email', activeFile)} title="Email"><Mail size={13} /></button>
                          <button className="btn btn-sm btn-outline" onClick={() => deleteQuotation(q.id)} style={{ color: 'var(--danger-500)' }}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!activeFile.quotations || activeFile.quotations.length === 0) && (
                    <tr><td colSpan={5}><div className="empty-state"><FileCheck size={40} /><h4>No quotations yet</h4><p>Click "New Revision" to create first quotation</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CREATE QUOTATION MODAL */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>New Quotation — {activeFile.name}</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <form onSubmit={saveQuotation} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label">Revision Name *</label><input type="text" className="form-input" value={form.revisionName} onChange={e => setForm({ ...form, revisionName: e.target.value })} placeholder="e.g. Initial Quote, 5% Discount, Final Offer" required /></div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Date *</label><input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
                    <div className="form-group"><label className="form-label">Validity</label><input type="text" className="form-input" value={form.validity} onChange={e => setForm({ ...form, validity: e.target.value })} /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Notes</label><input type="text" className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ fontSize: 13 }}>Items</strong>
                      <button type="button" className="btn btn-sm btn-outline" onClick={addItem}><Plus size={14} /> Add Item</button>
                    </div>

                    {form.items.map((item, i) => (
                      <div key={i} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--gray-50)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <strong style={{ fontSize: 12, color: 'var(--primary-600)' }}>Item {i + 1}</strong>
                          {form.items.length > 1 && <button type="button" className="btn btn-sm btn-outline" onClick={() => removeItem(i)} style={{ color: 'var(--danger-500)', padding: '2px 8px' }}><Trash2 size={13} /></button>}
                        </div>
                        <div style={{ marginBottom: 6 }}>
                          <select className="form-select" style={{ fontSize: 11, marginBottom: 6 }} onChange={e => selectProduct(i, e.target.value)} defaultValue="">
                            <option value="">— Select from products or type custom below —</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.sellingPrice})</option>)}
                          </select>
                          <input type="text" className="form-input" style={{ fontSize: 12 }} value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description" required />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                          <div><label style={{ fontSize: 10, color: 'var(--gray-500)' }}>UOM</label><input type="text" className="form-input" style={{ fontSize: 11 }} value={item.uom} onChange={e => updateItem(i, 'uom', e.target.value)} /></div>
                          <div><label style={{ fontSize: 10, color: 'var(--gray-500)' }}>Qty</label><input type="number" className="form-input" style={{ fontSize: 11 }} value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} min="0" step="0.01" required /></div>
                          <div><label style={{ fontSize: 10, color: 'var(--gray-500)' }}>Rate (₹)</label><input type="number" className="form-input" style={{ fontSize: 11 }} value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} min="0" step="0.01" required /></div>
                          <div><label style={{ fontSize: 10, color: 'var(--gray-500)' }}>Disc (%)</label><input type="number" className="form-input" style={{ fontSize: 11 }} value={item.discount} onChange={e => updateItem(i, 'discount', e.target.value)} min="0" max="100" /></div>
                          <div><label style={{ fontSize: 10, color: 'var(--gray-500)' }}>Amount</label><div style={{ fontSize: 14, fontWeight: 700, padding: '8px 0', color: 'var(--primary-700)' }}>₹{getItemTotal(item).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div></div>
                        </div>
                      </div>
                    ))}

                    {grandTotal > 0 && (
                      <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, var(--primary-50), var(--accent-50))', borderRadius: 8, textAlign: 'right' }}>
                        {totalDiscount > 0 && <div style={{ fontSize: 11, color: '#dc2626' }}>Discount: - ₹{totalDiscount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>}
                        <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>Grand Total (before tax)</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-700)' }}>₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-success">Save Quotation</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════
  //  MAIN FILES LIST VIEW
  // ═══════════════════════════════════
  return (
    <div className="slide-up">
      <div className="toolbar">
        <div className="toolbar-left">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input type="text" className="filter-input" placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowFileModal(true)}><Plus size={16} /> New Quotation File</button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card"><div className="stat-icon teal"><FolderOpen size={22} /></div><div className="stat-info"><h4>Total Files</h4><div className="stat-value">{files.length}</div></div></div>
        <div className="stat-card"><div className="stat-icon blue"><FileCheck size={22} /></div><div className="stat-info"><h4>Total Quotations</h4><div className="stat-value">{files.reduce((n, f) => n + (f.quotations?.length || 0), 0)}</div></div></div>
      </div>

      {/* Files Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {filteredFiles.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(f => (
          <div key={f.id} className="card" style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onClick={() => setActiveFileId(f.id)}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
            <div className="card-body" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary-100), var(--primary-200))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FolderOpen size={20} style={{ color: 'var(--primary-600)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-800)' }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{f.customerName}</div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--gray-400)' }} />
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--gray-600)' }}>
                <span><strong>{f.quotations?.length || 0}</strong> revisions</span>
                {f.poFile && <span style={{ color: 'var(--success-600)' }}>📋 PO attached</span>}
                <span>{new Date(f.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); deleteFile(f.id); }} style={{ color: 'var(--danger-500)', fontSize: 11 }}><Trash2 size={12} /> Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredFiles.length === 0 && (
        <div className="card"><div className="card-body"><div className="empty-state"><FolderOpen size={40} /><h4>No quotation files yet</h4><p>Click "New Quotation File" to create one</p></div></div></div>
      )}

      {/* CREATE FILE MODAL */}
      {showFileModal && (
        <div className="modal-overlay" onClick={() => setShowFileModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>New Quotation File</h3><button className="modal-close" onClick={() => setShowFileModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">File Name *</label><input type="text" className="form-input" value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g. ABC Corp - Motor Supply" /></div>
              <div className="form-group"><label className="form-label">Customer *</label>
                <select className="form-select" value={fileCustomerId} onChange={e => setFileCustomerId(e.target.value)}>
                  <option value="">Select Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Enquiry Ref No.</label><input type="text" className="form-input" value={fileEnqNo} onChange={e => setFileEnqNo(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Enquiry Date</label><input type="date" className="form-input" value={fileEnqDate} onChange={e => setFileEnqDate(e.target.value)} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowFileModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={createFile}>Create File</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
