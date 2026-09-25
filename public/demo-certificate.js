function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderDemoResult(data) {
  const { credential, issuer } = data;
  byId('demoResult').innerHTML = `
    <section class="card">
      <div class="card-header">
        <h2>Generated certificate</h2>
        <span class="status good">DEMO READY</span>
      </div>
      <div class="certificate-preview">
        <div class="certificate-shell">
          <div class="certificate-brand">CredShield</div>
          <h3>Verifiable Digital Credential</h3>
          <p class="certificate-subtitle">Currency-note-inspired anti-forgery demo certificate</p>

          <p class="certificate-copy">This is to certify that</p>
          <div class="certificate-name">${escapeHtml(credential.payload.studentName)}</div>
          <p class="certificate-copy">has successfully earned</p>
          <div class="certificate-award">${escapeHtml(credential.payload.credentialType)}</div>
          <div class="certificate-program">${escapeHtml(credential.payload.program)}</div>

          <div class="certificate-meta-grid">
            <div>
              <span class="meta-label">Institution</span>
              <strong>${escapeHtml(credential.payload.institutionName)}</strong>
            </div>
            <div>
              <span class="meta-label">Grade / Result</span>
              <strong>${escapeHtml(credential.payload.grade)}</strong>
            </div>
            <div>
              <span class="meta-label">Issue date</span>
              <strong>${escapeHtml(credential.payload.issueDate)}</strong>
            </div>
            <div>
              <span class="meta-label">Credential ID</span>
              <strong>${escapeHtml(credential.id)}</strong>
            </div>
          </div>

          <div class="certificate-footer-row">
            <div>
              <div class="meta-label">Issued by</div>
              <strong>${escapeHtml(issuer.name)}</strong>
              <div class="helper">Approved issuer • DID on record</div>
            </div>
            <div class="certificate-qr-wrap">
              <img src="${credential.qrPath}" alt="QR code for verification" class="certificate-qr" />
              <span class="helper">Scan to verify</span>
            </div>
          </div>
        </div>

        <div class="certificate-sidepanel">
          <h3>Generated assets</h3>
          <div class="kv"><div class="key">Anchor tx</div><div>${escapeHtml(credential.anchor.txHash)}</div></div>
          <div class="kv"><div class="key">Hash</div><div>${escapeHtml(credential.hash)}</div></div>
          <div class="kv"><div class="key">Verifier link</div><div>${escapeHtml(credential.verifyUrl)}</div></div>
          <div class="links">
            <a href="${credential.pdfPath}" target="_blank">Download PDF</a>
            <a href="${credential.qrPath}" target="_blank">Open QR</a>
            <a href="${credential.verifyUrl}" target="_blank">Open verification</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

async function bootstrap() {
  byId('demoForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    byId('demoMessage').textContent = 'Generating certificate...';

    try {
      const payload = Object.fromEntries(form.entries());
      const data = await api('/api/demo/certificate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      byId('demoMessage').textContent = 'Demo certificate generated successfully.';
      renderDemoResult(data);
    } catch (error) {
      byId('demoMessage').textContent = error.message;
    }
  });
}

bootstrap();
