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

  // Generate blank rows to fill up to 10 rows minimum
  const extraRowsCount = Math.max(0, 10 - (items?.length || 0));

  return (
    <div id="invoice-print-container">
      <div className="container" id="invoice-print">
        {/* Header */}
        <table className="header" style={{ marginBottom: 5 }}>
          <tbody>
            <tr>
              <td style={{ width: '33%' }}></td>
              <td className="title" style={{ width: '33%' }}>Tax Invoice</td>
              <td className="right" style={{ width: '33%' }}>Mob: {companyInfo.phone}</td>
            </tr>
          </tbody>
        </table>

        {/* Top Section */}
        <table className="box">
          <tbody>
            <tr>
              {/* Left */}
              <td width="50%">
                <b>{companyInfo.name}</b><br />
                <span style={{ whiteSpace: 'pre-line' }}>{companyInfo.address}</span><br />
                GSTN/UIN: {companyInfo.gstNumber}<br />
                E-mail- {companyInfo.email}
              </td>

              {/* Right - Setting padding 0 so inner table collapses properly */}
              <td width="50%" style={{ padding: 0 }}>
                <table className="inner-table" width="100%">
                  <tbody>
                    <tr>
                      <td>Invoice No.<br/><b>{sale.invoiceNo}</b></td>
                      <td>Dated.<br/><b>{formatDate(sale.date)}</b></td>
                    </tr>
                    <tr>
                      <td>Delivery Note.<br/><b>{sale.invoiceData?.deliveryNote || ''}</b></td>
                      <td>Mode/Terms of Payment<br/><b>{sale.invoiceData?.paymentTerms || ''}</b></td>
                    </tr>
                    <tr>
                      <td>Suppliers Ref.<br/><b>{sale.invoiceData?.suppliersRef || ''}</b></td>
                      <td>Other Reference(s)<br/><b>{sale.invoiceData?.otherRef || ''}</b></td>
                    </tr>
                    <tr>
                      <td>Buyers Order No.<br/><b>{sale.invoiceData?.buyersOrderNo || ''}</b></td>
                      <td>Dated<br/><b>{sale.invoiceData?.buyersOrderDate || ''}</b></td>
                    </tr>
                    <tr>
                      <td>Despatch Document No.<br/><b>{sale.invoiceData?.despatchDocNo || ''}</b></td>
                      <td>Delivery Note Date<br/><b>{sale.invoiceData?.deliveryNoteDate || ''}</b></td>
                    </tr>
                    <tr>
                      <td>Despatched through<br/><b>{sale.invoiceData?.despatchedThrough || ''}</b></td>
                      <td>Destination<br/><b>{sale.invoiceData?.destination || ''}</b></td>
                    </tr>
                    <tr>
                      <td colSpan="2" style={{ borderBottom: 'none' }}>Terms of Delivery<br/><b>{sale.invoiceData?.termsOfDelivery || ''}</b></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Client */}
        <table className="client">
          <tbody>
            <tr>
              <td>
                <b>Client : {customer.name}</b><br />
                <span style={{ whiteSpace: 'pre-line' }}>{customer.address}</span><br />
                GSTN NO: {customer.gstNumber}<br />
                Vendor Code: {customer.vendorCode || ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items Table */}
        <table className="items">
          <thead>
            <tr>
              <th width="60">Sr. No</th>
              <th width="280">Description of Goods</th>
              <th width="100">HSN/SAC</th>
              <th width="80">UOM</th>
              <th width="80">QTY</th>
              <th width="100">RATE</th>
              <th width="120">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {/* Rows */}
            {(items || []).map((item, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td style={{ textAlign: 'left' }}><b>{item.description}</b></td>
                <td>{item.hsnCode}</td>
                <td>{item.uom}</td>
                <td>{Number(item.quantity).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(item.rate)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
              </tr>
            ))}

            {/* Empty rows (important for spacing like Excel) */}
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
            
            {/* Totals */}
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
              <td colSpan={6} style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>Total Rs.</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer info added natively with same styling */}
        <table className="box" style={{ borderTop: 'none', borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <tr>
              <td colSpan={2} style={{ borderTop: 'none', padding: 5, border: '1px solid black' }}>
                <b>Amount Chargeable (in words): Rupees {numberToWords(total)} Only.</b>
              </td>
            </tr>
            <tr>
              <td width="60%" style={{ verticalAlign: 'top', padding: 5, border: '1px solid black' }}>
                <u>Bank Details</u><br />
                Bank: <b>{companyInfo.bankName}</b><br />
                A/c No: <b>{companyInfo.accountNo}</b><br />
                IFSC: <b>{companyInfo.ifsc}</b><br />
                <br />
                <i>Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</i>
              </td>
              <td width="40%" style={{ textAlign: 'right', verticalAlign: 'top', padding: 5, border: '1px solid black' }}>
                <b>For {companyInfo.name}</b><br /><br /><br /><br />
                <b>Authorised Signatory</b>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '10px' }}>
          This is a Computer Generated Invoice
        </div>

      </div>

      {/* Styles */}
      <style>{`
        #invoice-print-container {
          font-family: Calibri, Arial, sans-serif;
          font-size: 11.5px;
          color: #000;
        }

        #invoice-print-container .container {
          width: 900px;
          margin: auto;
          background: #fff;
          padding: 20px;
        }

        #invoice-print-container .header {
          width: 100%;
          margin-bottom: 5px;
        }

        #invoice-print-container .header td {
          border: none;
        }

        #invoice-print-container .title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
        }

        #invoice-print-container .right {
          text-align: right;
        }

        #invoice-print-container table {
          border-collapse: collapse;
          width: 100%;
        }

        #invoice-print-container .box td {
          border: 1px solid black;
          vertical-align: top;
          padding: 5px;
        }

        #invoice-print-container .inner-table td {
          border-bottom: 1px solid black;
          border-right: 1px solid black; /* added internal borders to match grid */
          height: 22px;
          padding: 2px 5px;
        }
        #invoice-print-container .inner-table tr:last-child td {
          border-bottom: none; /* remove bottom border for last row inside box */
        }
        #invoice-print-container .inner-table td:last-child {
          border-right: none;
        }
        #invoice-print-container .inner-table td {
          border-top: none;
          border-left: none;
        }

        #invoice-print-container .client td {
          border: 1px solid black;
          border-top: none;
          padding: 5px;
          height: 70px;
        }

        #invoice-print-container .items th, 
        #invoice-print-container .items td {
          border: 1px solid black;
          border-top: none;
          height: 28px;
          padding: 3px;
          text-align: center;
        }

        #invoice-print-container .items th {
          font-weight: bold;
          border-top: 1px solid black;
        }

        /* Essential Print Overrides */
        @media screen {
          #invoice-print-container { display: none !important; }
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
          #invoice-print-container .container {
            width: 100%; /* let it scale to page width */
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
