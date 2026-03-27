import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Download, Mail, MessageCircle, FileCheck, Search, Eye, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { useSearchParams } from 'react-router-dom';
import useStore from '../store/useStore';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export default function Quotations() {
  const products = useStore(s => s.products);
  const customers = useStore(s => s.customers);
  const enquiries = useStore(s => s.enquiries);
  const companyInfo = useStore(s => s.companyInfo);
  const addToast = useStore(s => s.addToast);
  const [searchParams, setSearchParams] = useSearchParams();

  const [quotations, setQuotations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('quotations') || '[]'); } catch { return []; }
  });

  const [showModal, setShowModal] = useState(false);
  const [viewQuot, setViewQuot] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return {
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      refEnquiryNo: '',
      refEnquiryDate: '',
      validity: '1 month',
      notes: 'Taxes are extra as applicable,',
      items: [{ description: '', uom: 'Nos', quantity: 1, rate: '', hsnCode: '' }],
    };
  }

  useEffect(() => {
    const enquiryId = searchParams.get('enquiryId');
    if (enquiryId && enquiries) {
      const enq = enquiries.find(e => e.id === enquiryId);
      if (enq) {
        const product = products.find(p => p.id === enq.productId);
        // Defer state updates to avoid cascading renders inside effect
        setTimeout(() => {
          setForm({
            customerId: enq.customerId,
            date: new Date().toISOString().split('T')[0],
            refEnquiryNo: enq.enquiryNo,
            refEnquiryDate: enq.date,
            validity: '1 month',
            notes: 'Taxes are extra as applicable,',
            items: [{ 
              description: product?.name || '', 
              uom: product?.unit || 'Nos', 
              quantity: enq.quantity || 1, 
              rate: product?.sellingPrice || '', 
              hsnCode: product?.hsnCode || '' 
            }],
          });
          setShowModal(true);
        }, 0);
        // Clear param so it doesn't trigger again on refresh
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, enquiries, products, setSearchParams]);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', uom: 'Nos', quantity: 1, rate: '', hsnCode: '' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      return { ...f, items };
    });
  };

  const selectProduct = (i, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setForm(f => {
        const items = [...f.items];
        items[i] = { ...items[i], description: product.name, uom: product.unit || 'Nos', rate: product.sellingPrice, hsnCode: product.hsnCode || '' };
        return { ...f, items };
      });
    }
  };

  const getItemTotal = (item) => (Number(item.quantity) || 0) * (Number(item.rate) || 0);
  const grandTotal = form.items.reduce((sum, item) => sum + getItemTotal(item), 0);

  const nextQuotNo = useMemo(() => {
    const count = quotations.length + 1;
    const yr = new Date().getFullYear().toString().slice(-2);
    return `${count}/${yr}-${Number(yr) + 1}`;
  }, [quotations]);

  const saveQuotation = (e) => {
    e.preventDefault();
    if (!form.customerId) { addToast('Select a customer', 'error'); return; }
    if (form.items.some(it => !it.description || !it.quantity || !it.rate)) { addToast('Fill all item fields', 'error'); return; }

    const customer = customers.find(c => c.id === form.customerId);
    const quot = {
      id: generateId(),
      quotNo: nextQuotNo,
      customerId: form.customerId,
      customerName: customer?.name || '',
      date: form.date,
      refEnquiryNo: form.refEnquiryNo,
      refEnquiryDate: form.refEnquiryDate,
      validity: form.validity,
      notes: form.notes,
      items: form.items.map(it => ({ ...it, total: getItemTotal(it) })),
      grandTotal,
      createdAt: new Date().toISOString(),
    };
    const updated = [quot, ...quotations];
    setQuotations(updated);
    localStorage.setItem('quotations', JSON.stringify(updated));
    addToast(`Quotation ${quot.quotNo} saved!`, 'success');
    setShowModal(false);
    setForm(getEmptyForm());
  };

  const deleteQuotation = (id) => {
    if (!confirm('Delete this quotation?')) return;
    const updated = quotations.filter(q => q.id !== id);
    setQuotations(updated);
    localStorage.setItem('quotations', JSON.stringify(updated));
    addToast('Quotation deleted', 'success');
  };

  // ═══════════════════════════════════════════
  //  QUOTATION PDF — matches exact image format
  // ═══════════════════════════════════════════
  const generateQuotPDF = (quot) => {
    const customer = customers.find(c => c.id === quot.customerId);
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const m = 10;
    let y = 8;

    // Mobile numbers
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`(M): ${companyInfo.phone}`, m, y + 3);
    if (companyInfo.phone2) {
      doc.setFont('helvetica', 'italic');
      doc.text(`(M):`, pw - m - 30, y);
      doc.text(companyInfo.phone2, pw - m, y + 3, { align: 'right' });
    }
    y += 7;

    // KRISHNA ELECTRICAL WORKS
    doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 100, 0);
    doc.text('KRISHNA ELECTRICAL WORKS', pw / 2, y + 2, { align: 'center' });
    y += 10;

    // -: SPECILIST IN:-
    doc.setFontSize(8); doc.setTextColor(0, 0, 180); doc.setFont('helvetica', 'bold');
    doc.text('-: SPECILIST IN:-', pw / 2, y, { align: 'center' });
    y += 4;

    // Specialty text
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
    const specLines = doc.splitTextToSize(companyInfo.specialty || '', pw - m * 2 - 10);
    specLines.forEach(l => { doc.text(l, pw / 2, y, { align: 'center' }); y += 3; });
    y += 2;

    // Green line
    doc.setDrawColor(0, 100, 0); doc.setLineWidth(1);
    doc.line(m, y, pw - m, y);
    y += 4;

    // Office address
    doc.setFontSize(7); doc.setTextColor(0, 100, 0);
    doc.text(`Office: ${companyInfo.address}`, pw / 2, y, { align: 'center' });
    y += 5;

    // QUOTATION title
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 100, 0);
    doc.text('QUOTATION', pw / 2, y + 2, { align: 'center' });
    y += 8;

    // Client details on left, Quot details on right
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('Client', m, y);
    doc.text('Name:', m, y + 4);
    doc.setFont('helvetica', 'bold');
    const cname = doc.splitTextToSize(customer?.name || quot.customerName, 55);
    let cny = y + 8;
    cname.forEach(l => { doc.text(l, m, cny); cny += 4; });

    // Right side details
    const rx = pw / 2 + 8;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    let ry = y;
    doc.text('Quot No.', rx, ry); doc.text(quot.quotNo, rx + 35, ry); ry += 5;
    doc.text('Date:', rx, ry); doc.text(new Date(quot.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }), rx + 35, ry); ry += 5;
    if (quot.refEnquiryNo) { doc.text('Ref/ Enqu No:', rx, ry); doc.text(quot.refEnquiryNo, rx + 35, ry); ry += 5; }
    if (quot.refEnquiryDate) { doc.text('Date:', rx, ry); doc.text(new Date(quot.refEnquiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }), rx + 35, ry); ry += 5; }

    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    const caddr = doc.splitTextToSize(customer?.address || '', 70);
    caddr.forEach(l => { doc.text(l, m, cny); cny += 3.5; });

    if (customer?.gstNumber) { doc.setFont('helvetica', 'bold'); doc.text(`GSTN/UIN:  ${customer.gstNumber}`, m, cny); cny += 4; }
    doc.setFont('helvetica', 'normal');
    doc.text('PAN NO:', m, cny);
    if (customer?.email) doc.text(`Mail ID-`, m + 60, cny);
    cny += 4;

    y = Math.max(cny, ry) + 3;
    doc.setDrawColor(0); doc.setLineWidth(0.4);

    // Items table
    const itemRows = quot.items.map((item, i) => [
      `${i + 1}]`,
      item.description + (item.hsnCode ? `\nHSN- ${item.hsnCode}` : ''),
      item.uom,
      Number(item.quantity),
      Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      Number(item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    ]);

    doc.autoTable({
      startY: y,
      head: [['SR. NO.', 'DISCRIPTION', 'UOM', 'Qty', 'RATE', 'AMOUNT']],
      body: itemRows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineWidth: 0.4, lineColor: [0, 0, 0], halign: 'center' },
      styles: { fontSize: 8, cellPadding: 3, lineWidth: 0.4, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: m, right: m },
    });

    let fy = doc.lastAutoTable.finalY;

    // Validity and Notes inside the table continuation
    if (quot.validity) {
      fy += 6;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(`Validity- ${quot.validity}`, m + 5, fy);
      fy += 8;
    }
    if (quot.notes) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(quot.notes, m + 5, fy);
      fy += 10;
    }

    // ── CENVAT + TOTALS (same format as invoice) ──
    const subtotal = quot.grandTotal;
    const halfGst = (companyInfo.gstRate || 18) / 2;
    const cgst = subtotal * halfGst / 100;
    const sgst = subtotal * halfGst / 100;
    const totalBR = subtotal + cgst + sgst;
    const total = Math.round(totalBR);
    const roundOff = total - totalBR;

    const tw = pw - m * 2;
    const tlw = tw * 0.55;
    const trw = tw * 0.45;

    doc.rect(m, fy, tlw, 44);
    doc.rect(m + tlw, fy, trw, 44);

    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
    const cenvat = '"This is to certify that we are not availing any CENVAT Credit on inputs and that our firm is individual / HUF / Proprietary Firm / Partnership Firm / AQP"';
    const cenLines = doc.splitTextToSize(cenvat, tlw - 8);
    let cey = fy + 8;
    cenLines.forEach(l => { doc.text(l, m + 4, cey); cey += 3.5; });

    const trx2 = m + tlw + 3;
    const trr2 = pw - m - 4;
    let tr2y = fy + 8;
    const drawT = (label, val, bold) => {
      doc.setFontSize(8); doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(label, trx2, tr2y); doc.text(val, trr2, tr2y, { align: 'right' }); tr2y += 8;
    };
    drawT('Sub Total', subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), false);
    drawT(`CGST @ ${halfGst}%`, cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }), true);
    drawT(`SGST @  ${halfGst}%`, sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }), true);
    drawT('Round off', roundOff.toFixed(2), false);

    fy += 44;

    // Total row
    doc.rect(m, fy, tlw, 10);
    doc.rect(m + tlw, fy, trw, 10);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Rs:', m + 3, fy + 7);
    doc.text('Total Rs.', m + tlw + 3, fy + 7);
    doc.text(total.toLocaleString('en-IN', { minimumFractionDigits: 2 }), trr2, fy + 7, { align: 'right' });
    fy += 10;

    // GSTN + signatures
    doc.rect(m, fy, tw, 20);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`GSTN NO:  ${companyInfo.gstNumber}`, m + 3, fy + 7);
    doc.text('Client Sign.', m + 3, fy + 15);
    doc.text(`FOR   Krishna Electrical Works`, m + tw * 0.55, fy + 10);

    doc.save(`Quotation_${quot.quotNo.replace(/\//g, '-')}.pdf`);
    addToast('Quotation PDF downloaded', 'success');
  };

  const sendQuotWhatsApp = (quot) => {
    const customer = customers.find(c => c.id === quot.customerId);
    const phone = (customer?.phone || '').replace(/[^0-9]/g, '');
    const itemsList = quot.items.map((it, i) => `${i + 1}. ${it.description} - ${it.quantity} ${it.uom} @ ₹${Number(it.rate).toLocaleString('en-IN')} = ₹${Number(it.total).toLocaleString('en-IN')}`).join('\n');
    const text = encodeURIComponent(
      `*QUOTATION - Krishna Electrical Works*\nQuot No: ${quot.quotNo}\nDate: ${new Date(quot.date).toLocaleDateString('en-IN')}\n\n*Items:*\n${itemsList}\n\n*Total: ₹${quot.grandTotal.toLocaleString('en-IN')}*\n${quot.notes || ''}\nValidity: ${quot.validity}\n\nMob: ${companyInfo.phone}`
    );
    window.open(`https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${text}`, '_blank');
  };

  const sendQuotEmail = (quot) => {
    const customer = customers.find(c => c.id === quot.customerId);
    const subject = encodeURIComponent(`Quotation ${quot.quotNo} - Krishna Electrical Works`);
    const itemsList = quot.items.map((it, i) => `${i + 1}. ${it.description} - ${it.quantity} ${it.uom} @ Rs.${Number(it.rate).toLocaleString('en-IN')} = Rs.${Number(it.total).toLocaleString('en-IN')}`).join('\n');
    const body = encodeURIComponent(`Dear ${customer?.contactPerson || 'Sir/Madam'},\n\nPlease find our quotation:\n\nQuot No: ${quot.quotNo}\nDate: ${new Date(quot.date).toLocaleDateString('en-IN')}\n\nItems:\n${itemsList}\n\nTotal: Rs.${quot.grandTotal.toLocaleString('en-IN')}\n${quot.notes || ''}\nValidity: ${quot.validity}\n\nRegards,\nKrishna Electrical Works\nMob: ${companyInfo.phone}`);
    window.open(`mailto:${customer?.email || ''}?subject=${subject}&body=${body}`);
  };

  const filtered = quotations.filter(q => !search || q.customerName?.toLowerCase().includes(search.toLowerCase()) || q.quotNo?.includes(search));

  // ═══════════════════════════════════
  //  VIEW MODE
  // ═══════════════════════════════════
  if (viewQuot) {
    const customer = customers.find(c => c.id === viewQuot.customerId);
    const halfGst = (companyInfo.gstRate || 18) / 2;
    const sub = viewQuot.grandTotal;
    const cgst = sub * halfGst / 100;
    const sgst = sub * halfGst / 100;
    const total = Math.round(sub + cgst + sgst);

    return (
      <div className="slide-up">
        <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setViewQuot(null)}><ArrowLeft size={16} /> Back</button>
          <button className="btn btn-primary" onClick={() => generateQuotPDF(viewQuot)}><Download size={16} /> Download PDF</button>
          <button className="btn btn-success" onClick={() => sendQuotWhatsApp(viewQuot)}><MessageCircle size={16} /> WhatsApp</button>
          <button className="btn btn-secondary" onClick={() => sendQuotEmail(viewQuot)}><Mail size={16} /> Email</button>
        </div>

        <div className="card">
          <div className="card-body" style={{ maxWidth: 700, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: 'var(--gray-500)' }}>(M): {companyInfo.phone} &nbsp;&nbsp;&nbsp;&nbsp; {companyInfo.phone2 ? `(M): ${companyInfo.phone2}` : ''}</div>
              <h2 style={{ fontSize: 22, color: '#006400', margin: '4px 0' }}>KRISHNA ELECTRICAL WORKS</h2>
              <div style={{ fontSize: 9, color: '#0000b4', fontWeight: 700 }}>-: SPECILIST IN:-</div>
              <div style={{ fontSize: 8, color: 'var(--gray-700)', margin: '4px 20px', lineHeight: 1.4 }}>{companyInfo.specialty}</div>
              <div style={{ borderTop: '2px solid #006400', margin: '8px 0', paddingTop: 4, fontSize: 8, color: '#006400' }}>Office: {companyInfo.address}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#006400', marginTop: 8 }}>QUOTATION</div>
            </div>

            {/* Client + Details */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 11, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div><strong>Client Name:</strong></div>
                <div style={{ fontWeight: 700 }}>{customer?.name || viewQuot.customerName}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-600)', marginTop: 2 }}>{customer?.address}</div>
                {customer?.gstNumber && <div><strong>GSTN/UIN:</strong> {customer.gstNumber}</div>}
              </div>
              <div style={{ minWidth: 180 }}>
                <div><strong>Quot No.</strong> &nbsp; {viewQuot.quotNo}</div>
                <div><strong>Date:</strong> &nbsp; {new Date(viewQuot.date).toLocaleDateString('en-IN')}</div>
                {viewQuot.refEnquiryNo && <div><strong>Ref/ Enqu No:</strong> &nbsp; {viewQuot.refEnquiryNo}</div>}
                {viewQuot.refEnquiryDate && <div><strong>Date:</strong> &nbsp; {new Date(viewQuot.refEnquiryDate).toLocaleDateString('en-IN')}</div>}
              </div>
            </div>

            {/* Items Table */}
            <table className="invoice-table" style={{ marginBottom: 12 }}>
              <thead><tr><th>SR. NO.</th><th>DESCRIPTION</th><th>UOM</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>RATE</th><th style={{ textAlign: 'right' }}>AMOUNT</th></tr></thead>
              <tbody>
                {viewQuot.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>{i + 1}]</td>
                    <td style={{ fontWeight: 600 }}>{it.description}{it.hsnCode ? <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>HSN- {it.hsnCode}</div> : null}</td>
                    <td>{it.uom}</td>
                    <td style={{ textAlign: 'right' }}>{it.quantity}</td>
                    <td style={{ textAlign: 'right' }}>₹{Number(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(it.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {viewQuot.validity && <div style={{ fontSize: 13, fontWeight: 'bold', color: '#b91c1c', marginBottom: 4, padding: '4px 8px', background: '#fef2f2', display: 'inline-block', borderRadius: 4 }}>Validity- {viewQuot.validity}</div>}
            {viewQuot.notes && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 12 }}>{viewQuot.notes}</div>}

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <div style={{ width: 250, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--gray-200)' }}><span>Sub Total</span><span>₹{sub.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--gray-200)' }}><strong>CGST @ {halfGst}%</strong><span>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--gray-200)' }}><strong>SGST @ {halfGst}%</strong><span>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: 800, fontSize: 14, color: 'var(--primary-700)' }}><span>Total Rs.</span><span>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-200)', paddingTop: 12 }}>
              <div>GSTN NO: {companyInfo.gstNumber}<br/>Client Sign.</div>
              <div style={{ textAlign: 'right' }}>FOR Krishna Electrical Works</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  //  MAIN LIST VIEW
  // ═══════════════════════════════════
  return (
    <div className="slide-up">
      <div className="toolbar">
        <div className="toolbar-left">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input type="text" className="filter-input" placeholder="Search quotations..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> New Quotation</button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <div className="stat-icon teal"><FileCheck size={22} /></div>
          <div className="stat-info"><h4>Total Quotations</h4><div className="stat-value">{quotations.length}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><FileCheck size={22} /></div>
          <div className="stat-info"><h4>Total Value</h4><div className="stat-value">₹{quotations.reduce((s, q) => s + (q.grandTotal || 0), 0).toLocaleString('en-IN')}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-body no-padding">
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Quot No.</th><th>Date</th><th>Customer</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
              <tbody>
                {filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(q => (
                  <tr key={q.id}>
                    <td><span className="badge badge-info">{q.quotNo}</span></td>
                    <td>{new Date(q.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontWeight: 600 }}>{q.customerName}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{(q.grandTotal || 0).toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="btn-group" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-outline" onClick={() => setViewQuot(q)}><Eye size={13} /> View</button>
                        <button className="btn btn-sm btn-primary" onClick={() => generateQuotPDF(q)}><Download size={13} /> PDF</button>
                        <button className="btn btn-sm btn-success" onClick={() => sendQuotWhatsApp(q)} title="WhatsApp"><MessageCircle size={13} /></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => sendQuotEmail(q)} title="Email"><Mail size={13} /></button>
                        <button className="btn btn-sm btn-outline" onClick={() => deleteQuotation(q.id)} style={{ color: 'var(--danger-500)' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5}><div className="empty-state"><FileCheck size={40} /><h4>No quotations yet</h4><p>Click "New Quotation" to create one</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══ CREATE QUOTATION MODAL ═══ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Quotation — {nextQuotNo}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={saveQuotation} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Customer *</label>
                    <select className="form-select" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} required>
                      <option value="">Select Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ref / Enquiry No.</label>
                    <input type="text" className="form-input" value={form.refEnquiryNo} onChange={e => setForm({ ...form, refEnquiryNo: e.target.value })} placeholder="ENQ/SS/01-26/0121" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Enquiry Date</label>
                    <input type="date" className="form-input" value={form.refEnquiryDate} onChange={e => setForm({ ...form, refEnquiryDate: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Validity</label>
                    <input type="text" className="form-input" value={form.validity} onChange={e => setForm({ ...form, validity: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input type="text" className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>

                {/* Items */}
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
                        <input type="text" className="form-input" style={{ fontSize: 12 }} value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description of goods/service" required />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>UOM</label>
                          <input type="text" className="form-input" style={{ fontSize: 11 }} value={item.uom} onChange={e => updateItem(i, 'uom', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>Qty</label>
                          <input type="number" className="form-input" style={{ fontSize: 11 }} value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} min="1" required />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>Rate (₹)</label>
                          <input type="number" className="form-input" style={{ fontSize: 11 }} value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} min="0" step="0.01" required />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>Amount</label>
                          <div style={{ fontSize: 14, fontWeight: 700, padding: '8px 0', color: 'var(--primary-700)' }}>₹{getItemTotal(item).toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {grandTotal > 0 && (
                    <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, var(--primary-50), var(--accent-50))', borderRadius: 8, textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>Grand Total (before tax)</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-700)' }}>₹{grandTotal.toLocaleString('en-IN')}</div>
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
