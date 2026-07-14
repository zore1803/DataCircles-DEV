const PDFDocument = require("pdfkit");
const { toWords } = require("number-to-words");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

// ==========================================
// UNCHANGED HELPER FUNCTIONS
// ==========================================
function toCurrency(value) {
  return `Rs ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function capitalizeWords(str) {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function calculateItemAmount(item) {
  const rate = parseFloat(item.rate) || 0;
  const quantity = parseInt(item.quantity) || 0;
  const subtotal = rate * quantity;
  const discount = parseFloat(item.discount) || 0;
  if (item.discountType === "percentage") {
    return subtotal * (1 - discount / 100);
  }
  return subtotal - discount;
}

function getItemDiscount(item) {
  const subtotal = (item.rate || 0) * (item.quantity || 0);
  const discount = item.discount || 0;
  if (item.discountType === "percentage") {
    return (subtotal * discount) / 100;
  }
  return discount;
}

function getInvoiceDiscount(subtotal, discount) {
  if (!discount || discount.value <= 0) return 0;
  if (discount.type === "percentage") {
    return (subtotal * discount.value) / 100;
  }
  return discount.value;
}

function formatDateDDMMYYYY(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day} ${date.toLocaleString("default", { month: "short" })} ${year}`;
}

// ==========================================
// DOCUMENT TYPE & LABELS
// ==========================================
function getDocumentType(invoice) {
  if (invoice.deliveryChallanNumber?.startsWith("DC")) {
    return "DELIVERY_CHALLAN";
  } else if (invoice.quotationNumber?.startsWith("QUO")) {
    return "QUOTATION";
  } else if (invoice.performaInvoiceNumber?.startsWith("PI")) {
    return "PROFORMA_INVOICE";
  } else if (invoice.isTaxInvoice) {
    return "TAX_INVOICE";
  } else {
    return "INVOICE";
  }
}

