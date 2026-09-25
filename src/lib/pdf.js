const fs = require('fs');
const PDFDocument = require('pdfkit');

function addLabelValue(doc, label, value, x, y) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#475569').text(label, x, y);
  doc.font('Helvetica').fontSize(13).fillColor('#0f172a').text(value || '-', x, y + 14);
}

function buildCertificatePdf({ filePath, credential, issuer, qrDataUrl }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.roundedRect(35, 35, 525, 772, 18).lineWidth(2).stroke('#1d4ed8');
    doc.roundedRect(50, 50, 495, 742, 12).lineWidth(1).stroke('#93c5fd');

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1d4ed8').text('CredShield', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(24).fillColor('#0f172a').text('Verifiable Digital Credential', { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor('#475569').text('Currency-note-inspired multi-layer anti-forgery certificate', { align: 'center' });

    doc.moveTo(90, 145).lineTo(505, 145).lineWidth(1).stroke('#cbd5e1');

    doc.font('Helvetica').fontSize(14).fillColor('#334155').text('This certifies that', 80, 175, { align: 'center', width: 430 });
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#111827').text(credential.payload.studentName, 80, 200, { align: 'center', width: 430 });
    doc.font('Helvetica').fontSize(14).fillColor('#334155').text('has successfully earned the following credential', 80, 242, { align: 'center', width: 430 });
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#1d4ed8').text(credential.payload.credentialType, 80, 268, { align: 'center', width: 430 });
    doc.font('Helvetica').fontSize(16).fillColor('#111827').text(credential.payload.program, 80, 300, { align: 'center', width: 430 });

    addLabelValue(doc, 'Institution', credential.payload.institutionName, 80, 360);
    addLabelValue(doc, 'Grade / Result', credential.payload.grade, 280, 360);
    addLabelValue(doc, 'Issue Date', credential.payload.issueDate, 80, 425);
    addLabelValue(doc, 'Expiry Date', credential.payload.expiresAt || 'No expiry', 280, 425);
    addLabelValue(doc, 'Credential ID', credential.payload.credentialId, 80, 490);
    addLabelValue(doc, 'Issuer DID', issuer.did, 80, 555);

    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, 390, 510, { fit: [120, 120] });
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Scan to verify live status', 390, 638, { width: 120, align: 'center' });

    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text(`Blockchain Anchor: ${credential.anchor.txHash}`, 80, 650, { width: 420 });
    doc.text(`Data Hash: ${credential.hash}`, 80, 675, { width: 420 });
    doc.text(`Signature: ${credential.signature.slice(0, 44)}...`, 80, 700, { width: 420 });

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(issuer.name, 80, 748);
    doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('Approved Issuer • Digital Signature on Record', 80, 764);

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

module.exports = {
  buildCertificatePdf,
};
