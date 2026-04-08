import React from "react";

const InvoicePrint = ({ sale, customer, companyInfo, items }) => {
  if (!sale || !customer || !companyInfo) return null;

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
  const gstRate = (companyInfo.gstRate || 18) / 2;
  const tax = Math.round(subTotal * gstRate / 100);
  const total = Math.round(subTotal + tax + tax);
  const roundOff = total - (subTotal + tax + tax);

  const extraRowsCount = Math.max(0, 5 - (items?.length || 0)); // Maintain some spacing

  return (
    <div id="invoice-print-container">
      <div className="invoice">
        {/* HEADER */}
        <table className="no-border" style={{ marginBottom: '8px' }}>
          <tbody>
            <tr>
              <td style={{ width: '33%' }}></td>
              <td className="title" style={{ width: '33%' }}>TAX INVOICE</td>
              <td className="right" style={{ width: '33%' }}>Mob: {companyInfo.phone}</td>
            </tr>
          </tbody>
        </table>

        {/* TOP SECTION */}
        <table>
          <tbody>
            <tr>
              {/* LEFT */}
              <td width="50%" style={{ verticalAlign: 'top' }}>
                <b>{companyInfo.name}</b><br />
                <span style={{ whiteSpace: 'pre-line' }}>{companyInfo.address}</span><br />
                GSTN/UIN: {companyInfo.gstNumber}<br />
                E-mail- {companyInfo.email}
              </td>

              {/* RIGHT */}
              <td width="50%" style={{ padding: 0, verticalAlign: 'top' }}>
                <table style={{ height: '100%' }}>
                  <tbody>
                    <tr className="small-row">
                      <td style={{ borderTop: 'none', borderLeft: 'none' }}>Invoice No.<br/><b>{sale.invoiceNo}</b></td>
                      <td style={{ borderTop: 'none', borderRight: 'none' }}>Dated.<br/><b>{formatDate(sale.date)}</b></td>
                    </tr>
                    <tr className="small-row">
                      <td style={{ borderLeft: 'none' }}>Delivery Note.<br/><b>{sale.invoiceData?.deliveryNote || ''}</b></td>
                      <td style={{ borderRight: 'none' }}>Mode/Terms of Payment<br/><b>{sale.invoiceData?.paymentTerms || ''}</b></td>
                    </tr>
                    <tr className="small-row">
                      <td style={{ borderLeft: 'none' }}>Suppliers Ref.<br/><b>{sale.invoiceData?.suppliersRef || ''}</b></td>
                      <td style={{ borderRight: 'none' }}>Other Reference(s)<br/><b>{sale.invoiceData?.otherRef || ''}</b></td>
                    </tr>
                    <tr className="small-row">
                      <td style={{ borderLeft: 'none' }}>Buyers Order No.<br/><b>{sale.invoiceData?.buyersOrderNo || ''}</b></td>
                      <td style={{ borderRight: 'none' }}>Dated<br/><b>{sale.invoiceData?.buyersOrderDate || ''}</b></td>
                    </tr>
                    <tr className="small-row">
                      <td style={{ borderLeft: 'none' }}>Despatch Document No.<br/><b>{sale.invoiceData?.despatchDocNo || ''}</b></td>
                      <td style={{ borderRight: 'none' }}>Delivery Note Date<br/><b>{sale.invoiceData?.deliveryNoteDate || ''}</b></td>
                    </tr>
                    <tr className="small-row">
                      <td style={{ borderLeft: 'none' }}>Despatched through<br/><b>{sale.invoiceData?.despatchedThrough || ''}</b></td>
                      <td style={{ borderRight: 'none' }}>Destination<br/><b>{sale.invoiceData?.destination || ''}</b></td>
                    </tr>
                    <tr className="small-row">
                      <td colSpan="2" style={{ borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>Terms of Delivery<br/><b>{sale.invoiceData?.termsOfDelivery || ''}</b></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* CLIENT */}
        <table style={{ borderTop: 'none' }}>
          <tbody>
            <tr>
              <td style={{ borderTop: 'none' }}>
                <b>Client : {customer.name}</b><br />
                <span style={{ whiteSpace: 'pre-line' }}>{customer.address}</span><br />
                GSTN NO: {customer.gstNumber}<br />
                Vendor Code: {customer.vendorCode || ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ITEMS */}
        <table className="items" style={{ borderTop: 'none' }}>
          <thead>
            <tr>
              <th width="50" style={{ borderTop: 'none' }}>Sr. No</th>
              <th style={{ borderTop: 'none', textAlign: 'left' }}>Description of Goods</th>
              <th width="80" style={{ borderTop: 'none' }}>HSN/SAC</th>
              <th width="70" style={{ borderTop: 'none' }}>UOM</th>
              <th width="70" style={{ borderTop: 'none' }}>QTY</th>
              <th width="90" style={{ borderTop: 'none', textAlign: 'right' }}>RATE</th>
              <th width="110" style={{ borderTop: 'none', textAlign: 'right' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td className="center" style={{ verticalAlign: 'top' }}>{i + 1}</td>
                <td style={{ verticalAlign: 'top' }}><b>{item.description}</b></td>
                <td className="center" style={{ verticalAlign: 'top' }}>{item.hsnCode}</td>
                <td className="center" style={{ verticalAlign: 'top' }}>{item.uom}</td>
                <td className="center" style={{ verticalAlign: 'top' }}>{Number(item.quantity).toFixed(2)}</td>
                <td className="right" style={{ verticalAlign: 'top' }}>{formatCurrency(item.rate)}</td>
                <td className="right" style={{ verticalAlign: 'top' }}>{formatCurrency(item.amount)}</td>
              </tr>
            ))}

            {/* EMPTY ROWS */}
            {[...Array(extraRowsCount)].map((_, i) => (
              <tr key={'empty-' + i}>
                <td>&nbsp;</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}

            {/* TOTALS (RIGHT ALIGNED LIKE PDF) */}
            <tr>
              <td colSpan="5" style={{ border: 'none', borderRight: '1px solid black' }}></td>
              <td className="right bold">Sub Total</td>
              <td className="right bold">{formatCurrency(subTotal)}</td>
            </tr>

            <tr>
              <td colSpan="5" style={{ border: 'none', borderRight: '1px solid black' }}></td>
              <td className="right bold">CGST @ {gstRate}%</td>
              <td className="right">{formatCurrency(tax)}</td>
            </tr>

            <tr>
              <td colSpan="5" style={{ border: 'none', borderRight: '1px solid black' }}></td>
              <td className="right bold">SGST @ {gstRate}%</td>
              <td className="right">{formatCurrency(tax)}</td>
            </tr>

            {Math.abs(roundOff) > 0 && (
              <tr>
                <td colSpan="5" style={{ border: 'none', borderRight: '1px solid black' }}></td>
                <td className="right bold">Round Off</td>
                <td className="right">{roundOff >= 0 ? '+' : '-'}{Math.abs(roundOff).toFixed(2)}</td>
              </tr>
            )}

            <tr>
              <td colSpan="5" style={{ border: 'none', borderRight: '1px solid black' }}></td>
              <td className="right bold">Total</td>
              <td className="right bold">{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>

        {/* FOOTER */}
        <table className="no-border" style={{ marginTop: '10px' }}>
          <tbody>
            <tr>
              <td>
                <b>Amount Chargeable (in words):</b><br />
                Rupees {numberToWords(total)} Only.
                <br /><br />
                <b>Bank Details</b><br />
                Bank: {companyInfo.bankName}<br />
                A/c No: {companyInfo.accountNo}<br />
                IFSC: {companyInfo.ifsc}<br /><br />
                <i>Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</i>
              </td>

              <td className="right" style={{ verticalAlign: 'top' }}>
                For {companyInfo.name}<br /><br /><br /><br /><br />
                Authorised Signatory
              </td>
            </tr>
          </tbody>
        </table>

        <div className="center" style={{ marginTop: '15px', fontSize: '10px' }}>
          This is a Computer Generated Invoice
        </div>

      </div>

      <style>{`
        #invoice-print-container {
          font-family: Calibri, Arial, sans-serif;
          font-size: 13px;
          color: #000;
        }

        #invoice-print-container .invoice {
          width: 900px;
          margin: auto;
          background: #fff;
          padding: 15px;
        }

        #invoice-print-container table {
          width: 100%;
          border-collapse: collapse;
        }

        #invoice-print-container td, 
        #invoice-print-container th {
          border: 1px solid black;
          padding: 4px;
        }

        #invoice-print-container .no-border td {
          border: none;
        }

        #invoice-print-container .title {
          text-align: center;
          font-weight: bold;
          font-size: 18px;
        }

        #invoice-print-container .right {
          text-align: right;
        }

        #invoice-print-container .center {
          text-align: center;
        }

        #invoice-print-container .bold {
          font-weight: bold;
        }

        #invoice-print-container .small-row td {
          height: 22px;
        }

        #invoice-print-container .items td {
          height: 26px;
        }

        @media screen {
          #invoice-print-container {
            position: absolute;
            left: 0;
            top: 0;
            z-index: -9999; /* hiding under the main app */
            pointer-events: none;
          }
        }

        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print-container, #invoice-print-container * {
            visibility: visible;
          }
          #invoice-print-container {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          #invoice-print-container .invoice {
            width: 100%;
            padding: 0;
            margin: 0;
          }
          @page {
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
};

export default InvoicePrint;