function getDocumentLabels(docType) {
  const labels = {
    DELIVERY_CHALLAN: {
      title: "DELIVERY CHALLAN",
      numberLabel: "Delivery Challan #:",
      dateLabel: "Challan Date:",
      dueDateLabel: "Delivery by:",
    },
    QUOTATION: {
      title: "QUOTATION",
      numberLabel: "Quotation #:",
      dateLabel: "Quotation Date:",
      dueDateLabel: "Validity:",
    },
    PROFORMA_INVOICE: {
      title: "PROFORMA INVOICE",
      numberLabel: "Proforma #:",
      dateLabel: "Date:",
      dueDateLabel: "Due Date:",
    },
    TAX_INVOICE: {
      title: "TAX INVOICE",
      numberLabel: "Invoice #:",
      dateLabel: "Invoice Date:",
      dueDateLabel: "Due Date:",
    },
    INVOICE: {
      title: "INVOICE",
      numberLabel: "Invoice #:",
      dateLabel: "Invoice Date:",
      dueDateLabel: "Due Date:",
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

// ==========================================
// MAIN GENERATION FUNCTION
// ==========================================
module.exports = async function generatePdf(invoice, bankDetails, OrgDetails) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, bufferPages: true, size: "A4" });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // Fonts
      const fontDir = path.join(__dirname, "fonts");
      // Assuming standard fonts are available if custom fonts fail, but keeping consistent with existing code
      // If MeieScript is critical for signature, ensure it's loaded
      const meieFontPath = path.join(fontDir, "MeieScript-Regular.ttf");
      if (fs.existsSync(meieFontPath)) {
        doc.registerFont("MeieScript", meieFontPath);
      }

      // NOTE: Using standard PDFKit fonts (Helvetica) which look very clean and professional
      const fonts = {
        bold: "Helvetica-Bold",
        regular: "Helvetica",
        italic: "Helvetica-Oblique",
        signature: "MeieScript",
      };

      const colors = {
        primary: "#000000",   // Black text for most strict details
        secondary: "#444444", // Slightly lighter for labels
        accent: "#0056b3",    // Blue for "TAX INVOICE" header title (optional, can be black)
        border: "#e0e0e0",    // Light grey for borders
        headerBg: "#ffffff",  // White background for headers in this style
      };

      const contact = invoice?.deal?.contact || {};
      const company = invoice?.deal?.company || {};

      const docType = getDocumentType(invoice);
      const labels = getDocumentLabels(docType);
      const documentNumber = getDocumentNumber(invoice);

      let currentPage = 1;

      // ==========================================
      // COMPONENT: HEADER
      // ==========================================
      function addHeader() {
        let y = 40;

        // --- LEFT: COMPANY INFO ---
        const logoX = 40;

        // Company Name
        doc.font(fonts.bold).fontSize(14).fillColor(colors.primary)
          .text(OrgDetails?.companyName || "Your Company Name", logoX, y);

        y += 18;

        // GSTIN
        if (OrgDetails?.gstin) {
          doc.font(fonts.bold).fontSize(9).text(`GSTIN ${OrgDetails.gstin}`, logoX, y);
          y += 12;
        }

        // Address & Contact
        doc.font(fonts.regular).fontSize(9).fillColor(colors.secondary);
        const address = OrgDetails?.address || "";
        doc.text(address, logoX, y, { width: 300, lineGap: 2 });
        y += doc.heightOfString(address, { width: 300 }) + 4;

        if (OrgDetails?.mobile) {
          doc.text(`Mobile: ${OrgDetails.mobile}`, logoX, y);
          y += 12;
        }
        if (OrgDetails?.email) {
          doc.text(`Email: ${OrgDetails.email}`, logoX, y);
          y += 12;
        }
        if (OrgDetails?.website) {
          doc.text(`Website: ${OrgDetails.website}`, logoX, y);
        }

        // --- RIGHT: INVOICE TITLE & NUMBER ---
        const rightX = 350;
        let rightY = 40;

        doc.font(fonts.bold).fontSize(16).fillColor(colors.accent)
          .text(labels.title, rightX, rightY, { align: "right", width: 200 });

        rightY += 20;
        doc.font(fonts.regular).fontSize(9).fillColor(colors.secondary)
          .text(`Invoice #: ${documentNumber}`, rightX, rightY, { align: "right", width: 200 });
      }

      // ==========================================
      // COMPONENT: BILL TO & INFO GRID
      // ==========================================
      function addBillToSection(startY) {
        const leftX = 40;
        const rightX = 300; // Invoice Details Column
        let y = startY;

        // "Bill To:" Header
        doc.font(fonts.bold).fontSize(9).fillColor(colors.primary)
          .text("Bill To:", leftX, y);

        // Invoice Details Headers on Right
        doc.text(labels.dateLabel, rightX + 80, y, { width: 80, align: "left" });
        doc.text(formatDateDDMMYYYY(invoice?.date || new Date()), rightX + 170, y, { width: 100, align: "right" });

        y += 15;

        // Client Name
        const clientName = company.name || contact.name || "Client Name";
        doc.font(fonts.bold).fontSize(9).text(clientName, leftX, y);

        // Due Date
        doc.text(labels.dueDateLabel, rightX + 80, y, { width: 80, align: "left" });
        doc.text(invoice?.dueDate ? formatDateDDMMYYYY(invoice.dueDate) : "N/A", rightX + 170, y, { width: 100, align: "right" });

        y += 14;

        // Client GSTIN
        const clientGstin = company.gstin || contact.gstin;
        if (clientGstin) {
          doc.font(fonts.bold).text(`GSTIN: ${clientGstin}`, leftX, y);
        }

        // Place of Supply
        doc.font(fonts.regular).text("Place of Supply:", rightX + 80, y, { width: 80, align: "left" });
        doc.text(invoice?.placeOfSupply || "State-Code", rightX + 170, y, { width: 100, align: "right" });

        y += 14;

        // Client Address
        doc.font(fonts.regular).fillColor(colors.secondary);
        const clientAddr = contact.address || company.address || "Client Address";
        doc.text(clientAddr, leftX, y, { width: 220 });

        if (contact.email) {
          y += doc.heightOfString(clientAddr, { width: 220 }) + 5;
          doc.text(contact.email, leftX, y);
        }

        return Math.max(y + 20, startY + 60);
      }

      // ==========================================
      // COMPONENT: TABLE HEADER
      // ==========================================
      function addTableHeader(y) {
        const headerHeight = 20;

        doc.moveTo(40, y).lineTo(555, y).strokeColor(colors.primary).lineWidth(1).stroke();

        doc.font(fonts.bold).fontSize(9).fillColor(colors.primary);

        const cols = [
          { text: "#", x: 40, width: 30, align: "left" },
          { text: "Item", x: 70, width: 180, align: "left" },
          { text: "Rate / Item", x: 260, width: 90, align: "right" },
          { text: "Qty", x: 360, width: 60, align: "right" },
          { text: "Amount", x: 440, width: 115, align: "right" }
        ];

        cols.forEach(col => {
          doc.text(col.text, col.x, y + 6, { width: col.width, align: col.align });
        });

        doc.moveTo(40, y + headerHeight).lineTo(555, y + headerHeight).strokeColor(colors.primary).lineWidth(1).stroke();

        return y + headerHeight + 5;
      }

      // ==========================================
      // START BUILDING (Logic Flow)
      // ==========================================
      addHeader();

      let currentY = 135;
      currentY = addBillToSection(currentY);

      let tableY = currentY + 15;
      tableY = addTableHeader(tableY);

      let subtotal = 0;
      let totalItemDiscounts = 0;

      (invoice?.items || []).forEach((item, index) => {
        if (tableY > doc.page.height - 100) {
          doc.addPage();
          addHeader();
          tableY = 135 + 20;
          tableY = addTableHeader(tableY);
        }

        const itemDetails = item.itemId || {};
        const itemSubtotal = (item.rate || 0) * (item.quantity || 0);
        const itemDiscount = getItemDiscount(item);
        const itemAmount = calculateItemAmount(item);
        subtotal += itemSubtotal;
        totalItemDiscounts += itemDiscount;

        doc.font(fonts.bold).fontSize(9).fillColor(colors.primary);
        doc.text(index + 1, 40, tableY, { width: 30, align: "left" });
        doc.text(itemDetails.name || item.name || "Item", 70, tableY, { width: 180 });

        doc.font(fonts.regular);
        doc.text(toCurrency(item.rate || 0).replace("Rs ", ""), 260, tableY, { width: 90, align: "right" });
        doc.text(item.quantity || 0, 360, tableY, { width: 60, align: "right" });
        doc.text(toCurrency(itemAmount).replace("Rs ", ""), 440, tableY, { width: 115, align: "right" });

        doc.moveTo(40, tableY + 14).lineTo(555, tableY + 14).strokeColor("#f0f0f0").lineWidth(0.5).stroke();

        tableY += 18;
      });

      doc.moveTo(40, tableY).lineTo(555, tableY).strokeColor(colors.primary).lineWidth(1).stroke();
      tableY += 20;

      // ==========================================
      // FOOTER SECTION: BANKS & TOTALS
      // ==========================================
      if (tableY > doc.page.height - 250) {
        doc.addPage();
        addHeader();
        tableY = 150;
      }

      // --- LEFT: BANK DETAILS ---
      const bankX = 40;
      let bankY = tableY;

      doc.font(fonts.bold).fontSize(9).text("Bank Details:", bankX, bankY);
      bankY += 14;

      doc.font(fonts.regular).fontSize(9).fillColor(colors.secondary);
      const bankLabels = [
        { span: "Bank:", val: bankDetails?.bank },
        { span: "Account #:", val: bankDetails?.accountNumber },
        { span: "IFSC:", val: bankDetails?.ifscCode },
        { span: "Branch:", val: bankDetails?.branch },
      ];

      bankLabels.forEach(b => {
        if (b.val) {
          doc.text(`${b.span}`, bankX, bankY, { continued: true });
          doc.font(fonts.bold).text(` ${b.val}`);
          doc.font(fonts.regular);
          bankY += 12;
        }
      });

      bankY += 10;
      doc.font(fonts.bold).text("Pay using UPI:", bankX, bankY);
      doc.rect(bankX, bankY + 20, 50, 50).strokeColor(colors.border).stroke();


      // --- RIGHT: TOTALS CALCULATION ---
      const totalsX = 350;
      const totalsValX = 460;
      let totalsY = tableY;

      const subtotalAfterItem = subtotal - totalItemDiscounts;
      const invoiceDisc = getInvoiceDiscount(subtotalAfterItem, invoice?.discount);
      const netTaxable = subtotalAfterItem - invoiceDisc;

      function addTotalRow(label, value, isBold = false) {
        doc.font(isBold ? fonts.bold : fonts.regular).fontSize(9).fillColor(colors.primary)
          .text(label, totalsX, totalsY, { width: 100, align: "right" });
        doc.text(value, totalsValX, totalsY, { width: 95, align: "right" });
        totalsY += 16;
      }

      addTotalRow("Taxable Amount", toCurrency(netTaxable));

      let totalTax = 0;
      if (invoice?.isTaxInvoice && invoice?.gstRate > 0) {
        if (invoice.transactionType === "intra") {
          const halfRate = invoice.gstRate / 2;
          const taxAmt = netTaxable * (halfRate / 100);
          totalTax = taxAmt * 2;
          addTotalRow(`CGST ${halfRate}%`, toCurrency(taxAmt));
          addTotalRow(`SGST ${halfRate}%`, toCurrency(taxAmt));
        } else {
          const igstAmount = netTaxable * (invoice.gstRate / 100);
          totalTax = igstAmount;
          addTotalRow(`IGST ${invoice.gstRate}%`, toCurrency(igstAmount));
        }
      }

      doc.moveTo(totalsX + 20, totalsY).lineTo(555, totalsY).strokeColor(colors.primary).lineWidth(1).stroke();
      totalsY += 5;

      doc.rect(totalsX + 20, totalsY - 2, 200, 20).fillColor("#f1f5f9").fill();
      doc.font(fonts.bold).fontSize(10).fillColor(colors.primary);
      const grandTotal = netTaxable + totalTax;
      doc.text("Total", totalsX + 30, totalsY + 3);
      doc.text(toCurrency(grandTotal), totalsValX, totalsY + 3, { width: 95, align: "right" });
      totalsY += 25;

      doc.font(fonts.regular).fontSize(9).fillColor(colors.secondary);
      doc.text("Amount Payable:", totalsX, totalsY, { width: 100, align: "right" });
      doc.text(toCurrency(grandTotal), totalsValX, totalsY, { width: 95, align: "right" });
      totalsY += 16;

      // --- BOTTOM: WORDS & TERMS ---
      let bottomY = Math.max(bankY + 80, totalsY + 20);

      doc.moveTo(40, bottomY).lineTo(555, bottomY).strokeColor(colors.border).lineWidth(1).stroke();
      bottomY += 10;

      doc.font(fonts.regular).fontSize(9).text("Total amount (in words):", 40, bottomY, { continued: true });
      const words = capitalizeWords(toWords(Math.round(grandTotal)));
      doc.font(fonts.bold).text(` INR ${words} Only.`);
      bottomY += 20;

      doc.font(fonts.bold).fontSize(9).text("Notes:", 40, bottomY);
      doc.font(fonts.regular).fontSize(8).text("Thank you for the Business!", 40, bottomY + 12);
      bottomY += 30;

      doc.font(fonts.bold).text("Terms and Conditions:", 40, bottomY);
      bottomY += 12;
      const terms = [
        "1. All invoices are payable within 15 days from the date of invoice.",
        "2. Late payments penalty of 2.5% interest per day on outstanding balance.",
        "3. Goods once sold cannot be returned.",
        "4. Subject to local jurisdiction."
      ];
      doc.font(fonts.regular).fontSize(7).fillColor(colors.secondary);
      terms.forEach(t => {
        doc.text(t, 40, bottomY);
        bottomY += 10;
      });

      // --- SIGNATURE SECTION ---
      const signY = bottomY + 20;
      if (signY + 60 > doc.page.height - 50) {
        doc.addPage();
        addHeader();
      }

      doc.moveTo(40, signY + 40).lineTo(180, signY + 40).strokeColor(colors.primary).lineWidth(1).stroke();
      doc.font(fonts.bold).fontSize(9).fillColor(colors.primary).text("Receiver's Signature", 40, signY + 45);

      const authSignX = 380;
      const authSignWidth = 175;

      doc.font(fonts.bold).text("For " + (OrgDetails?.companyName || "Company"), authSignX, signY, { align: "right", width: authSignWidth });

      const signatureValue = invoice?.signature || OrgDetails?.signatureUrl || OrgDetails?.signature;
      let signatureBottom = signY + 40;

      if (signatureValue) {
        const isBase64 = typeof signatureValue === "string" && signatureValue.startsWith("data:image");
        const isFile = typeof signatureValue === "string" && signatureValue.startsWith("/uploads/");
        const isUrl = typeof signatureValue === "string" && (signatureValue.startsWith("http://") || signatureValue.startsWith("https://"));

        try {
          let imgBuffer;
          if (isBase64) {
            const parts = signatureValue.split(",");
            if (parts.length >= 2) imgBuffer = Buffer.from(parts[1], "base64");
          } else if (isFile) {
            const fullPath = path.join(__dirname, "..", signatureValue);
            if (fs.existsSync(fullPath)) imgBuffer = fs.readFileSync(fullPath);
          } else if (isUrl) {
            try {
              const response = await axios.get(signatureValue, { responseType: 'arraybuffer' });
              imgBuffer = Buffer.from(response.data);
            } catch (err) {
              // Ignore URL fetch failure
            }
          }

          if (imgBuffer) {
            doc.image(imgBuffer, authSignX + 40, signY + 10, { fit: [100, 30], align: "center" });
          } else if (!isBase64 && !isFile && !isUrl) {
            if (doc._fontFamilies["MeieScript"]) {
              doc.font("MeieScript").fontSize(14).text(signatureValue, authSignX, signY + 15, { align: "right", width: authSignWidth });
            } else {
              doc.font("Helvetica-Oblique").fontSize(10).text(signatureValue, authSignX, signY + 25, { align: "right", width: authSignWidth });
            }
          }
        } catch (e) {
          console.error("Signature error:", e.message);
        }
      }

      doc.moveTo(authSignX, signatureBottom).lineTo(authSignX + authSignWidth, signatureBottom).strokeColor(colors.primary).lineWidth(1).stroke();
      doc.font(fonts.bold).fontSize(9).text("Authorized Signatory", authSignX, signatureBottom + 5, { align: "right", width: authSignWidth });

      // ==========================================
      // FINAL PASS: ADD FOOTERS TO ALL PAGES
      // ==========================================
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);

        // Save original margins
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // Allow writing at the very bottom

        const footerY = doc.page.height - 30;

        doc.moveTo(40, footerY - 10).lineTo(555, footerY - 10).strokeColor(colors.border).lineWidth(0.5).stroke();
        doc.font(fonts.regular).fontSize(8).fillColor(colors.secondary);
        doc.text(`Page ${i + 1} of ${range.count}`, 40, footerY);
        doc.text("This is a digitally signed document", 40, footerY, { align: "right", width: 515 });

        // Restore margins
        doc.page.margins.bottom = oldBottomMargin;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};