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

        {/* CLIENT & DETAILS */}
        <table style={{ borderTop: 'none', borderBottom: 'none' }}>
          <tbody>
            <tr>
              <td style={{ borderTop: 'none', width: '55%', verticalAlign: 'top', borderRight: '1px solid black' }}>
                <b style={{fontSize: '14px'}}>Client : {customer?.name || 'Customer'}</b><br />
                <span style={{ whiteSpace: 'pre-line' }}>{customer?.address || ''}</span><br /><br />
                GSTN NO: {customer?.gstNumber || ''}<br />
                Mail- {customer?.email || ''}<br />
                Vender Code- {customer?.vendorCode || ''}
              </td>
              <td style={{ borderTop: 'none', width: '45%', padding: 0, verticalAlign: 'top' }}>
                 <table style={{ height: '100%' }}>
                  <tbody>
                    <tr className="small-row">
                      <td style={{ borderTop: 'none', borderLeft: 'none' }}>Buyers Order No.<br/><b>{sale?.invoiceData?.buyersOrderNo || ''}</b></td>
                      <td style={{ borderTop: 'none', borderRight: 'none' }}>Dated<br/><b>{sale?.invoiceData?.buyersOrderDate || ''}</b></td>
                    </tr>
                    <tr className="small-row">
                      <td style={{ borderLeft: 'none' }}>Despatch Document No.<br/><b>{sale?.invoiceData?.despatchDocNo || ''}</b></td>
                      <td style={{ borderRight: 'none' }}>Delivery Note Date<br/><b>{sale?.invoiceData?.deliveryNoteDate || ''}</b></td>
                    </tr>
                    <tr className="small-row">
                      <td style={{ borderLeft: 'none' }}>Despatched through<br/><b>{sale?.invoiceData?.despatchedThrough || ''}</b></td>
                      <td style={{ borderRight: 'none' }}>Destination<br/><b>{sale?.invoiceData?.destination || ''}</b></td>
                    </tr>
                    <tr className="small-row">
                      <td colSpan="2" style={{ borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>Terms of Delivery<br/><b>{sale?.invoiceData?.termsOfDelivery || ''}</b></td>
                    </tr>
                  </tbody>
                 </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ITEMS */}
        <table className="items" style={{ borderTop: '1px solid black' }}>
          <thead>
            <tr>
              <th width="40">Sr.<br/>No</th>
              <th style={{ textAlign: 'center' }}>Description of Goods</th>
              <th width="70">HSN/<br/>SAC</th>
              <th width="60">UOM</th>
              <th width="70">QTY</th>
              <th width="90" style={{ textAlign: 'center' }}>RATE</th>
              <th width="110" style={{ textAlign: 'center' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td className="center" style={{ verticalAlign: 'top', borderBottom: 'none' }}>{i + 1}</td>
                <td style={{ verticalAlign: 'top', borderBottom: 'none' }}>
                    <b>{item.description}</b>
                    {item.description.toLowerCase().includes('boiler') && (
                        <div style={{fontSize: '11px', marginTop: '4px', fontWeight: 'normal', fontStyle: 'italic', color: '#333', paddingLeft: '5px'}}>
                            # On visit check the system and change defective<br/>
                            # Open burner assembly done electric checking<br/>
                            # Check internals & change nozzle and check spark<br/>
                            # Started unit and taken trial found nozzle spray is proper<br/>
                            <span style={{marginLeft: '10px'}}>Visit Dt- 30/03/26 NG 11am-7.30pm</span><br/>
                            <span style={{marginLeft: '10px'}}>Visit Dt- 01/04/26 SD 10am-6pm</span>
                        </div>
                    )}
                </td>
                <td className="center" style={{ verticalAlign: 'top', borderBottom: 'none' }}>{item.hsnCode}</td>
                <td className="center" style={{ verticalAlign: 'top', borderBottom: 'none' }}>{item.uom}</td>
                <td className="center" style={{ verticalAlign: 'top', borderBottom: 'none' }}>{Number(item.quantity).toFixed(2)}</td>
                <td className="right" style={{ verticalAlign: 'top', borderBottom: 'none' }}>{formatCurrency(item.rate)}</td>
                <td className="right" style={{ verticalAlign: 'top', borderBottom: 'none' }}>{formatCurrency(item.amount)}</td>
              </tr>
            ))}

            {/* EMPTY ROWS TO PUSH TOTALS DOWN LIKE THE REAL INVOICE */}
            <tr style={{height: '100px'}}>
                <td style={{ borderTop: 'none', borderBottom: 'none' }}></td>
                <td style={{ borderTop: 'none', borderBottom: 'none' }}></td>
                <td style={{ borderTop: 'none', borderBottom: 'none' }}></td>
                <td style={{ borderTop: 'none', borderBottom: 'none' }}></td>
                <td style={{ borderTop: 'none', borderBottom: 'none' }}></td>
                <td style={{ borderTop: 'none', borderBottom: 'none' }}></td>
                <td style={{ borderTop: 'none', borderBottom: 'none' }}></td>
            </tr>

            {/* TOTALS INSIDE THE GRID */}
            <tr>
              <td colSpan="5" rowSpan={4} style={{ borderTop: '1px solid black', borderBottom: '1px solid black' }}></td>
              <td className="right">Sub total</td>
              <td className="right">{formatCurrency(subTotal)}</td>
            </tr>
            <tr>
              <td className="right bold">CGST @ {gstRate} %</td>
              <td className="right">{formatCurrency(tax)}</td>
            </tr>
            <tr>
              <td className="right bold">SGST @ {gstRate} %</td>
              <td className="right">{formatCurrency(tax)}</td>
            </tr>
            <tr>
              <td className="right">Round Off</td>
              <td className="right">{formatCurrency(roundOff)}</td>
            </tr>
            <tr>
              <td colSpan="5" className="bold" style={{ textAlign: 'left', borderRight: '1px solid black' }}>Amount Chargeable (Rs) : {numberToWords(total)} Only.</td>
              <td className="right bold" style={{ borderRight: '1px solid black' }}>Total</td>
              <td className="right bold">{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>

         {/* VERY BOTTOM TABLES FOR TAX BREAKDOWN */}
         <table style={{ borderTop: 'none', borderBottom: 'none' }}>
             <tbody>
                  <tr>
                      <td style={{width: '60%', borderRight: 'none', borderLeft: '1px solid black', borderTop: 'none', borderBottom: 'none'}}></td>
                      <td style={{width: '40%', borderLeft: 'none', borderRight: '1px solid black', borderTop: 'none', borderBottom: 'none', textAlign: 'right', fontSize: '11px', paddingRight: '20px'}}>E,& O.E</td>
                  </tr>
             </tbody>
         </table>

         <table className="items" style={{ borderTop: '1px solid black' }}>
            <thead>
                <tr>
                    <th rowSpan={2} width="150">HSN/SAC</th>
                    <th rowSpan={2} width="100">Taxable<br/>Value</th>
                    <th colSpan={2}>Central Tax</th>
                    <th colSpan={2}>State Tax</th>
                    <th rowSpan={2} width="100">Total<br/>Tax Amount</th>
                </tr>
                <tr>
                    <th width="50">Rate</th>
                    <th width="90">Amount</th>
                    <th width="50">Rate</th>
                    <th width="90">Amount</th>
                </tr>
            </thead>
            <tbody>
                {(() => {
                    const hsnGroups = {};
                    (items || []).forEach(item => {
                        const hsn = item.hsnCode || '—';
                        if (!hsnGroups[hsn]) hsnGroups[hsn] = 0;
                        hsnGroups[hsn] += (item.amount || 0);
                    });

                    return Object.entries(hsnGroups).map(([hsn, taxableValue], idx) => {
                        const centralTax = Math.round(taxableValue * gstRate / 100);
                        const stateTax = Math.round(taxableValue * gstRate / 100);
                        return (
                            <tr key={idx}>
                                <td>{hsn}</td>
                                <td className="right">{formatCurrency(taxableValue)}</td>
                                <td className="center">{gstRate}%</td>
                                <td className="right">{formatCurrency(centralTax)}</td>
                                <td className="center">{gstRate}%</td>
                                <td className="right">{formatCurrency(stateTax)}</td>
                                <td className="right">{formatCurrency(centralTax + stateTax)}</td>
                            </tr>
                        );
                    });
                })()}
                <tr>
                    <td className="right bold">Total</td>
                    <td className="right bold">{formatCurrency(subTotal)}</td>
                    <td className="center"></td>
                    <td className="right bold">{formatCurrency(tax)}</td>
                    <td className="center"></td>
                    <td className="right bold">{formatCurrency(tax)}</td>
                    <td className="right bold">{formatCurrency(tax + tax)}</td>
                </tr>
            </tbody>
         </table>

        {/* FOOTER */}
        <table className="no-border" style={{ marginTop: '0px', border: '1px solid black', borderTop: 'none' }}>
          <tbody>
            <tr>
              <td style={{ width: '60%', borderRight: '1px solid black', padding: '10px' }}>
                <span style={{fontSize: '11px'}}>Tax Amount : {formatCurrency(tax*2)}</span><br />
                <span style={{fontWeight: 'bold', fontSize: '12px'}}>{companyInfo.bankName || 'IDBI BANK, Koper Khairane- Navi Mumbai.'}</span><br />
                <span style={{fontSize: '12px'}}>A/c No- {companyInfo.accountNo || '43110200 0001209'} RTGS/NEFT Code-{companyInfo.ifsc || 'IBKL0000431'}</span><br />
                <br />
                <b>Declaration</b><br />
                <span style={{fontSize: '10px'}}>We declare that this invoice shows the actual price of the<br/>goods described and that all particulars are true and correct.</span>
              </td>

              <td className="right" style={{ verticalAlign: 'top', padding: '10px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                    <span style={{fontSize: '13px'}}>For <b>Krishna Electrical Works</b></span>
                </div>
                <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}>
                    <span style={{fontSize: '12px', fontWeight: 'bold'}}>Authorised Signatory</span>
                </div>
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
            display: none;
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
