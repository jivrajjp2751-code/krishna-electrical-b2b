import React from "react";

const InvoicePrint = ({ sale, customer, companyInfo, items }) => {
  if (!sale || !customer || !companyInfo) return null;

  // Helpers for formatting
  const formatDate = (date) => {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return ''; }
  };

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const numberToWords = (num) => {
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convert = (n) => {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };
    return convert(Math.round(num));
  };

  const subTotal = (items || []).reduce((sum, it) => sum + (it.amount || 0), 0);
  const gstRate = (companyInfo.gstRate || 18) / 2; // half for CGST/SGST
  const tax = Math.round(subTotal * gstRate / 100);
  const total = Math.round(subTotal + tax + tax);
  const roundOff = total - (subTotal + tax + tax);

  return (
    <div id="invoice-print" className="invoice">
      {/* Header */}
      <div className="header">
        <div className="empty" />
        <div className="title">Tax Invoice</div>
        <div className="mobile">Mob: {companyInfo.phone}</div>
      </div>

      {/* Top Section */}
      <div className="top-section">
        <div className="left">
          <div className="company">
            {companyInfo.name}
          </div>
          <div>
            {companyInfo.address}
          </div>
          <div style={{ marginTop: 8 }}>GSTN/UIN: {companyInfo.gstNumber}</div>
          <div>E-mail- {companyInfo.email}</div>
        </div>

        <div className="right">
          <div className="info-row"><div>Invoice No.</div><div>{sale.invoiceNo}</div></div>
          <div className="info-row"><div>Dated.</div><div>{formatDate(sale.date)}</div></div>
          <div className="info-row"><div>Delivery Note.</div><div>{sale.invoiceData?.deliveryNote || ''}</div></div>
          <div className="info-row"><div>Mode/Terms of Payment</div><div>{sale.invoiceData?.paymentTerms || ''}</div></div>
          <div className="info-row"><div>Suppliers Ref.</div><div>{sale.invoiceData?.suppliersRef || ''}</div></div>
          <div className="info-row"><div>Other Reference(s)</div><div>{sale.invoiceData?.otherRef || ''}</div></div>
          <div className="info-row"><div>Buyers Order No.</div><div>{sale.invoiceData?.buyersOrderNo || ''}</div></div>
          <div className="info-row"><div>Dated</div><div>{sale.invoiceData?.buyersOrderDate || ''}</div></div>
          <div className="info-row"><div>Despatch Document No.</div><div>{sale.invoiceData?.despatchDocNo || ''}</div></div>
          <div className="info-row"><div>Delivery Note Date</div><div>{sale.invoiceData?.deliveryNoteDate || ''}</div></div>
          <div className="info-row"><div>Despatched through</div><div>{sale.invoiceData?.despatchedThrough || ''}</div></div>
          <div className="info-row"><div>Destination</div><div>{sale.invoiceData?.destination || ''}</div></div>
          <div className="info-row" style={{ borderBottom: 'none' }}><div>Terms of Delivery</div><div>{sale.invoiceData?.termsOfDelivery || ''}</div></div>
        </div>
      </div>

      {/* Client Section */}
      <div className="client">
        <div style={{ fontWeight: 'bold' }}>Client : {customer.name}</div>
        <div>{customer.address}</div>
        <div>GSTN NO: {customer.gstNumber}</div>
        <div>Vendor Code: {customer.vendorCode || ''}</div>
      </div>

      {/* Table */}
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>Sr. No</th>
            <th style={{ width: 300, textAlign: 'left' }}>Description of Goods</th>
            <th style={{ width: 80 }}>HSN/SAC</th>
            <th style={{ width: 60 }}>UOM</th>
            <th style={{ width: 60 }}>QTY</th>
            <th style={{ width: 80, textAlign: 'right' }}>RATE</th>
            <th style={{ width: 100, textAlign: 'right' }}>AMOUNT</th>
          </tr>
        </thead>

        <tbody>
          {(items || []).map((item, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td style={{ textAlign: 'left' }}>{item.description}</td>
              <td style={{ textAlign: 'center' }}>{item.hsnCode}</td>
              <td style={{ textAlign: 'center' }}>{item.uom}</td>
              <td style={{ textAlign: 'center' }}>{Number(item.quantity).toFixed(2)}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(item.rate)}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
            </tr>
          ))}
          {/* Filler rows to maintain height if needed */}
          {[...Array(Math.max(0, 10 - (items?.length || 0)))].map((_, i) => (
            <tr key={i + 100}>
              <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
          ))}
          
          {/* Totals within the table structure to match user layout */}
          <tr>
            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 'bold' }}>Sub Total</td>
            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(subTotal)}</td>
          </tr>
          <tr>
            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 'bold' }}>CGST @ {gstRate}%</td>
            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(tax)}</td>
          </tr>
          <tr>
            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 'bold' }}>SGST @ {gstRate}%</td>
            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(tax)}</td>
          </tr>
          {Math.abs(roundOff) > 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'right' }}>Round Off</td>
              <td style={{ textAlign: 'right' }}>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</td>
            </tr>
          )}
          <tr>
            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 800, fontSize: '13px' }}>Total</td>
            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '13px' }}>{formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>

      {/* Footer Details */}
      <div className="footer-details">
        <div style={{ fontWeight: 'bold' }}>Amount Chargeable (in words): Rupees {numberToWords(total)} Only.</div>
        
        <div style={{ marginTop: 15, display: 'grid', gridTemplateColumns: '1.5fr 1fr' }}>
          <div className="bank-info">
            <div style={{ textDecoration: 'underline', marginBottom: 4 }}>Bank Details</div>
            <div>Bank: {companyInfo.bankName}</div>
            <div>A/c No: {companyInfo.accountNo}</div>
            <div>IFSC: {companyInfo.ifsc}</div>
            
            <div style={{ marginTop: 10, fontStyle: 'italic' }}>
              Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold' }}>For {companyInfo.name}</div>
            <br /><br /><br />
            <div style={{ fontWeight: 'bold' }}>Authorised Signatory</div>
          </div>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '10px' }}>
          This is a Computer Generated Invoice
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .invoice {
          width: 790px;
          margin: auto;
          background: #fff;
          padding: 20px;
          font-family: Calibri, Arial, sans-serif;
          font-size: 11.5px;
          color: #000;
        }

        .header {
          display: grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          align-items: center;
          margin-bottom: 8px;
        }

        .title {
          text-align: center;
          font-weight: bold;
          font-size: 20px;
          text-transform: uppercase;
        }

        .mobile {
          text-align: right;
          font-weight: bold;
        }

        .top-section {
          display: grid;
          grid-template-columns: 55% 45%;
          border: 1px solid #000;
        }

        .left {
          padding: 8px;
          border-right: 1px solid #000;
          line-height: 1.4;
        }

        .company {
          font-weight: 900;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .right {
          display: grid;
        }

        .info-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-bottom: 1px solid #000;
          height: auto;
          min-height: 22px;
          align-items: center;
          padding: 1px 8px;
        }

        .client {
          border: 1px solid #000;
          border-top: none;
          padding: 8px;
          line-height: 1.5;
          min-height: 70px;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          border-bottom: 1px solid #000;
        }

        .table th {
          border: 1px solid #000;
          padding: 5px;
          font-weight: bold;
          background: #f9f9f9;
          text-align: center;
        }

        .table td {
          border: 1px solid #000;
          padding: 4px 8px;
          min-height: 25px;
        }

        .footer-details {
          padding: 10px 0;
        }

        /* Print Optimization */
        @media print {
          body * { visibility: hidden; }
          #invoice-print, #invoice-print * { visibility: visible; }
          #invoice-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .invoice { width: 100%; border: none; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  );
};

export default InvoicePrint;
