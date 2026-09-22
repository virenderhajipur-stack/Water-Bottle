const MONEY_FORMATTER = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0
});

const labelMap = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',
  other: 'Other'
};

export function formatMoney(value) {
  const num = Number(value || 0);
  return `₹${MONEY_FORMATTER.format(Math.round(num))}`;
}

export function buildReceiptNumber(id = '') {
  const raw = String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase();
  return raw ? `INV-${raw}` : `INV-${Date.now().toString().slice(-6)}`;
}

export function formatReceiptDate(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function buildReceiptLines(payment, settings = {}) {
  const businessName = settings.businessName || 'Business Receipt';
  const businessPhone = settings.businessPhone || '';
  const businessAddress = settings.businessAddress || '';
  const receiptFooter = settings.receiptFooter || 'Thank you for your business!';
  const signatureText = settings.signatureText || 'Authorized Signatory';
  const customerName = payment?.customerId?.name || '—';
  const customerId = payment?.customerId?.customerId || '—';
  const method = labelMap[payment?.paymentMethod] || payment?.paymentMethod || '—';
  const reference = payment?.referenceId || '—';

  const lines = [
    businessName,
    businessPhone,
    businessAddress,
    '----------------------------------------',
    'Payment Invoice / Receipt',
    `Receipt No: ${buildReceiptNumber(payment?._id)}`,
    `Date: ${formatReceiptDate(payment?.date)}`,
    `Customer: ${customerName} (${customerId})`,
    `Method: ${method}`,
    `Reference: ${reference}`,
    'Payment received',
    `Amount: ${formatMoney(payment?.amount)}`,
    `Previous Due: ${formatMoney(payment?.previousDue)}`,
    `Remaining Due: ${formatMoney(payment?.remainingDue)}`,
    'Customer Signature: __________________',
    `${signatureText}: __________________`,
    '----------------------------------------',
    receiptFooter
  ];

  return lines.filter((line) => line !== '').map((line) => String(line));
}

export function buildReceiptHtml(payment, settings = {}) {
  const businessName = settings.businessName || 'Business Receipt';
  const businessPhone = settings.businessPhone || '';
  const businessAddress = settings.businessAddress || '';
  const footer = settings.receiptFooter || 'Thank you for your business!';
  const signatureText = settings.signatureText || 'Authorized Signatory';
  const amount = formatMoney(payment?.amount);
  const previousDue = formatMoney(payment?.previousDue);
  const remainingDue = formatMoney(payment?.remainingDue);
  const receiptNo = buildReceiptNumber(payment?._id);
  const customerName = payment?.customerId?.name || '—';
  const customerId = payment?.customerId?.customerId || '—';
  const method = labelMap[payment?.paymentMethod] || payment?.paymentMethod || '—';
  const ref = payment?.referenceId || '—';

  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(receiptNo)} Receipt</title>
    <style>
      body {
        margin: 0;
        padding: 28px 18px;
        font-family: Inter, 'Segoe UI', sans-serif;
        color: #0f172a;
        background: #f8fafc;
      }
      .invoice {
        max-width: 460px;
        margin: 0 auto;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 22px 20px 18px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
      }
      .brand {
        text-align: center;
        padding-bottom: 14px;
        border-bottom: 2px solid #dbeafe;
      }
      .brand h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 800;
      }
      .brand p {
        margin: 3px 0;
        font-size: 12px;
        color: #64748b;
      }
      .title {
        margin: 18px 0 8px;
        text-align: center;
        font-size: 12px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #64748b;
      }
      .amount {
        text-align: center;
        font-size: 34px;
        font-weight: 900;
        color: #0f766e;
        margin: 8px 0 18px;
      }
      .meta {
        display: grid;
        gap: 10px;
        font-size: 13px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 7px 0;
        border-bottom: 1px solid #e2e8f0;
      }
      .row .label { color: #64748b; }
      .row .value { font-weight: 700; text-align: right; }
      .row.total { font-weight: 900; border-top: 2px solid #0f172a; margin-top: 12px; padding-top: 10px; }
      .footer {
        margin-top: 18px;
        text-align: center;
        font-size: 12px;
        color: #64748b;
      }
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 22px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
      }
      .sign-box {
        border-top: 1px solid #0f172a;
        padding-top: 8px;
        text-align: center;
        font-size: 11px;
        color: #475569;
        min-height: 36px;
      }
      @media print {
        body {
          background: white;
          padding: 0;
        }
        .invoice {
          box-shadow: none;
          border: none;
          border-radius: 0;
          max-width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <div class="invoice">
      <div class="brand">
        <h1>${esc(businessName)}</h1>
        <p>${esc(businessPhone)}</p>
        <p>${esc(businessAddress)}</p>
      </div>
      <div class="title">Payment Invoice</div>
      <div class="amount">${esc(amount)}</div>
      <div class="meta">
        <div class="row"><span class="label">Receipt No</span><span class="value">${esc(receiptNo)}</span></div>
        <div class="row"><span class="label">Customer</span><span class="value">${esc(customerName)}</span></div>
        <div class="row"><span class="label">Customer ID</span><span class="value">${esc(customerId)}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${esc(formatReceiptDate(payment?.date))}</span></div>
        <div class="row"><span class="label">Method</span><span class="value">${esc(method)}</span></div>
        <div class="row"><span class="label">Reference</span><span class="value">${esc(ref)}</span></div>
        <div class="row"><span class="label">Previous Due</span><span class="value">${esc(previousDue)}</span></div>
        <div class="row"><span class="label">Payment Received</span><span class="value">${esc(amount)}</span></div>
        <div class="row total"><span class="label">Remaining Due</span><span class="value">${esc(remainingDue)}</span></div>
      </div>
      <div class="signatures">
        <div class="sign-box">Customer Signature</div>
        <div class="sign-box">${esc(signatureText)}</div>
      </div>
      <div class="footer">${esc(footer)}</div>
    </div>
  </body>
</html>`;
}

export function buildTransactionReceiptHtml(transaction, settings = {}) {
  const businessName = settings.businessName || 'Business Receipt';
  const businessPhone = settings.businessPhone || '';
  const businessAddress = settings.businessAddress || '';
  const footer = settings.receiptFooter || 'Thank you for your business!';
  const signatureText = settings.signatureText || 'Authorized Signatory';
  const receiptNo = buildReceiptNumber(transaction?._id);
  const customerName = transaction?.customerId?.name || transaction?.customer?.name || '—';
  const customerId = transaction?.customerId?.customerId || transaction?.customer?.customerId || '—';
  const type = transaction?.transactionType === 'refill' ? 'Bottle Refill Invoice' : 'New Bottle Invoice';
  const quantity = Number(transaction?.quantity || 0);
  const total = formatMoney(transaction?.totalAmount);
  const paid = formatMoney(transaction?.paymentAmount);
  const due = formatMoney(transaction?.remainingDue ?? transaction?.customer?.money?.balance);
  const rate = formatMoney(transaction?.unitPrice);
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${esc(receiptNo)} Invoice</title>
    <style>
      body{margin:0;padding:28px 18px;font-family:Inter,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc}
      .invoice{max-width:460px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:22px 20px 18px;box-shadow:0 12px 32px rgba(15,23,42,.08)}
      .brand{text-align:center;padding-bottom:14px;border-bottom:2px solid #dbeafe}.brand h1{margin:0;font-size:22px;font-weight:800}.brand p{margin:3px 0;font-size:12px;color:#64748b}
      .title{margin:18px 0 8px;text-align:center;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#64748b}.amount{text-align:center;font-size:34px;font-weight:900;color:#0f766e;margin:8px 0 18px}
      .meta{display:grid;gap:10px;font-size:13px}.row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #e2e8f0}.label{color:#64748b}.value{font-weight:700;text-align:right}.total{font-weight:900;border-top:2px solid #0f172a;margin-top:12px;padding-top:10px}
      .footer{margin-top:18px;text-align:center;font-size:12px;color:#64748b}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px;padding-top:16px;border-top:1px solid #e2e8f0}.sign-box{border-top:1px solid #0f172a;padding-top:8px;text-align:center;font-size:11px;color:#475569;min-height:36px}
      @media print{body{background:#fff;padding:0}.invoice{box-shadow:none;border:none;border-radius:0;max-width:100%}}
    </style>
  </head>
  <body><div class="invoice"><div class="brand"><h1>${esc(businessName)}</h1><p>${esc(businessPhone)}</p><p>${esc(businessAddress)}</p></div>
    <div class="title">${esc(type)}</div><div class="amount">${esc(total)}</div><div class="meta">
      <div class="row"><span class="label">Invoice No</span><span class="value">${esc(receiptNo)}</span></div>
      <div class="row"><span class="label">Customer</span><span class="value">${esc(customerName)}</span></div><div class="row"><span class="label">Customer ID</span><span class="value">${esc(customerId)}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${esc(formatReceiptDate(transaction?.date))}</span></div><div class="row"><span class="label">Quantity</span><span class="value">${esc(quantity)} bottles</span></div>
      <div class="row"><span class="label">Rate</span><span class="value">${esc(rate)}</span></div><div class="row"><span class="label">Total</span><span class="value">${esc(total)}</span></div>
      <div class="row"><span class="label">Paid now</span><span class="value">${esc(paid)}</span></div><div class="row total"><span class="label">Remaining Due</span><span class="value">${esc(due)}</span></div>
    </div><div class="signatures"><div class="sign-box">Customer Signature</div><div class="sign-box">${esc(signatureText)}</div></div><div class="footer">${esc(footer)}</div>
  </div></body>
</html>`;
}
