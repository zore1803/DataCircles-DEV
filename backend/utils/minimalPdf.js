const PDFDocument = require("pdfkit");
const { toWords } = require("number-to-words");
const path = require("path");
const fs = require("fs");

// --- Helper Functions ---

function toCurrency(value) {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function capitalizeWords(str) {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${day} ${months[date.getMonth()]} ${year}`;
}

function getDocumentType(invoice) {
  if (invoice.deliveryChallanNumber?.startsWith("DC")) return "DELIVERY_CHALLAN";
  if (invoice.quotationNumber?.startsWith("QUO")) return "QUOTATION";
  if (invoice.performaInvoiceNumber?.startsWith("PI"))
    return "PROFORMA_INVOICE";
  if (invoice.isTaxInvoice) return "TAX_INVOICE";
  return "INVOICE";
}

function getDocumentLabels(docType) {
  const labels = {
    DELIVERY_CHALLAN: {
      title: "DELIVERY CHALLAN",
      numberLabel: "Challan #:",
      dateLabel: "Challan Date:",
    },
    QUOTATION: {
      title: "QUOTATION",
      numberLabel: "Quotation #:",
      dateLabel: "Quotation Date:",
    },
    PROFORMA_INVOICE: {
      title: "PROFORMA INVOICE",
      numberLabel: "Proforma #:",
      dateLabel: "Proforma Date:",
    },
    TAX_INVOICE: {
      title: "TAX INVOICE",
      numberLabel: "Invoice #:",
      dateLabel: "Invoice Date:",
    },
    INVOICE: {
      title: "INVOICE",
      numberLabel: "Invoice #:",
      dateLabel: "Invoice Date:",
    },
  };
  return labels[docType];
}

function getDocumentNumber(invoice) {
  if (invoice.deliveryChallanNumber) return invoice.deliveryChallanNumber;
  if (invoice.quotationNumber) return invoice.quotationNumber;
  if (invoice.performaInvoiceNumber) return invoice.performaInvoiceNumber;
  return invoice.invoiceNumber || "N/A";
}

module.exports = async function generatePdf(invoice, bankDetails, OrgDetails) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 30,
        bufferPages: true,
      });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // Register Fonts
      const fontPathRegular = path.join(__dirname, "fonts", "Roboto-Regular.ttf");
      const fontPathBold = path.join(__dirname, "fonts", "Roboto-Bold.ttf");

      if (fs.existsSync(fontPathRegular) && fs.existsSync(fontPathBold)) {
        doc.registerFont("Roboto", fontPathRegular);
        doc.registerFont("Roboto-Bold", fontPathBold);
      } else {
        console.warn("Roboto fonts not found, falling back to Helvetica");
      }

      const meieFontPath = path.join(__dirname, "fonts", "MeieScript-Regular.ttf");
      if (fs.existsSync(meieFontPath)) {
        doc.registerFont("MeieScript", meieFontPath);
      }

      const margin = 30;
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const contentWidth = pageWidth - margin * 2;
      const startX = margin;
      let currentY = margin;

      // Colors
      const brandColor = "#00008B";

      function drawCell(text, x, y, w, h, options = {}) {
        const {
          font = "Roboto",
          fontSize = 9,
          align = "left",
          border = [],
          bold = false,
          color = "black",
        } = options;

        let fontToUse = font;
        if (font === "Helvetica" || font === "Roboto") {
          fontToUse = bold ? "Roboto-Bold" : "Roboto";
        } else if (font === "Helvetica-Bold") {
          fontToUse = "Roboto-Bold";
        }

        doc
          .font(fontToUse)
          .fontSize(fontSize)
          .fillColor(color);

        // Text
        if (text) {
          doc.text(text, x + 2, y + 4, {
            width: w - 4,
            align: align,
            lineBreak: true,
            ellipsis: true
          });
        }

        doc.lineWidth(0.5).strokeColor("black");
        if (border.includes("top")) doc.moveTo(x, y).lineTo(x + w, y).stroke();
        if (border.includes("bottom")) doc.moveTo(x, y + h).lineTo(x + w, y + h).stroke();
        if (border.includes("left")) doc.moveTo(x, y).lineTo(x, y + h).stroke();
        if (border.includes("right")) doc.moveTo(x + w, y).lineTo(x + w, y + h).stroke();
      }

      function drawRect(x, y, w, h) {
        doc.lineWidth(0.5).strokeColor("black").rect(x, y, w, h).stroke();
      }

      // --- 1. HEADER ---
      const docType = getDocumentType(invoice);
      const labels = getDocumentLabels(docType);

      // Page Title Bar
      const titleHeight = 20;
      drawRect(startX, currentY, contentWidth, titleHeight);

      doc.font("Roboto-Bold").fontSize(11).fillColor(brandColor).text(labels.title, startX, currentY + 5, { width: contentWidth, align: "center" });
      doc.font("Roboto").fontSize(8).fillColor("black").text("ORIGINAL FOR RECIPIENT", startX, currentY + 6, { width: contentWidth - 10, align: "right" });
      currentY += titleHeight;

      // --- 2. COMPANY & INVOICE DETAILS ---
      const headerBlockHeight = 90;
      const leftColWidth = contentWidth * 0.55;
      const rightColWidth = contentWidth - leftColWidth;

      drawRect(startX, currentY, leftColWidth, headerBlockHeight);
      let logoY = currentY + 8;
      doc.font("Roboto-Bold").fontSize(12).fillColor(brandColor).text(OrgDetails?.companyName || "Company Name", startX + 10, logoY);
      doc.font("Roboto-Bold").fontSize(8).fillColor("black").text(`GSTIN ${OrgDetails?.gstin || ""}`, startX + 10, logoY + 18);
      doc.font("Roboto").fontSize(8).text(OrgDetails?.address || "", startX + 10, logoY + 30, { width: leftColWidth - 20 });
      doc.text(`Mobile ${OrgDetails?.mobile || ""}`, startX + 10, logoY + 65);

      const rowHeight = headerBlockHeight / 2;
      drawRect(startX + leftColWidth, currentY, rightColWidth / 2, rowHeight);
      doc.font("Roboto").fontSize(7).text(labels.numberLabel, startX + leftColWidth + 5, currentY + 5);
      doc.font("Roboto-Bold").fontSize(9).text(getDocumentNumber(invoice), startX + leftColWidth + 5, currentY + 18);

      drawRect(startX + leftColWidth + rightColWidth / 2, currentY, rightColWidth / 2, rowHeight);
      doc.font("Roboto").fontSize(7).text("Invoice Date:", startX + leftColWidth + rightColWidth / 2 + 5, currentY + 5);
      doc.font("Roboto-Bold").fontSize(9).text(formatDateDDMMYYYY(invoice.date), startX + leftColWidth + rightColWidth / 2 + 5, currentY + 18);

      drawRect(startX + leftColWidth, currentY + rowHeight, rightColWidth / 2, rowHeight);
      doc.font("Roboto").fontSize(7).text("Place of Supply:", startX + leftColWidth + 5, currentY + rowHeight + 5);
      doc.font("Roboto-Bold").fontSize(8).text(invoice.placeOfSupply || "29-KARNATAKA", startX + leftColWidth + 5, currentY + rowHeight + 18, { width: rightColWidth / 2 - 10, ellipsis: true });

      drawRect(startX + leftColWidth + rightColWidth / 2, currentY + rowHeight, rightColWidth / 2, rowHeight);
      doc.font("Roboto").fontSize(7).text("Due Date:", startX + leftColWidth + rightColWidth / 2 + 5, currentY + rowHeight + 5);
      doc.font("Roboto-Bold").fontSize(9).text(formatDateDDMMYYYY(invoice.dueDate), startX + leftColWidth + rightColWidth / 2 + 5, currentY + rowHeight + 18);

      currentY += headerBlockHeight;

      // --- 3. CUSTOMER DETAILS ---
      const addressBlockHeight = 70;
      drawRect(startX, currentY, leftColWidth, addressBlockHeight);

      const contact = invoice?.deal?.contact || {};
      const company = invoice?.deal?.company || {};
      doc.font("Roboto-Bold").fontSize(8).text("Billing Details:", startX + 5, currentY + 5);
      doc.font("Roboto-Bold").text(company.name || contact.name || "Customer Name", startX + 5, currentY + 18);
      const billingAddr = company.address || contact.address || "";
      doc.font("Roboto").fontSize(8).text("Billing address:", startX + 5, currentY + 30);
      doc.text(billingAddr, startX + 5, currentY + 42, { width: leftColWidth - 10, height: 25, ellipsis: true });

      drawRect(startX + leftColWidth, currentY, rightColWidth, addressBlockHeight);
      doc.font("Roboto-Bold").fontSize(8).text("Shipping address:", startX + leftColWidth + 5, currentY + 5);
      const shippingAddr = company.shippingAddress || billingAddr;
      doc.font("Roboto").fontSize(8).text(shippingAddr, startX + leftColWidth + 5, currentY + 18, { width: rightColWidth - 10 });

      currentY += addressBlockHeight;


      // --- 4. ITEMS TABLE (PRE-CALCULATION) ---
      const tableTopY = currentY;
      const headerHeight = 18;

      // Calculate Bottom Space Requirements to fit on ONE page
      // Footer (120) + Amount Paid (30) + Tax Table (Max 120) + Words (20) + Total (20) + Summary Rows (Variable)

      // Taxes Calculation for space
      let taxRowsCount = 0;
      const items = invoice.items || [];
      // Calculate Totals First
      let runningSubtotal = 0;
      let totalQty = 0;
      items.forEach(item => {
        const rate = parseFloat(item.rate) || 0;
        const quantity = parseFloat(item.quantity) || 0;
        const discount = parseFloat(item.discount) || 0;
        let amt = rate * quantity;
        if (item.discountType === 'percentage') { amt -= (amt * discount / 100); }
        else { amt -= discount; }
        runningSubtotal += amt;
        totalQty += quantity;
      });
      const invoiceDiscountVal = invoice.discount?.value || 0;
      let invoiceDiscountAmt = (invoice.discount?.type === 'percentage') ? runningSubtotal * (invoiceDiscountVal / 100) : invoiceDiscountVal;
      const taxableAmount = runningSubtotal - invoiceDiscountAmt;
      let grandTotal = taxableAmount;
      let taxRows = [];
      if (invoice.isTaxInvoice) {
        const rate = invoice.gstRate || 0;
        if (invoice.transactionType === 'intra') {
          taxRowsCount = 2; // CGST, SGST
          const cgst = taxableAmount * (rate / 2) / 100;
          const sgst = taxableAmount * (rate / 2) / 100;
          taxRows.push({ label: `CGST ${rate / 2}%`, val: cgst });
          taxRows.push({ label: `SGST ${rate / 2}%`, val: sgst });
          grandTotal += (cgst + sgst);
        } else {
          taxRowsCount = 1; // IGST
          const igst = taxableAmount * rate / 100;
          taxRows.push({ label: `IGST ${rate}%`, val: igst });
          grandTotal += igst;
        }
      }

      // Dimensions
      const footerH = 120;
      const amountPaidH = 30;
      const taxTableH = invoice.isTaxInvoice ? 80 : 0; // Approx
      const wordsH = 20;
      const totalRowH = 20;
      const summaryRowH = 16;
      const summarySectionH = summaryRowH * (1 + taxRowsCount); // Taxable + Taxes

      const totalBottomReserve = footerH + amountPaidH + taxTableH + wordsH + totalRowH + summarySectionH + 20; // +20 buffer

      const availableHeightOriginal = pageHeight - margin - tableTopY - headerHeight;
      const availableForItemRows = availableHeightOriginal - totalBottomReserve;

      // Row Height Calculation
      // Divide available space by items, but clamp to reasonable limits
      let dynamicRowHeight = Math.floor(availableForItemRows / Math.max(1, items.length));
      // Max 256 for style, Min 20 for readability
      if (dynamicRowHeight > 256) dynamicRowHeight = 256;
      if (dynamicRowHeight < 24) dynamicRowHeight = 24;

      // Draw Header
      const cols = [
        { label: "#", w: 25, align: "center", id: "sr" },
        { label: "Item", w: 175, align: "left", id: "item" },
        { label: "HSN/SAC", w: 50, align: "center", id: "hsn" },
        { label: "Tax", w: 35, align: "center", id: "tax" },
        { label: "Qty", w: 35, align: "right", id: "qty" },
        { label: "Rate", w: 60, align: "right", id: "rate" },
        { label: "Per", w: 35, align: "center", id: "per" },
        { label: "Amount", w: 75, align: "right", id: "amount" },
      ];
      const currentSum = cols.reduce((a, b) => a + b.w, 0);
      cols[1].w += (contentWidth - currentSum); // Adjust item width

      drawRect(startX, tableTopY, contentWidth, headerHeight);
      let colX = startX;
      cols.forEach(col => {
        doc.font("Roboto-Bold").fontSize(8).text(col.label, colX, tableTopY + 5, { width: col.w, align: col.align });
        colX += col.w;
      });

      // Draw Items
      let rowY = tableTopY + headerHeight;
      items.forEach((item, index) => {
        const itemDetails = item.itemId || {};
        const quantity = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discount = parseFloat(item.discount) || 0;
        let amount = rate * quantity;
        if (item.discountType === 'percentage') { amount -= (amount * discount / 100); } else { amount -= discount; }

        const taxVal = invoice.gstRate || 0;

        doc.font("Roboto").fontSize(8);
        drawCell((index + 1).toString(), startX, rowY, cols[0].w, dynamicRowHeight, { border: [], align: "center" });
        drawCell(itemDetails.name || item.name || "Item", startX + cols[0].w, rowY, cols[1].w, dynamicRowHeight, { border: [], align: "left" });
        drawCell(item.hsn || itemDetails.hsnSac || "", startX + cols[0].w + cols[1].w, rowY, cols[2].w, dynamicRowHeight, { border: [], align: "center" });
        drawCell(`${taxVal}%`, startX + cols[0].w + cols[1].w + cols[2].w, rowY, cols[3].w, dynamicRowHeight, { border: [], align: "center" });
        drawCell(`${quantity}`, startX + cols[0].w + cols[1].w + cols[2].w + cols[3].w, rowY, cols[4].w, dynamicRowHeight, { border: [], align: "right" });
        drawCell(rate.toFixed(2), startX + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w, rowY, cols[5].w, dynamicRowHeight, { border: [], align: "right" });
        drawCell("Nos", startX + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w + cols[5].w, rowY, cols[6].w, dynamicRowHeight, { border: [], align: "center" });
        drawCell(amount.toFixed(2), startX + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w + cols[5].w + cols[6].w, rowY, cols[7].w, dynamicRowHeight, { border: [], align: "right" });

        rowY += dynamicRowHeight;
      });

      const itemsEndY = rowY;

      // Draw Vertical Lines (Global)
      // Extend from Header Bottom (tableTopY + headerHeight) to itemsEndY + summaryHeight
      // No, extend to summaryEndY. Recalculate summary end first.

      // --- SUMMARY ROWS (Taxable, Taxes) ---
      // Labels in ITEM column (index 1)
      const itemColX = startX + cols[0].w;
      const itemColW = cols[1].w;
      const amountColX = startX + contentWidth - cols[7].w;

      doc.font("Roboto-Bold").fontSize(9);
      doc.text("Taxable Amount", itemColX, rowY + 4, { width: itemColW - 4, align: "right" });
      doc.text(toCurrency(taxableAmount), amountColX, rowY + 4, { width: cols[7].w - 4, align: "right" });
      rowY += summaryRowH;

      taxRows.forEach(row => {
        doc.text(row.label, itemColX, rowY + 4, { width: itemColW - 4, align: "right" });
        doc.text(toCurrency(row.val), amountColX, rowY + 4, { width: cols[7].w - 4, align: "right" });
        rowY += summaryRowH;
      });
      const summaryEndY = rowY;

      // Draw Lines now that we know full height
      let vLineX = startX;
      doc.lineWidth(0.5).strokeColor("black");
      // Outer Left
      doc.moveTo(startX, tableTopY).lineTo(startX, summaryEndY).stroke();
      // Columns
      cols.forEach((col) => {
        vLineX += col.w;
        doc.moveTo(vLineX, tableTopY).lineTo(vLineX, summaryEndY).stroke();
      });

      // --- TOTAL ROW ---
      // Top Border
      doc.moveTo(startX, rowY).lineTo(startX + contentWidth, rowY).stroke();

      doc.font("Roboto-Bold").fontSize(10);
      doc.text("Total", startX, rowY + 5, { width: amountColX - startX - 10, align: "right" });

      let qtyX = startX;
      for (let i = 0; i < 4; i++) qtyX += cols[i].w;
      const qtyW = cols[4].w; // Qty Column

      doc.text(totalQty.toString(), qtyX, rowY + 5, { width: qtyW, align: "right" });
      doc.text(toCurrency(grandTotal), amountColX, rowY + 5, { width: cols[7].w - 4, align: "right" });
      rowY += totalRowH;

      doc.moveTo(startX, rowY).lineTo(startX + contentWidth, rowY).stroke(); // Bottom
      // Vertical Lines in Total Row
      doc.moveTo(startX, summaryEndY).lineTo(startX, rowY).stroke(); // Left
      doc.moveTo(startX + contentWidth, summaryEndY).lineTo(startX + contentWidth, rowY).stroke(); // Right
      doc.moveTo(amountColX, summaryEndY).lineTo(amountColX, rowY).stroke(); // Amount Sep
      doc.moveTo(qtyX, summaryEndY).lineTo(qtyX, rowY).stroke(); // Qty Left
      doc.moveTo(qtyX + qtyW, summaryEndY).lineTo(qtyX + qtyW, rowY).stroke(); // Qty Right

      // Words Box
      doc.rect(startX, rowY, contentWidth, wordsH).stroke();
      doc.font("Roboto-Bold").fontSize(9).text("Amount Chargeable (in words): INR " + capitalizeWords(toWords(Math.round(grandTotal))) + " Only. E & O.E", startX + 5, rowY + 6);
      rowY += wordsH;

      // --- TAX ANALYSIS TABLE ---
      let summaryY = rowY; // No gap

      if (invoice.isTaxInvoice) {
        let txY = summaryY;
        const hsnW = 80;
        const taxValW = 100;
        const centralW = 120;
        const stateW = 120;
        const totalW = contentWidth - (hsnW + taxValW + centralW + stateW);
        const r1H = 20;

        // Header
        drawCell("HSN/SAC", startX, txY, hsnW, r1H + 20, { border: ["left", "top", "bottom"], align: "center", bold: true });
        drawCell("Taxable Value", startX + hsnW, txY, taxValW, r1H + 20, { border: ["left", "top", "bottom"], align: "center", bold: true });
        drawCell("Central Tax", startX + hsnW + taxValW, txY, centralW, r1H, { border: ["left", "top", "bottom"], align: "center", bold: true });
        drawCell("State Tax", startX + hsnW + taxValW + centralW, txY, stateW, r1H, { border: ["left", "top", "bottom"], align: "center", bold: true });
        drawCell("Total Tax Amount", startX + hsnW + taxValW + centralW + stateW, txY, totalW, r1H + 20, { border: ["left", "top", "right", "bottom"], align: "center", bold: true });
        // Sub-hooks
        const subY = txY + r1H;
        const r2H = 20;
        drawCell("Rate", startX + hsnW + taxValW, subY, centralW / 2, r2H, { border: ["left", "bottom"], align: "center", bold: true });
        drawCell("Amount", startX + hsnW + taxValW + centralW / 2, subY, centralW / 2, r2H, { border: ["left", "bottom"], align: "center", bold: true });
        drawCell("Rate", startX + hsnW + taxValW + centralW, subY, stateW / 2, r2H, { border: ["left", "bottom"], align: "center", bold: true });
        drawCell("Amount", startX + hsnW + taxValW + centralW + stateW / 2, subY, stateW / 2, r2H, { border: ["left", "bottom"], align: "center", bold: true });
        txY += 40;

        // Data Row (Summary of invoice) - Assuming single summary line for simplicity or strictly one line
        const dH = 20;
        doc.font("Roboto").fontSize(8);
        drawCell(items[0]?.hsn || "Mix", startX, txY, hsnW, dH, { border: ["left", "bottom"], align: "center" });
        drawCell(taxableAmount.toFixed(2), startX + hsnW, txY, taxValW, dH, { border: ["left", "bottom"], align: "right" });
        // Tax Logic (Simplified for layout)
        if (invoice.transactionType === 'intra') {
          const rate = (invoice.gstRate || 0) / 2;
          const amt = taxableAmount * (rate / 100);
          const totAmt = amt * 2;
          drawCell(`${rate}%`, startX + hsnW + taxValW, txY, centralW / 2, dH, { border: ["left", "bottom"], align: "center" });
          drawCell(amt.toFixed(2), startX + hsnW + taxValW + centralW / 2, txY, centralW / 2, dH, { border: ["left", "bottom"], align: "right" });
          drawCell(`${rate}%`, startX + hsnW + taxValW + centralW, txY, stateW / 2, dH, { border: ["left", "bottom"], align: "center" });
          drawCell(amt.toFixed(2), startX + hsnW + taxValW + centralW + stateW / 2, txY, stateW / 2, dH, { border: ["left", "bottom"], align: "right" });
          drawCell(totAmt.toFixed(2), startX + hsnW + taxValW + centralW + stateW, txY, totalW, dH, { border: ["left", "right", "bottom"], align: "right" });
        } else {
          // Inter Logic
          drawCell("-", startX + hsnW + taxValW, txY, centralW, dH, { border: ["left", "bottom"], align: "center" });
          drawCell("-", startX + hsnW + taxValW + centralW, txY, stateW, dH, { border: ["left", "bottom"], align: "center" });
          drawCell("-", startX + hsnW + taxValW + centralW + stateW, txY, totalW, dH, { border: ["left", "right", "bottom"], align: "right" });
        }
        txY += dH;

        // Total Row for Tax Table
        const tH = 20;
        drawCell("TOTAL", startX, txY, hsnW, tH, { border: ["left", "bottom"], align: "right", bold: true });
        drawCell(taxableAmount.toFixed(2), startX + hsnW, txY, taxValW, tH, { border: ["left", "bottom"], align: "right", bold: true });
        if (invoice.transactionType === 'intra') {
          const amt = taxableAmount * ((invoice.gstRate || 0) / 200);
          const totAmt = amt * 2;
          drawCell("", startX + hsnW + taxValW, txY, centralW / 2, tH, { border: ["left", "bottom"] });
          drawCell(amt.toFixed(2), startX + hsnW + taxValW + centralW / 2, txY, centralW / 2, tH, { border: ["left", "bottom"], align: "right", bold: true });
          drawCell("", startX + hsnW + taxValW + centralW, txY, stateW / 2, tH, { border: ["left", "bottom"] });
          drawCell(amt.toFixed(2), startX + hsnW + taxValW + centralW + stateW / 2, txY, stateW / 2, tH, { border: ["left", "bottom"], align: "right", bold: true });
          drawCell(totAmt.toFixed(2), startX + hsnW + taxValW + centralW + stateW, txY, totalW, tH, { border: ["left", "right", "bottom"], align: "right", bold: true });
        } else {
          drawCell("", startX + hsnW + taxValW, txY, centralW, tH, { border: ["left", "bottom"] });
          drawCell("", startX + hsnW + taxValW + centralW, txY, stateW, tH, { border: ["left", "bottom"] });
          drawCell("", startX + hsnW + taxValW + centralW + stateW, txY, totalW, tH, { border: ["left", "right", "bottom"] });
        }
        summaryY = txY + tH;
      }

      // --- AMOUNT PAID ---
      const paidY = summaryY; // No gap
      // amountPaidH is already defined in the calculation block at top

      // Draw Side Borders for Amount Paid
      doc.moveTo(startX, paidY).lineTo(startX, paidY + amountPaidH).stroke(); // Left
      doc.moveTo(startX + contentWidth, paidY).lineTo(startX + contentWidth, paidY + amountPaidH).stroke(); // Right

      const iconR = 6;
      const rightEdge = startX + contentWidth;
      const iconX = rightEdge - 80;
      const iconY = paidY + 10;

      doc.save();
      doc.fillColor("#28a745");
      doc.path(`M ${iconX} ${iconY} m -${iconR}, 0 a ${iconR},${iconR} 0 1,0 ${iconR * 2},0 a ${iconR},${iconR} 0 1,0 -${iconR * 2},0`).fill();
      doc.strokeColor("white").lineWidth(1.5).moveTo(iconX - 3, iconY).lineTo(iconX - 1, iconY + 2).lineTo(iconX + 3, iconY - 2).stroke();
      doc.restore();

      doc.font("Roboto-Bold").fontSize(10).fillColor("black").text("Amount Paid", iconX + iconR + 4, paidY + 5, { align: "left" });
      const paidDate = formatDateDDMMYYYY(invoice.date);
      const amountPaidText = `${toCurrency(grandTotal)} Paid via UPI on ${paidDate}`;
      doc.font("Roboto-Bold").fontSize(9).text(amountPaidText, startX, paidY + 20, { width: contentWidth, align: "right" });

      summaryY = paidY + amountPaidH;

      // --- FOOTER ---
      const footerY = summaryY;

      // Draw Footer Box - We draw Top, Bottom, Left, Right
      // Since previous section provided side borders and implicitly a 'bottom' position,
      // we draw a top line here to close the 'Amount Paid' section and start Footer.
      // This serves as the separator.
      drawRect(startX, footerY, contentWidth, footerH);

      const col2X = startX + 180;
      const col3X = startX + 400;

      doc.font("Roboto-Bold").fontSize(8).fillColor("black").text("Bank Details:", startX + 5, footerY + 5);
      let bankY = footerY + 18;
      doc.font("Roboto").fontSize(8);
      const bankLabels = [
        { l: "Bank:", v: bankDetails?.bank },
        { l: "Account #:", v: bankDetails?.accountNumber },
        { l: "IFSC:", v: bankDetails?.ifscCode },
        { l: "Branch:", v: bankDetails?.branch }
      ];
      bankLabels.forEach(b => {
        doc.text(b.l, startX + 5, bankY, { width: 80 });
        doc.font("Roboto-Bold").text(b.v || "", startX + 80, bankY);
        doc.font("Roboto");
        bankY += 12;
      });
      doc.font("Roboto-Bold").text("Pay using UPI:", col2X, footerY + 5);
      doc.rect(col2X, footerY + 18, 50, 50).stroke();
      doc.text(`For ${OrgDetails?.companyName || "Company"}`, col3X, footerY + 5, { align: "center", width: 140 });
      doc.font("Roboto-Bold").fontSize(8).fillColor("black").text("SIGNATURE", col3X, footerY + 60, { align: "center", width: 140 });

      const splitterY = footerY + 80;
      doc.moveTo(startX, splitterY).lineTo(startX + contentWidth, splitterY).stroke();
      doc.moveTo(startX + contentWidth / 2, splitterY).lineTo(startX + contentWidth / 2, footerY + footerH).stroke();

      doc.font("Roboto-Bold").text("Notes:", startX + 5, splitterY + 3);
      doc.font("Roboto").fontSize(7).text("Thank you for the Business", startX + 5, splitterY + 12);
      doc.font("Roboto-Bold").fontSize(7).text("Terms and Conditions:", startX + contentWidth / 2 + 5, splitterY + 3);
      doc.font("Roboto").fontSize(6).text(
        "1. Goods once sold cannot be taken back or exchanged.\n" +
        "2. We are not the manufacturers, warranty as per term.\n" +
        "3. Interest @24% p.a. will be charged for uncleared bills.",
        startX + contentWidth / 2 + 5, splitterY + 12, { width: contentWidth / 2 - 10 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};