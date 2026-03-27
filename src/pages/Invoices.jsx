import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Download, Mail, Search, ArrowLeft, Printer, MessageCircle, Edit2, Save } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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
          despatched: '',
          destination: '',
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
      if (field === 'quantity' || field === 'rate') {
        items[i].amount = (Number(items[i].quantity) || 0) * (Number(items[i].rate) || 0);
      }
      return { ...d, items };
    });
  };

  const getGstRate = () => companyInfo.gstRate || 18;
  const getHalfGst = () => getGstRate() / 2;

  // ═══════════════════════════════════════════════
  //  PDF GENERATION — matches exact image format
  // ═══════════════════════════════════════════════
  const generatePDF = (sale, data) => {
    const customer = customers.find(c => c.id === sale.customerId);
    const items = data?.items || sale.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return { description: product?.name || '', hsnCode: item.hsnCode || product?.hsnCode || '', uom: item.uom || product?.unit || 'nos', quantity: item.quantity, rate: item.sellingPrice, amount: item.total };
    });

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const m = 10; // margin
    const cw = pageW - m * 2; // content width
    const halfGst = getHalfGst();
    let y = 10;

    // ── TITLE BAR ──
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Tax Invoice', pageW / 2, y + 2, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Mob: ${companyInfo.phone}`, pageW - m, y + 2, { align: 'right' });
    y += 8;

    doc.setDrawColor(0);
    doc.setLineWidth(0.4);

    // ── ROW 1: Company Info (left) | Invoice No + Date (right) ──
    const leftW = cw * 0.55;
    const rightW = cw * 0.45;
    const r1h = 52;
    doc.rect(m, y, leftW, r1h);

    // Company details
    let cy = y + 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo.name, m + 3, cy); cy += 5;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    const addr1 = doc.splitTextToSize(companyInfo.address, leftW - 6);
    addr1.forEach(l => { doc.text(l, m + 3, cy); cy += 3.5; });
    cy += 1;
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN/UIN:${companyInfo.gstNumber}`, m + 3, cy); cy += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`E-mail- ${companyInfo.email}`, m + 3, cy); cy += 4;
    if (companyInfo.secondAddress) {
      const addr2 = doc.splitTextToSize(companyInfo.secondAddress, leftW - 6);
      addr2.forEach(l => { doc.text(l, m + 3, cy); cy += 3.5; });
    }
    cy += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(`GSTN NO: ${companyInfo.gstNumber}    PAN NO: ${companyInfo.pan}`, m + 3, cy); cy += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`Mail ID: ${companyInfo.email}`, m + 3, cy);

    // Right column boxes
    const rx = m + leftW;
    // Invoice No + Date box
    doc.rect(rx, y, rightW, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Invoice No.', rx + 4, y + 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const invNum = sale.invoiceNo.replace('INV-', '');
    doc.text(invNum, rx + 35, y + 11);
    doc.line(rx + rightW / 2, y, rx + rightW / 2, y + 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Dated.', rx + rightW / 2 + 4, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(new Date(sale.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }), rx + rightW / 2 + 4, y + 14);

    // Delivery Note | Mode/Terms
    doc.rect(rx, y + 18, rightW / 2, 16);
    doc.rect(rx + rightW / 2, y + 18, rightW / 2, 16);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text('Delivery', rx + 3, y + 25);
    doc.text('Note.', rx + 3, y + 29);
    doc.text('Mode/Terms of Payment', rx + rightW / 2 + 3, y + 27);
    if (data?.deliveryNote) { doc.setFont('helvetica', 'normal'); doc.text(data.deliveryNote, rx + 20, y + 27); }
    if (data?.paymentTerms) { doc.setFont('helvetica', 'normal'); doc.text(data.paymentTerms, rx + rightW / 2 + 3, y + 32); }

    // Suppliers Ref | Other References
    doc.rect(rx, y + 34, rightW / 2, 18);
    doc.rect(rx + rightW / 2, y + 34, rightW / 2, 18);
    doc.setFont('helvetica', 'bold');
    doc.text('Suppliers Ref.', rx + 3, y + 42);
    doc.text('Other Reference(s)', rx + rightW / 2 + 3, y + 40);
    if (data?.otherRef) { doc.setFont('helvetica', 'normal'); doc.text(data.otherRef, rx + rightW / 2 + 3, y + 46); }

    y += r1h;

    // ── ROW 2: Client Details (left) | Order details (right) ──
    const r2h = 32;
    doc.rect(m, y, leftW, r2h);

    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`Client :  ${customer?.name || ''}`, m + 3, y + 6);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    const caddr = doc.splitTextToSize(customer?.address || '', leftW - 6);
    let cay = y + 11;
    caddr.forEach(l => { doc.text(l, m + 3, cay); cay += 3.5; });

    // Right: Buyers Order No | Dated
    doc.rect(rx, y, rightW / 2, 16);
    doc.rect(rx + rightW / 2, y, rightW / 2, 16);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('Buyers Order No.', rx + 3, y + 7);
    doc.text('Dated', rx + rightW / 2 + 3, y + 7);
    if (data?.buyersOrderNo) { doc.setFont('helvetica', 'bold'); doc.text(data.buyersOrderNo, rx + 3, y + 12); }
    if (data?.buyersOrderDate) { doc.setFont('helvetica', 'bold'); doc.text(data.buyersOrderDate, rx + rightW / 2 + 3, y + 12); }

    // Despatch | Delivery Note Date
    doc.rect(rx, y + 16, rightW / 2, 16);
    doc.rect(rx + rightW / 2, y + 16, rightW / 2, 16);
    doc.setFont('helvetica', 'bold');
    doc.text('Despatch', rx + 3, y + 23);
    doc.text('Document No.', rx + 3, y + 27);
    doc.text('Delivery Note Date', rx + rightW / 2 + 3, y + 25);

    y += r2h;

    // ── ITEMS TABLE ──
    const itemRows = items.map((item, i) => [
      `${i + 1}]`,
      item.description + (item.hsnCode ? `\nHSN- ${item.hsnCode}` : ''),
      item.hsnCode || '',
      item.uom,
      Number(item.quantity).toFixed(2),
      Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    ]);

    doc.autoTable({
      startY: y,
      head: [['Sr.\nNo', 'Description of Goods', 'HSN/\nSAC', 'UOM', 'QTY', 'RATE', 'AMOUNT']],
      body: itemRows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 7.5, fontStyle: 'bold', lineWidth: 0.4, lineColor: [0, 0, 0], halign: 'center', cellPadding: 3 },
      styles: { fontSize: 7.5, cellPadding: 3, lineWidth: 0.4, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: m, right: m },
    });

    let ty = doc.lastAutoTable.finalY;

    // ── CENVAT + TOTALS SECTION ──
    const subtotal = items.reduce((s, it) => s + Number(it.amount), 0);
    const cgst = subtotal * halfGst / 100;
    const sgst = subtotal * halfGst / 100;
    const totalBeforeRound = subtotal + cgst + sgst;
    const grandTotal = Math.round(totalBeforeRound);
    const roundOff = grandTotal - totalBeforeRound;

    // CENVAT text on left, totals on right
    const totBoxH = 48;
    const totLeftW = cw * 0.55;
    const totRightW = cw * 0.45;
    doc.rect(m, ty, totLeftW, totBoxH);
    doc.rect(m + totLeftW, ty, totRightW, totBoxH);

    // CENVAT text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    const cenvatText = '"This is to certify that we are not availing any CENVAT Credit on inputs and that our firm is individual / HUF / Proprietary Firm / Partnership Firm / AQP"';
    const cenvatLines = doc.splitTextToSize(cenvatText, totLeftW - 8);
    let cenY = ty + 8;
    cenvatLines.forEach(l => { doc.text(l, m + 4, cenY); cenY += 3.5; });

    // Totals on right
    const trx = m + totLeftW + 3;
    const trr = pageW - m - 4;
    let try1 = ty + 8;
    const drawTotLine = (label, val, bold) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(label, trx, try1);
      doc.text(val, trr, try1, { align: 'right' });
      try1 += 8;
    };
    drawTotLine('Sub Total', subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), false);
    drawTotLine(`CGST @ ${halfGst}%`, cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }), true);
    drawTotLine(`SGST @  ${halfGst}%`, sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }), true);
    drawTotLine('Round off', roundOff.toFixed(2), false);

    ty += totBoxH;

    // ── AMOUNT IN WORDS ROW ──
    doc.rect(m, ty, cw, 10);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`Amount Chargable (Rs) : ${numberToWords(grandTotal)} Only.`, m + 3, ty + 6);
    doc.text('E,& O.E', m + cw - 3, ty + 6, { align: 'right' });
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

    const totalTaxable = subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const totalC = cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const totalS = sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    hsnRows.push([
      { content: 'Total', styles: { halign: 'right', fontStyle: 'bold' } },
      { content: totalTaxable, styles: { fontStyle: 'bold' } },
      { content: '' },
      { content: totalC, styles: { fontStyle: 'bold' } },
      { content: '' },
      { content: totalS, styles: { fontStyle: 'bold' } }
    ]);

    doc.autoTable({
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
    
    let endY = doc.lastAutoTable.finalY;

    // ── TAX AMOUNT ──
    doc.rect(m, endY, cw, 10);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Tax Amount (Rs):', m + 3, endY + 6);
    doc.text((cgst + sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 }), m + 40, endY + 6);
    endY += 10;

    // ── GSTN + SIGNATURES ──
    doc.rect(m, endY, cw, 22);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`GSTN NO:  ${companyInfo.gstNumber}`, m + 3, endY + 7);
    doc.text('Client Sign.', m + 3, endY + 16);
    doc.text(`FOR   ${companyInfo.name.replace('M/S. ', '')}`, m + cw * 0.55, endY + 10);

    doc.save(`Invoice_${sale.invoiceNo}.pdf`);
    addToast(`Invoice ${sale.invoiceNo} downloaded`, 'success');
  };

  const sendWhatsApp = (sale) => {
    const customer = customers.find(c => c.id === sale.customerId);
    const phone = (customer?.phone || '').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `*Tax Invoice: ${sale.invoiceNo}*\nDate: ${new Date(sale.date).toLocaleDateString('en-IN')}\nAmount: ₹${sale.totalAmount.toLocaleString('en-IN')}\n\nFrom: ${companyInfo.name}\nMob: ${companyInfo.phone}`
    );
    window.open(`https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${text}`, '_blank');
  };

  const sendEmail = (sale) => {
    const customer = customers.find(c => c.id === sale.customerId);
    const subject = encodeURIComponent(`Invoice ${sale.invoiceNo} - ${companyInfo.name}`);
    const body = encodeURIComponent(`Dear ${customer?.contactPerson || 'Sir/Madam'},\n\nInvoice: ${sale.invoiceNo}\nAmount: ₹${sale.totalAmount.toLocaleString('en-IN')}\nDate: ${new Date(sale.date).toLocaleDateString('en-IN')}\n\nRegards,\n${companyInfo.name}\nMob: ${companyInfo.phone}`);
    window.open(`mailto:${customer?.email || ''}?subject=${subject}&body=${body}`);
  };

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
                      <label className="form-label" style={{ fontSize: 11 }}>Other Reference(s)</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.otherRef} onChange={e => setEditData({ ...editData, otherRef: e.target.value })} placeholder="e.g. Q. 110 /25-26  Dt.15-12-2026" disabled={selectedSale.isLocked} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Suppliers Ref.</label>
                      <input className="form-input" style={{ fontSize: 11 }} value={editData.suppliersRef} onChange={e => setEditData({ ...editData, suppliersRef: e.target.value })} disabled={selectedSale.isLocked} />
                    </div>
                  </div>
                </div>

                {/* Client */}
                <div style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
                  <strong>Client:</strong> {selectedCustomer?.name} | {selectedCustomer?.address} | GSTIN: {selectedCustomer?.gstNumber}
                </div>

                {/* Editable Items */}
                <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--primary-600)', fontSize: 12 }}>Items {selectedSale.isLocked ? '' : '(editable — you can change description, HSN, UOM, Qty, Rate)'}</div>
                <div className="table-container" style={{ marginBottom: 16 }}>
                  <table className="data-table" style={{ minWidth: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>Sr.</th>
                        <th>Description of Goods</th>
                        <th style={{ width: 80 }}>HSN/SAC</th>
                        <th style={{ width: 60 }}>UOM</th>
                        <th style={{ width: 70 }}>QTY</th>
                        <th style={{ width: 90 }}>RATE</th>
                        <th style={{ width: 100, textAlign: 'right' }}>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editData.items.map((item, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center' }}>{i + 1}]</td>
                          <td><input className="form-input" style={{ fontSize: 13, padding: '8px 10px' }} value={item.description} onChange={e => updateEditItem(i, 'description', e.target.value)} disabled={selectedSale.isLocked} /></td>
                          <td><input className="form-input" style={{ fontSize: 13, padding: '8px 10px' }} value={item.hsnCode} onChange={e => updateEditItem(i, 'hsnCode', e.target.value)} placeholder="e.g. 9987" disabled={selectedSale.isLocked} /></td>
                          <td><input className="form-input" style={{ fontSize: 13, padding: '8px 10px' }} value={item.uom} onChange={e => updateEditItem(i, 'uom', e.target.value)} disabled={selectedSale.isLocked} /></td>
                          <td><input type="number" className="form-input" style={{ fontSize: 13, padding: '8px 10px' }} value={item.quantity} onChange={e => updateEditItem(i, 'quantity', e.target.value)} min="0" step="0.01" disabled={selectedSale.isLocked} /></td>
                          <td><input type="number" className="form-input" style={{ fontSize: 13, padding: '8px 10px' }} value={item.rate} onChange={e => updateEditItem(i, 'rate', e.target.value)} min="0" step="0.01" disabled={selectedSale.isLocked} /></td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Preview */}
                {(() => {
                  const sub = editData.items.reduce((s, it) => s + Number(it.amount), 0);
                  const c = sub * halfGst / 100;
                  const sg = sub * halfGst / 100;
                  const tot = Math.round(sub + c + sg);
                  return (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ width: 280, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}><span>Sub Total</span><span>₹{sub.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}><span><strong>CGST @ {halfGst}%</strong></span><span>₹{c.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}><span><strong>SGST @ {halfGst}%</strong></span><span>₹{sg.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}><span>Round off</span><span>{(tot - (sub + c + sg)).toFixed(2)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 800, fontSize: 15, color: 'var(--primary-700)' }}><span>Total Rs.</span><span>₹{tot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div style={{ fontSize: 10, color: 'var(--gray-600)', marginTop: 4 }}>{numberToWords(tot)} Only</div>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-500)' }}>
                  <div>GSTN NO: {companyInfo.gstNumber}<br/>Client Sign.</div>
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
