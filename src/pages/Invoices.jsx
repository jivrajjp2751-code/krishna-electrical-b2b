import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Download, Mail, Search, ArrowLeft, Printer, MessageCircle, Edit2, Save } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import useStore from '../store/useStore';

export default function Invoices() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sales = useStore(s => s.sales);
  const products = useStore(s => s.products);
  const customers = useStore(s => s.customers);
  const companyInfo = useStore(s => s.companyInfo);
  const addToast = useStore(s => s.addToast);

  const updateSale = useStore(s => s.updateSale);

  const [search, setSearch] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState(null);

  useEffect(() => {
    const id = searchParams.get('id');
    const edit = searchParams.get('edit');
    if (id) {
      setSelectedSaleId(id);
      if (edit === 'true') setEditMode(true);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return sales.filter(s => {
      const customer = customers.find(c => c.id === s.customerId);
      return !search || (
        customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.invoiceNo?.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [sales, search, customers]);

  const selectedSale = sales.find(s => s.id === selectedSaleId);
  const selectedCustomer = selectedSale ? customers.find(c => c.id === selectedSale.customerId) : null;

  // Initialize edit data when entering edit mode
  useEffect(() => {
    if (selectedSale && (editMode || !editData)) {
      if (selectedSale.invoiceData) {
        setEditData(selectedSale.invoiceData);
      } else {
        const items = selectedSale.items.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            description: product?.name || 'Product',
            hsnCode: item.hsnCode || product?.hsnCode || '',
            uom: item.uom || product?.unit || 'nos',
            quantity: item.quantity,
            rate: item.sellingPrice,
            discount: item.discount || 0,
            amount: item.total,
          };
        });
        setEditData({
          items,
          deliveryNote: '',
          paymentTerms: '',
          suppliersRef: '',
          otherRef: '',
          buyersOrderNo: '',
          buyersOrderDate: '',
          despatchDocNo: '',
          deliveryNoteDate: '',
          despatchedThrough: '',
          destination: '',
          termsOfDelivery: '',
        });
      }
    }
  }, [selectedSale, editMode]);

  const handleSaveAndLock = () => {
    if (!confirm('Save and finalize this invoice? It cannot be edited after this.')) return;
    
    const newSubtotal = editData.items.reduce((sum, item) => sum + Number(item.amount), 0);
    const newGstAmount = Math.round(newSubtotal * (companyInfo.gstRate || 18) / 100);
    const newTotalAmount = newSubtotal + newGstAmount;

    updateSale(selectedSale.id, {
      subtotal: newSubtotal,
      gstAmount: newGstAmount,
      totalAmount: newTotalAmount,
      invoiceData: editData,
      invoiceNo: editData.invoiceNo || selectedSale.invoiceNo,
      isLocked: true,
    });

    addToast('Invoice saved and locked!', 'success');
    setEditMode(false);
    navigate('/invoices');
  };

  const updateEditItem = (i, field, value) => {
    setEditData(d => {
      const items = [...d.items];
      items[i] = { ...items[i], [field]: value };
      if (['quantity', 'rate', 'discount'].includes(field)) {
        const qty = Number(items[i].quantity) || 0;
        const rate = Number(items[i].rate) || 0;
        const disc = Number(items[i].discount) || 0;
        const total = qty * rate;
        items[i].amount = total - (total * disc / 100);
      }
      return { ...d, items };
    });
  };

  const getGstRate = () => companyInfo.gstRate || 18;
  const getHalfGst = () => getGstRate() / 2;

  // ═══════════════════════════════════════════════
  //  PDF GENERATION — matches exact image format
  // ═══════════════════════════════════════════════
  const buildPDF = (sale, data) => {
    const customer = customers.find(c => c.id === sale.customerId);
    const items = data?.items || sale.invoiceData?.items || (sale.items || []).map(item => {
      const product = products.find(p => p.id === item.productId);
      return { 
        description: product?.name || item.description || 'Product', 
        hsnCode: item.hsnCode || product?.hsnCode || '', 
        uom: item.uom || product?.unit || 'nos', 
        quantity: Number(item.quantity) || 0, 
        rate: Number(item.sellingPrice || item.rate) || 0, 
        discount: Number(item.discount) || 0, 
        amount: Number(item.total || item.amount) || 0 
      };
    });

    const refData = data || sale.invoiceData || {};

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const m = 10; // margin
    const cw = pageW - m * 2; // content width
    const halfGst = getHalfGst();
    let y = 10;

    doc.setDrawColor(0);
    doc.setLineWidth(0.3);

    // ── TITLE ──
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageW / 2, y + 8, { align: 'center' });
    
    // ── MOBILE ──
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`Mob: ${companyInfo.phone}`, pageW - m - 4, y + 8, { align: 'right' });
    y += 15;
    const displayInvNo = (sale.invoiceNo || '').replace(/inv-/i, '');

    // ── HEADER TABLE (Company Info + Reference boxes) ──
    const headerData = [
      [
        { content: `${companyInfo.name}\nBlock No-01:02, Bldg No-A-5,\nSect-18, Plot No-24, Nerul(West)\nNavi Mumbai, Maharastra - 400 706\nGSTN NO: ${companyInfo.gstNumber}\nPAN NO: ${companyInfo.pan}\nMail ID: ${companyInfo.email}`, rowSpan: 3, styles: { fontStyle: 'bold', fontSize: 11, cellPadding: 3, halign: 'left', valign: 'top' } },
        { content: `Invoice No. :\n${displayInvNo}`, styles: { halign: 'left' } },
        { content: `Dated :\n${new Date(sale.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, styles: { halign: 'left' } }
      ],
      [
        { content: `Delivery Note. :\n${refData.deliveryNote || ''}`, styles: { halign: 'left' } },
        { content: `Mode/Terms of Payment :\n${refData.paymentTerms || ''}`, styles: { halign: 'left' } }
      ],
      [
        { content: `Suppliers Ref. :\n${refData.suppliersRef || ''}`, styles: { halign: 'left' } },
        { content: `Other Reference(s) :\n${refData.otherRef || ''}`, styles: { halign: 'left' } }
      ],
      [
        { content: `Client :\n${customer?.name || 'Customer'}\n${customer?.address || ''}\nGSTN NO: ${customer?.gstNumber || ''}\nVendor Code- ${customer?.vendorCode || ''}`, rowSpan: 4, styles: { fontStyle: 'bold', fontSize: 11, cellPadding: 3, halign: 'left', valign: 'top' } },
        { content: `Buyers Order No. :\n${refData.buyersOrderNo || ''}`, styles: { halign: 'left' } },
        { content: `Dated :\n${refData.buyersOrderDate || ''}`, styles: { halign: 'left' } }
      ],
      [
        { content: `Despatch Document No. :\n${refData.despatchDocNo || ''}`, styles: { halign: 'left' } },
        { content: `Delivery Note Date :\n${refData.deliveryNoteDate || ''}`, styles: { halign: 'left' } }
      ],
      [
        { content: `Despatched through :\n${refData.despatchedThrough || ''}`, styles: { halign: 'left' } },
        { content: `Destination :\n${refData.destination || ''}`, styles: { halign: 'left' } }
      ],
      [
        { content: `Terms of Delivery :\n${refData.termsOfDelivery || ''}`, colSpan: 2, styles: { halign: 'left' } }
      ]
    ];

    autoTable(doc, {
      startY: y,
      body: headerData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.3, lineColor: [0, 0, 0], textColor: [0, 0, 0], overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: cw * 0.55 },
        1: { cellWidth: cw * 0.225 },
        2: { cellWidth: cw * 0.225 },
      },
      margin: { left: m, right: m },
    });

    y = doc.lastAutoTable.finalY + 1;

    // ── ITEMS TABLE ──
    const itemRows = items.map((item, i) => [
      i + 1,
      item.description,
      item.hsnCode || '',
      item.uom,
      Number(item.quantity).toFixed(2),
      Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Sr.\nNo', 'Description of Goods', 'HSN/\nSAC', 'UOM', 'QTY', 'RATE', 'AMOUNT']],
      body: itemRows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 11, fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0], halign: 'center', cellPadding: 3 },
      styles: { fontSize: 11, cellPadding: 3, lineWidth: 0.3, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 88 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: m, right: m },
    });

    let ty = doc.lastAutoTable?.finalY || y + 30;

    // ── FOOTER GRID: Declaration (Left) | Totals (Right) ──
    const sub = items.reduce((s, it) => s + (it.amount || 0), 0);
    const tax = sub * halfGst / 100;
    const gtot = Math.round(sub + tax + tax);
    const rOff = (gtot - (sub + tax + tax));

    const totalsData = [
      [
        { content: '"This is to certify that we are not availing any CENVAT Credit on inputs and that our firm is individual / HUF / Proprietary Firm / Partnership Firm / AQP"', rowSpan: 5, styles: { fontSize: 8, valign: 'top', halign: 'left' } },
        { content: 'Sub Total', styles: { halign: 'left' } },
        { content: sub.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right' } }
      ],
      [
        { content: `CGST @ ${halfGst}%`, styles: { halign: 'left' } },
        { content: tax.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } }
      ],
      [
        { content: `SGST @ ${halfGst}%`, styles: { halign: 'left' } },
        { content: tax.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } }
      ],
      [
        { content: 'Round off', styles: { halign: 'left' } },
        { content: (rOff >= 0 ? '+' : '-') + Math.abs(rOff).toFixed(2), styles: { halign: 'right' } }
      ],
      [
        { content: 'Grand Total (Rs)', styles: { halign: 'left', fontStyle: 'bold', fontSize: 11 } },
        { content: gtot.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold', fontSize: 11 } }
      ]
    ];

    autoTable(doc, {
      startY: ty,
      body: totalsData,
      theme: 'grid',
      styles: { fontSize: 9.5, cellPadding: 2, lineWidth: 0.3, lineColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: cw * 0.55 },
        1: { cellWidth: cw * 0.25 },
        2: { cellWidth: cw * 0.20 },
      },
      margin: { left: m, right: m },
    });

    ty = doc.lastAutoTable.finalY;

    // ── WORDS & GRAND TOTAL BAR ─────
    autoTable(doc, {
      startY: ty,
      body: [
        [{ content: `Amount Chargeable (in words) : Rs. ${numberToWords(gtot)} Only.`, colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rs. ${gtot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { halign: 'right', fontStyle: 'bold' } }]
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.3, lineColor: [0, 0, 0] },
      margin: { left: m, right: m }
    });

    ty = doc.lastAutoTable.finalY;
    ty += 10;

    // ── HSN/SAC SUMMARY TABLE ──
    const hsnRows = [];
    const groupedHsn = items.reduce((acc, item) => {
      const code = item.hsnCode || '—';
      if (!acc[code]) acc[code] = 0;
      acc[code] += Number(item.amount);
      return acc;
    }, {});

    Object.keys(groupedHsn).forEach(code => {
      const taxable = groupedHsn[code];
      const cAmt = taxable * halfGst / 100;
      const sAmt = taxable * halfGst / 100;
      hsnRows.push([
        code,
        taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        `${halfGst}%`, cAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        `${halfGst}%`, sAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    });

    const totalTaxable = sub.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const totalC = tax.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const totalS = tax.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    hsnRows.push([
      { content: 'Total', styles: { halign: 'right', fontStyle: 'bold' } },
      { content: totalTaxable, styles: { fontStyle: 'bold' } },
      { content: '' },
      { content: totalC, styles: { fontStyle: 'bold' } },
      { content: '' },
      { content: totalS, styles: { fontStyle: 'bold' } }
    ]);

    autoTable(doc, {
      startY: ty,
      head: [
        [
          { content: 'HSN/SAC', rowSpan: 2 },
          { content: 'Taxable\nValue', rowSpan: 2 },
          { content: 'Central Tax', colSpan: 2 },
          { content: 'State Tax', colSpan: 2 }
        ],
        ['Rate', 'Amount', 'Rate', 'Amount']
      ],
      body: hsnRows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 7.5, fontStyle: 'bold', lineWidth: 0.4, lineColor: [0, 0, 0], halign: 'center', cellPadding: 2 },
      styles: { fontSize: 7.5, cellPadding: 2, lineWidth: 0.4, lineColor: [0, 0, 0], textColor: [0, 0, 0], halign: 'right' },
      columnStyles: { 0: { halign: 'center' }, 2: { halign: 'center' }, 4: { halign: 'center' } },
      margin: { left: m, right: m },
    });
    
    let endY = doc.lastAutoTable?.finalY || ty + 20;

    // ── FINAL SIGNATURES ─────
    autoTable(doc, {
      startY: endY + 2,
      body: [
        [
          { content: `Bank Details:\nBank Name: ${companyInfo.bankName || 'SBI'}\nA/c No: ${companyInfo.accountNo || ''}\nIFSC: ${companyInfo.ifsc || ''}`, styles: { fontSize: 9, cellPadding: 3 } },
          { content: `FOR ${companyInfo.name}\n\n\n\nAuthorised Signatory`, styles: { halign: 'right', valign: 'bottom', fontSize: 10, fontStyle: 'bold' } }
        ]
      ],
      theme: 'grid',
      styles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
      margin: { left: m, right: m }
    });

    return doc;
  };

  const generatePDF = (sale, data) => {
    try {
      const doc = buildPDF(sale, data);
      doc.save(`${sale.invoiceNo}.pdf`);
      addToast(`Invoice ${sale.invoiceNo} downloaded`, 'success');
    } catch (err) {
      console.error('PDF Error:', err);
      addToast(`PDF Error: ${err.message}`, 'error');
    }
  };

  const shareInvoiceWithFile = async (sale, method) => {
    try {
      const doc = buildPDF(sale, null);
      const filename = `${sale.invoiceNo}.pdf`;
      
      const customer = customers.find(c => c.id === sale.customerId);
      const phone = (customer?.phone || '').replace(/[^0-9]/g, '');

      doc.save(filename);
      addToast('Draft Downloaded. Please share manually.', 'info');
      
      setTimeout(() => {
        if (method === 'whatsapp') {
          const text = encodeURIComponent(`*Invoice: ${sale.invoiceNo}*\nAmount: ₹${sale.totalAmount.toLocaleString('en-IN')}\n\nPDF downloaded to your device.`);
          window.open(`https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${text}`, '_blank');
        } else {
          const subject = encodeURIComponent(`Invoice ${sale.invoiceNo}`);
          const body = encodeURIComponent(`Invoice: ${sale.invoiceNo}\nAmount: Rs.${sale.totalAmount.toLocaleString('en-IN')}`);
          window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${customer?.email || ''}&su=${subject}&body=${body}`, '_blank');
        }
      }, 300);
    } catch (err) {
      console.error('Share Error:', err);
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  const sendWhatsApp = (sale) => shareInvoiceWithFile(sale, 'whatsapp');
  const sendEmail = (sale) => shareInvoiceWithFile(sale, 'email');

  const halfGst = getHalfGst();

  return (
    <div className="slide-up">
      {!selectedSaleId ? (
        <>
          {/* INVOICE LIST */}
          <div className="toolbar">
            <div className="toolbar-left">
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input type="text" className="filter-input" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body no-padding">
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Invoice No.</th><th>Date</th><th>Customer</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
                  <tbody>
                    {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(s => {
                      const customer = customers.find(c => c.id === s.customerId);
                      return (
                        <tr key={s.id}>
                          <td><span className="badge badge-info">{s.invoiceNo}</span></td>
                          <td>{new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td style={{ fontWeight: 600 }}>{customer?.name || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{s.totalAmount.toLocaleString('en-IN')}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="btn-group" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                              {!s.isLocked && (
                                <button className="btn btn-sm btn-outline" onClick={() => { setSelectedSaleId(s.id); setEditMode(true); }}><Edit2 size={13} /> Finalize Invoice</button>
                              )}
                              {s.isLocked && (
                                <button className="btn btn-sm btn-outline" onClick={() => { setSelectedSaleId(s.id); setEditMode(true); }}><FileText size={13} /> View Details</button>
                              )}
                              <button className="btn btn-sm btn-primary" onClick={() => generatePDF(s, null)}><Download size={13} /> PDF</button>
                              <button className="btn btn-sm btn-success" onClick={() => sendWhatsApp(s)} title="WhatsApp"><MessageCircle size={13} /></button>
                              <button className="btn btn-sm btn-secondary" onClick={() => sendEmail(s)} title="Email"><Mail size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={5}><div className="empty-state"><FileText size={40} /><h4>No invoices found</h4><p>Create a sale to generate invoices</p></div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* EDITABLE INVOICE PREVIEW */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => { setSelectedSaleId(null); setEditMode(false); navigate('/invoices'); }}>
              <ArrowLeft size={16} /> Back
            </button>
            {selectedSale && editData && (
              <>
                {!selectedSale.isLocked && (
                  <button className="btn btn-primary" onClick={handleSaveAndLock}>
                    <Save size={16} /> Save & Finalize Invoice
                  </button>
                )}
                {selectedSale.isLocked && (
                  <>
                    <button className="btn btn-primary" onClick={() => generatePDF(selectedSale, editData)}>
                      <Download size={16} /> Download PDF
                    </button>
                    <button className="btn btn-success" onClick={() => sendWhatsApp(selectedSale)}>
                      <MessageCircle size={16} /> WhatsApp
                    </button>
                    <button className="btn btn-secondary" onClick={() => sendEmail(selectedSale)}>
                      <Mail size={16} /> Email
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {selectedSale && editData && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ background: selectedSale.isLocked ? 'var(--gray-100)' : 'var(--primary-50)' }}>
                <h3>
                  {selectedSale.isLocked ? <FileText size={16} style={{ marginRight: 8 }} /> : <Edit2 size={16} style={{ marginRight: 8 }} />}
                  {selectedSale.isLocked ? 'Finalized Invoice Details' : 'Finalize Invoice (Edit Details)'} — {selectedSale.invoiceNo}
                </h3>
              </div>
              <div className="card-body" style={{ padding: 20 }}>
                {/* Invoice No + Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 16, gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary-700)' }}>{companyInfo.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>{companyInfo.address}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>GSTIN: {companyInfo.gstNumber} | PAN: {companyInfo.pan}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>Mob: {companyInfo.phone} | Email: {companyInfo.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)' }}>TAX INVOICE</div>
                    {selectedSale.isLocked && <div style={{ fontSize: 11, color: 'var(--success-600)', fontWeight: 'bold' }}>FINALIZED & LOCKED</div>}
                    <div style={{ fontSize: 12 }}>Invoice No: <strong>{selectedSale.invoiceNo}</strong></div>
                    <div style={{ fontSize: 12 }}>Date: <strong>{new Date(selectedSale.date).toLocaleDateString('en-IN')}</strong></div>
                  </div>
                </div>

                {/* Reference Fields (editable) */}
                <div style={{ fontSize: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--primary-600)' }}>Reference Details (editable — appears on PDF)</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Delivery Note</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.deliveryNote} onChange={e => setEditData({ ...editData, deliveryNote: e.target.value })} disabled={selectedSale.isLocked} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Mode/Terms of Payment</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.paymentTerms} onChange={e => setEditData({ ...editData, paymentTerms: e.target.value })} disabled={selectedSale.isLocked} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Buyers Order No.</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.buyersOrderNo} onChange={e => setEditData({ ...editData, buyersOrderNo: e.target.value })} placeholder="e.g. PO/SR/02-26/0024" disabled={selectedSale.isLocked} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Buyers Order Date</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.buyersOrderDate} onChange={e => setEditData({ ...editData, buyersOrderDate: e.target.value })} placeholder="e.g. 24-02-2026" disabled={selectedSale.isLocked} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Despatched through</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.despatchedThrough} onChange={e => setEditData({ ...editData, despatchedThrough: e.target.value })} placeholder="e.g. Couriers" disabled={selectedSale.isLocked} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Destination</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.destination} onChange={e => setEditData({ ...editData, destination: e.target.value })} disabled={selectedSale.isLocked} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Terms of Delivery</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.termsOfDelivery} onChange={e => setEditData({ ...editData, termsOfDelivery: e.target.value })} disabled={selectedSale.isLocked} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Other Reference(s)</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.otherRef} onChange={e => setEditData({ ...editData, otherRef: e.target.value })} disabled={selectedSale.isLocked} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Suppliers Ref.</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.suppliersRef} onChange={e => setEditData({ ...editData, suppliersRef: e.target.value })} disabled={selectedSale.isLocked} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11, color: 'var(--primary-700)', fontWeight: 700 }}>Invoice No. (Editable)</label>
                      <input className="form-input" style={{ fontSize: 11, border: '1px solid var(--primary-300)' }} value={editData.invoiceNo || selectedSale.invoiceNo} onChange={e => setEditData({ ...editData, invoiceNo: e.target.value })} disabled={selectedSale.isLocked} />
                    </div>
                  </div>
                </div>

                {/* Client */}
                <div style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
                  <strong>Client:</strong> {selectedCustomer?.name} | {selectedCustomer?.address} | GSTIN: {selectedCustomer?.gstNumber}
                </div>

                {/* Editable Items */}
                <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--primary-600)', fontSize: 12 }}>Items {selectedSale.isLocked ? '' : '(editable)'}</div>
                <div style={{ marginBottom: 16 }}>
                  {editData.items.map((item, i) => (
                    <div key={i} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--gray-50)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <strong style={{ fontSize: 12, color: 'var(--primary-600)' }}>Item {i + 1}</strong>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 3fr) 1fr', gap: 8, marginBottom: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>Description</label>
                          <input className="form-input" style={{ fontSize: 13 }} value={item.description} onChange={e => updateEditItem(i, 'description', e.target.value)} disabled={selectedSale.isLocked} placeholder="Description" />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>HSN/SAC</label>
                          <input className="form-input" style={{ fontSize: 13 }} value={item.hsnCode} onChange={e => updateEditItem(i, 'hsnCode', e.target.value)} disabled={selectedSale.isLocked} placeholder="HSN" />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>UOM</label>
                          <input className="form-input" style={{ fontSize: 13 }} value={item.uom} onChange={e => updateEditItem(i, 'uom', e.target.value)} disabled={selectedSale.isLocked} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>QTY</label>
                          <input type="number" className="form-input" style={{ fontSize: 13 }} value={item.quantity} onChange={e => updateEditItem(i, 'quantity', e.target.value)} min="0" step="0.01" disabled={selectedSale.isLocked} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>RATE (₹)</label>
                          <input type="number" className="form-input" style={{ fontSize: 13 }} value={item.rate} onChange={e => updateEditItem(i, 'rate', e.target.value)} min="0" step="0.01" disabled={selectedSale.isLocked} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>DISC(%)</label>
                          <input type="number" className="form-input" style={{ fontSize: 13 }} value={item.discount || ''} onChange={e => updateEditItem(i, 'discount', e.target.value)} min="0" max="100" placeholder="0" disabled={selectedSale.isLocked} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>AMOUNT</label>
                          <div style={{ fontSize: 14, fontWeight: 700, padding: '8px 0', color: 'var(--primary-700)' }}>₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Preview */}
                {(() => {
                  const rawSub = editData.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0);
                  const sub = editData.items.reduce((s, it) => s + Number(it.amount), 0);
                  const discAmt = rawSub - sub;
                  const c = sub * halfGst / 100;
                  const sg = sub * halfGst / 100;
                  const tot = Math.round(sub + c + sg);
                  return (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ width: 280, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}><span>Sub Total</span><span>₹{rawSub.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        {discAmt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)', color: '#dc2626' }}><strong>Discount @ {rawSub > 0 ? ((discAmt / rawSub) * 100).toFixed(1) : 0}%</strong><span>- ₹{discAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}><span><strong>CGST @ {halfGst}%</strong></span><span>₹{c.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}><span><strong>SGST @ {halfGst}%</strong></span><span>₹{sg.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        {Math.abs(tot - (sub + c + sg)) >= 0.005 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}><span>Round off</span><span>{(tot - (sub + c + sg)) >= 0 ? '+' : '-'} {Math.abs(tot - (sub + c + sg)).toFixed(2)}</span></div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 800, fontSize: 15, color: 'var(--primary-700)' }}><span>Total Rs.</span><span>₹{tot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div style={{ fontSize: 10, color: 'var(--gray-600)', marginTop: 4 }}>{numberToWords(tot)} Only</div>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-500)' }}>
                  <div>Client Sign.</div>
                  <div style={{ textAlign: 'right' }}>FOR {companyInfo.name.replace('M/S. ', '')}<br/><br/>Authorised Signatory</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function numberToWords(num) {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const numToWords = (n) => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '');
    if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
    if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
    return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
  };
  return numToWords(Math.round(num));
}
