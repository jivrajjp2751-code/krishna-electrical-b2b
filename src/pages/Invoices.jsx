import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Download, Mail, Search, ArrowLeft, Printer, MessageCircle, Edit2, Save, Table } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import useStore from '../store/useStore';
import InvoicePrint from '../components/InvoicePrint';

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
  const formatCurrency = (val) => Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const numberToWords = (num) => {
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Fourty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convert = (n) => {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };
    const words = convert(Math.round(num));
    return words ? words + ' Only' : '';
  };

  // ═══════════════════════════════════════════════
  //  MANUAL HIGH-PRECISION PDF GENERATION (1:1)
  // ═══════════════════════════════════════════════
  const generatePDF = (sale, data) => {
    try {
      addToast(`Generating Invoice PDF...`, 'info');
      const doc = new jsPDF();
      const customer = customers.find(c => c.id === sale.customerId);
      const items = data?.items || sale.invoiceData?.items || (sale.items || []).map(item => {
        const product = products.find(p => p.id === item.productId);
        return { 
          description: product?.name || item.description || 'Product', 
          hsnCode: item.hsnCode || product?.hsnCode || '', 
          uom: item.uom || product?.unit || 'nos', 
          quantity: Number(item.quantity) || 0, 
          rate: Number(item.sellingPrice || item.rate) || 0, 
          amount: Number(item.total || item.amount) || 0 
        };
      });

      const refData = data || sale.invoiceData || {};
      const halfGst = getHalfGst();
      
      const m = 10; // margin
      const pw = 210; // page width
      const ph = 297; // page height
      const cw = pw - (m * 2); // content width
      let y = 10;

      // 1. TOP BAR (TAX INVOICE)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('Tax Invoice', pw/2, y + 8, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Mob: ${companyInfo.phone}`, pw - m, y + 6, { align: 'right' });

      y += 15;

      // 2. MAIN BORDER BOX
      const boxStartY = y;
      doc.setDrawColor(0);
      doc.setLineWidth(0.4);

      // --- SECTION 1: SUPPLIER ---
      doc.rect(m, y, cw, 45); // Supplier box
      doc.rect(m + (cw*0.55), y, cw*0.45, 45); // Ref side grid
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(companyInfo.name, m + 3, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const addrLines = doc.splitTextToSize(companyInfo.address, (cw * 0.5) - 4);
      doc.text(addrLines, m + 3, y + 12);
      doc.text(`GSTN NO: ${companyInfo.gstNumber}   PAN NO: ${companyInfo.pan || ''}`, m + 3, y + 33);
      doc.text(`Mail ID: ${companyInfo.email}`, m + 3, y + 38);

      // Ref fields grid (Right of Supplier)
      doc.setLineWidth(0.3);
      const gridX = m + (cw * 0.55);
      const colW = (cw * 0.45) / 2;
      
      doc.line(gridX, y + 15, pw - m, y + 15);
      doc.line(gridX, y + 30, pw - m, y + 30);
      doc.line(gridX + colW, y, gridX + colW, y + 30);

      doc.setFontSize(9);
      doc.text('Invoice No.', gridX + 2, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(sale.invoiceNo.replace('inv-',''), gridX + 22, y + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Dated.', gridX + colW + 2, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(new Date(sale.date).toLocaleDateString('en-IN'), gridX + colW + 15, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Delivery Note.', gridX + 2, y + 21);
      doc.text(refData.deliveryNote || '', gridX + 2, y + 26);

      doc.text('Mode/Terms of Payment', gridX + colW + 2, y + 21);
      doc.text(refData.paymentTerms || '', gridX + colW + 2, y + 26);

      doc.text('Supplier\'s Ref.', gridX + 2, y + 36);
      doc.text(refData.suppliersRef || '', gridX + 2, y + 41);

      doc.text('Other Reference(s)', gridX + colW + 2, y + 36);
      doc.text(refData.otherRef || '', gridX + colW + 2, y + 41);

      y += 45;

      // --- SECTION 2: CLIENT ---
      doc.rect(m, y, cw, 45); // Client box
      doc.rect(m + (cw*0.55), y, cw*0.45, 45); // Client Ref side grid
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`Client : ${customer?.name || 'Customer'}`, m + 3, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const custAddr = doc.splitTextToSize(customer?.address || '', (cw * 0.5) - 4);
      doc.text(custAddr, m + 3, y + 12);
      doc.text(`GST No. ${customer?.gstNumber || ''}`, m + 3, y + 34);
      doc.text(`Mail- ${customer?.email || ''}`, m + 3, y + 39);
      doc.text(`Vender Code- ${customer?.vendorCode || ''}`, m + 3, y + 43);

      // Client ref grid
      doc.line(gridX, y + 11, pw - m, y + 11);
      doc.line(gridX, y + 22, pw - m, y + 22);
      doc.line(gridX, y + 33, pw - m, y + 33);
      doc.line(gridX + colW, y, gridX + colW, y + 33);

      doc.setFontSize(9);
      doc.text('Buyer\'s Order No.', gridX + 2, y + 5);
      doc.text(refData.buyersOrderNo || '', gridX + 2, y + 10);
      doc.text('Dated', gridX + colW + 2, y + 5);
      doc.text(refData.buyersOrderDate || '', gridX + colW + 2, y + 10);

      doc.text('Despatch Document No.', gridX + 2, y + 16);
      doc.text(refData.despatchDocNo || '', gridX + 2, y + 21);
      doc.text('Delivery Note Date', gridX + colW + 2, y + 16);
      doc.text(refData.deliveryNoteDate || '', gridX + colW + 2, y + 21);

      doc.text('Despatched through', gridX + 2, y + 27);
      doc.text(refData.despatchedThrough || '', gridX + 2, y + 32);
      doc.text('Destination', gridX + colW + 2, y + 27);
      doc.text(refData.destination || '', gridX + colW + 2, y + 32);

      doc.text('Terms of Delivery', gridX + 2, y + 38);
      doc.text(refData.termsOfDelivery || '', gridX + 2, y + 43);

      y += 45;

      // 3. ITEMS TABLE
      const tableHead = [['Sr.\nNo', 'Description of Goods', 'HSN/\nSAC', 'UOM', 'QTY', 'RATE', 'AMOUNT']];
      const subTotal = items.reduce((s, it) => s + (it.amount || 0), 0);
      const taxAmount = Math.round(subTotal * halfGst / 100); 
      const gtot = Math.round(subTotal + (taxAmount * 2));
      const rOff = (gtot - (subTotal + (taxAmount * 2)));

      const rows = items.map((it, i) => [
        { content: i + 1, styles: { halign: 'center' } },
        { content: it.description, styles: { fontStyle: 'bold' } },
        { content: it.hsnCode, styles: { halign: 'center' } },
        { content: it.uom, styles: { halign: 'center' } },
        { content: Number(it.quantity).toFixed(2), styles: { halign: 'center' } },
        { content: formatCurrency(it.rate), styles: { halign: 'right' } },
        { content: formatCurrency(it.amount), styles: { halign: 'right' } }
      ]);

      // Add totals rows with specific NO-BORDER styles for the middle columns to match the sample
      rows.push([
        { content: '', styles: { border: [0, 1, 0, 1] } }, 
        { content: 'Sub total', styles: { halign: 'right', fontStyle: 'bold' } }, 
        { content: '', colSpan: 4, styles: { border: [0, 1, 0, 1] } }, 
        { content: formatCurrency(subTotal), styles: { halign: 'right', fontStyle: 'bold' } }
      ]);
      rows.push([
        { content: '', styles: { border: [0, 1, 0, 1] } }, 
        { content: `CGST @ ${halfGst} %`, styles: { halign: 'right', fontStyle: 'bold' } }, 
        { content: '', colSpan: 4, styles: { border: [0, 1, 0, 1] } }, 
        { content: formatCurrency(taxAmount), styles: { halign: 'right', fontStyle: 'bold' } }
      ]);
      rows.push([
        { content: '', styles: { border: [0, 1, 0, 1] } }, 
        { content: `SGST @ ${halfGst} %`, styles: { halign: 'right', fontStyle: 'bold' } }, 
        { content: '', colSpan: 4, styles: { border: [0, 1, 0, 1] } }, 
        { content: formatCurrency(taxAmount), styles: { halign: 'right', fontStyle: 'bold' } }
      ]);
      rows.push([
        { content: '', styles: { border: [0, 1, 0, 1] } }, 
        { content: 'Round Off', styles: { halign: 'right' } }, 
        { content: '', colSpan: 4, styles: { border: [0, 1, 0, 1] } }, 
        { content: (rOff >= 0 ? '+' : '-') + Math.abs(rOff).toFixed(2), styles: { halign: 'right' } }
      ]);
      rows.push([
        { content: '', styles: { border: [1, 1, 1, 1] } }, 
        { content: 'Total', styles: { halign: 'right', fontStyle: 'bold', fontSize: 11 } }, 
        { content: '', colSpan: 4, styles: { border: [1, 1, 1, 1] } }, 
        { content: formatCurrency(gtot), styles: { halign: 'right', fontStyle: 'bold', fontSize: 11 } }
      ]);

      autoTable(doc, {
        startY: y,
        head: tableHead,
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: 255, textColor: 0, lineWidth: 0.4, lineColor: 0, fontStyle: 'bold', halign: 'center', fontSize: 10 },
        styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.4, lineColor: 0, textColor: 0, valign: 'top', overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 80 },
            2: { cellWidth: 18 },
            3: { cellWidth: 15 },
            4: { cellWidth: 15 },
            5: { cellWidth: 25 },
            6: { cellWidth: pw - m*2 - 180 }
        },
        margin: { left: m, right: m }
      });

      y = doc.lastAutoTable.finalY + 1;
      
      // Amount in words bar
      doc.setLineWidth(0.4);
      doc.rect(m, y, cw, 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(`Amount Chargeable (Rs) : ${numberToWords(gtot)}`, m + 3, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('E,& O.E', pw - m - 3, y + 5.5, { align: 'right' });
      
      y += 10;

      // 4. TAX BREAKUP TABLE
      const hsnSum = {};
      items.forEach(it => {
        const h = it.hsnCode || '—';
        if (!hsnSum[h]) hsnSum[h] = 0;
        hsnSum[h] += (it.amount || 0);
      });

      const hsnRows = Object.entries(hsnSum).map(([h, val]) => {
        const t = Math.round(val * halfGst / 100);
        return [h, formatCurrency(val), `${halfGst}%`, formatCurrency(t), `${halfGst}%`, formatCurrency(t), formatCurrency(t*2)];
      });
      hsnRows.push([{ content: 'Total', styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(subTotal), styles: { fontStyle: 'bold' } }, '', { content: formatCurrency(taxAmount), styles: { fontStyle: 'bold' } }, '', { content: formatCurrency(taxAmount), styles: { fontStyle: 'bold' } }, { content: formatCurrency(taxAmount*2), styles: { fontStyle: 'bold' } }]);

      autoTable(doc, {
        startY: y,
        head: [
            [{ content: 'HSN/SAC', rowSpan: 2 }, { content: 'Taxable\nValue', rowSpan: 2 }, { content: 'Central Tax', colSpan: 2 }, { content: 'State Tax', colSpan: 2 }, { content: 'Total\nTax Amount', rowSpan: 2 }],
            ['Rate', 'Amount', 'Rate', 'Amount']
        ],
        body: hsnRows,
        theme: 'grid',
        headStyles: { fillColor: 255, textColor: 0, lineWidth: 0.3, lineColor: 0, fontSize: 7, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 1, lineWidth: 0.3, lineColor: 0, halign: 'right' },
        columnStyles: { 0: { halign: 'center' } },
        margin: { left: m, right: m }
      });

      y = doc.lastAutoTable.finalY + 2;

      // 5. FOOTER
      const footerY = y;
      doc.rect(m, footerY, cw, 40);
      doc.line(m + (cw * 0.6), footerY, m + (cw * 0.6), footerY + 40);
      
      doc.setFontSize(8);
      doc.text(`Tax Amount: Rs. ${formatCurrency(taxAmount*2)}`, m + 2, footerY + 5);
      doc.setFont('helvetica', 'bold');
      doc.text(companyInfo.bankName || 'IDBI BANK, Koper Khairane- Navi Mumbai.', m + 2, footerY + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(`A/c No- ${companyInfo.accountNo || '43110200 0001209'} RTGS/NEFT Code-${companyInfo.ifsc || 'IBKL0000431'}`, m + 2, footerY + 17);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Declaration', m + 2, footerY + 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('We declare that this invoice shows the actual price of the goods described', m + 2, footerY + 33);
      doc.text('and that all particulars are true and correct.', m + 2, footerY + 36);

      doc.setFontSize(9);
      doc.text(`For Krishna Electrical Works`, pw - m - 5, footerY + 8, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(`Authorised Signatory`, pw - m - 5, footerY + 35, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('This is a Computer Generated Invoice', pw/2, ph - 8, { align: 'center' });

      doc.save(`${sale.invoiceNo}.pdf`);
      addToast(`Invoice ${sale.invoiceNo} saved!`, 'success');
    } catch (err) {
      console.error('PDF Error:', err);
      addToast(`PDF Error: ${err.message}`, 'error');
    }
  };

  const shareInvoiceWithFile = async (sale, method) => {
    try {
      const element = document.getElementById(`invoice-print-capture-${sale.id}`);
      if (!element) {
          addToast('Could not find invoice layout element for generation.', 'error');
          return;
      }
      
      addToast(`Generating PDF to share...`, 'info');

      const opt = {
        margin:       [10, 10, 10, 10], // top, left, bottom, right in mm
        filename:     `${sale.invoiceNo}.pdf`,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 3, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
      
      const filename = `${sale.invoiceNo}.pdf`;
      
      const customer = customers.find(c => c.id === sale.customerId);
      const phone = (customer?.phone || '').replace(/[^0-9]/g, '');

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
                              <button className="btn btn-sm btn-outline" onClick={() => sendEmail(s)} title="Email"><Mail size={13} /></button>
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
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: 'var(--gray-500)' }}>Description of Goods</label>
                          <textarea 
                            className="form-input" 
                            style={{ fontSize: 13, minHeight: '80px', resize: 'vertical' }} 
                            value={item.description} 
                            onChange={e => updateEditItem(i, 'description', e.target.value)} 
                            disabled={selectedSale.isLocked} 
                            placeholder="Description" 
                          />
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

      {/* OFF-SCREEN RENDER FOR HTML2PDF CAPTURE (must be in DOM with layout for capture) */}
      <div id="hidden-invoice-print-wrappers" style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        {sales.map(sale => {
          const customer = customers.find(c => c.id === sale.customerId);
          let saleItems = [];
          if (sale.id === selectedSaleId && editData) {
              saleItems = editData.items;
          } else {
              saleItems = sale.invoiceData?.items || (sale.items || []).map(item => {
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
          }
          const safeSale = (sale.id === selectedSaleId && editData) ? { ...sale, invoiceData: editData } : sale;

          return (
            <div key={sale.id} id={`invoice-print-capture-${sale.id}`}>
              <InvoicePrint 
                sale={safeSale} 
                customer={customer} 
                companyInfo={companyInfo} 
                items={saleItems} 
              />
            </div>
          );
        })}
      </div>

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
