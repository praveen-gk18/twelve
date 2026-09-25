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
    <section class="vc-card vc-card-pad vc-stack vc-animate-pop">
      <div class="vc-toolbar">
        <h2 class="vc-title-lg">Generated certificate</h2>
        <span class="vc-pill vc-pill-green"><span class="vc-pill-dot"></span>Ready</span>
      </div>

      <div class="vc-cert-wrap">
        <div class="vc-cert">
          <div class="vc-cert-frame">
            <div class="vc-cert-header">
              <div>
                <h3 class="vc-cert-institution">${escapeHtml(credential.payload.institutionName)}</h3>
                <p class="vc-cert-tagline">Verified digital credential</p>
              </div>
              <img class="vc-seal" src="/pocket-logo-concept.png" width="72" height="72" alt="POCKET logo" />
            </div>

            <div class="vc-cert-body">
              <div class="vc-cert-eyebrow">Certificate of Achievement</div>
              <div class="vc-cert-name">${escapeHtml(credential.payload.studentName)}</div>
              <div class="vc-cert-text">
                This certifies that <b>${escapeHtml(credential.payload.studentName)}</b> has successfully earned
                <b>${escapeHtml(credential.payload.credentialType)}</b> in <b>${escapeHtml(credential.payload.program)}</b>.
              </div>
            </div>

            <div class="vc-grid-2">
              <div class="vc-note-box"><strong>Grade / Result</strong><div class="vc-muted" style="margin-top:0.3rem;">${escapeHtml(credential.payload.grade)}</div></div>
              <div class="vc-note-box"><strong>Issue date</strong><div class="vc-muted" style="margin-top:0.3rem;">${escapeHtml(credential.payload.issueDate)}</div></div>
              <div class="vc-note-box"><strong>Credential ID</strong><div class="vc-muted vc-mono" style="margin-top:0.3rem;">${escapeHtml(credential.id)}</div></div>
              <div class="vc-note-box"><strong>Issuer DID</strong><div class="vc-muted vc-mono" style="margin-top:0.3rem;">${escapeHtml(issuer.did)}</div></div>
            </div>

            <div class="vc-cert-footer">
              <img src="${credential.qrPath}" alt="QR code for verification" class="vc-cert-qr" />
              <div class="vc-min-w-0">
                <div class="vc-title-sm">Verification</div>
                <p class="vc-section-sub" style="margin-top:0.35rem;">Scan the QR code or open the verifier link to check authenticity and current status.</p>
              </div>
            </div>

            <div class="vc-cert-signatures">
              <div>
                <div class="vc-cert-signature">${escapeHtml(issuer.name)}</div>
                <div class="vc-cert-rule"></div>
                <p class="vc-cert-role">Authorized issuer</p>
              </div>
              <div style="text-align:right;">
                <div class="vc-cert-signature">POCKET Registry</div>
                <div class="vc-cert-rule"></div>
                <p class="vc-cert-role">Verification record</p>
              </div>
            </div>
          </div>
        </div>

        <div class="vc-cert-side">
          <div class="vc-card vc-card-pad">
            <h3 class="vc-title-md">Generated assets</h3>
            <dl class="vc-defs" style="margin-top:0.75rem;">
              <div><dt>Anchor tx</dt><dd class="vc-hash">${escapeHtml(credential.anchor.txHash)}</dd></div>
              <div><dt>Hash</dt><dd class="vc-hash">${escapeHtml(credential.hash)}</dd></div>
              <div><dt>Verifier link</dt><dd class="vc-hash">${escapeHtml(credential.verifyUrl)}</dd></div>
            </dl>
            <div class="vc-action-row">
              <a class="vc-btn vc-btn-primary" href="${credential.verifyUrl}" target="_blank">Open verification</a>
              <a class="vc-btn vc-btn-secondary" href="${credential.pdfPath}" target="_blank">Download PDF</a>
              <a class="vc-btn vc-btn-secondary" href="${credential.qrPath}" target="_blank">Open QR</a>
            </div>
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
      byId('demoMessage').textContent = 'Certificate generated successfully.';
      renderDemoResult(data);
    } catch (error) {
      byId('demoMessage').textContent = error.message;
    }
  });
}

bootstrap();
