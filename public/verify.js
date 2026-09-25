const state = {
  credentials: [],
  currentVerification: null,
};

const statusTone = {
  VERIFIED: 'green',
  FAILED: 'red',
  REVOKED: 'amber',
  TAMPERED: 'red',
  EXPIRED: 'amber',
  UNKNOWN_ISSUER: 'slate',
  active: 'green',
  revoked: 'red',
};

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

function badge(status) {
  const tone = statusTone[status] || 'slate';
  return `<span class="vc-pill vc-pill-${tone}"><span class="vc-pill-dot"></span>${escapeHtml(status)}</span>`;
}

function verdictMeta(status) {
  if (status === 'VERIFIED') {
    return {
      cls: 'is-verified',
      icon: '✓',
      title: 'Credential verified',
      sub: 'The issuer, hash, signature, and current status all passed validation.',
    };
  }
  if (status === 'REVOKED' || status === 'EXPIRED') {
    return {
      cls: 'is-revoked',
      icon: '!',
      title: status === 'REVOKED' ? 'Credential revoked' : 'Credential expired',
      sub: status === 'REVOKED'
        ? 'This credential was issued correctly but is no longer active.'
        : 'This credential has passed its validity period.',
    };
  }
  return {
    cls: 'is-tampered',
    icon: '×',
    title: status === 'UNKNOWN_ISSUER' ? 'Issuer not recognized' : 'Credential failed verification',
    sub: status === 'UNKNOWN_ISSUER'
      ? 'The credential could not be matched to an approved issuer.'
      : 'The submitted data does not match the trusted record or signature.',
  };
}

function credentialLink(item) {
  return `
    <div class="vc-item">
      <div class="vc-item-head">
        <div>
          <div class="vc-item-title">${escapeHtml(item.payload.studentName)}</div>
          <div class="vc-muted" style="margin-top:0.2rem;">${escapeHtml(item.payload.credentialType)} • ${escapeHtml(item.payload.program)}</div>
        </div>
        ${badge(item.status)}
      </div>
      <div class="vc-meta-line">
        <span>${escapeHtml(item.id)}</span>
        <span>${escapeHtml(item.payload.institutionName)}</span>
      </div>
      <div class="vc-link-row">
        <a class="vc-text-link" href="/verify?id=${encodeURIComponent(item.id)}">Verify</a>
        ${item.pdfPath ? `<a class="vc-text-link" href="${item.pdfPath}" target="_blank">PDF</a>` : ''}
        ${item.qrPath ? `<a class="vc-text-link" href="${item.qrPath}" target="_blank">QR</a>` : ''}
      </div>
    </div>
  `;
}

function renderCredentials() {
  byId('credentialCount').textContent = state.credentials.length;
  if (!state.credentials.length) {
    byId('credentialList').innerHTML = `
      <div class="vc-empty">
        <div class="vc-empty-title">No credentials available</div>
        <div class="vc-empty-sub">Generate or issue a credential first to use the verification workflow.</div>
      </div>
    `;
    return;
  }
  byId('credentialList').innerHTML = state.credentials.map(credentialLink).join('');
}

function renderVerification(result, editedMode = false) {
  const meta = verdictMeta(result.status);
  const sourceCredential = result.credential || result.canonicalCredential;
  const payload = sourceCredential?.payload;
  const checks = Object.entries(result.checks)
    .map(([key, ok]) => `
      <div class="vc-item" style="padding:0.75rem 1rem;">
        <div class="vc-item-head" style="margin-bottom:0;">
          <div class="vc-item-title" style="font-size:0.875rem; text-transform:capitalize;">${escapeHtml(key)}</div>
          ${badge(ok ? 'VERIFIED' : 'FAILED')}
        </div>
      </div>
    `)
    .join('');

  byId('verifyResult').innerHTML = `
    <div class="vc-stack vc-animate-pop">
      <div class="vc-verdict ${meta.cls}">
        <div class="vc-verdict-icon">${meta.icon}</div>
        <div>
          <h3 class="vc-verdict-title">${meta.title}</h3>
          <p class="vc-verdict-sub">${meta.sub}</p>
        </div>
      </div>

      <div class="vc-split">
        <div class="vc-card vc-card-pad">
          <div class="vc-toolbar" style="margin-bottom:0.75rem;">
            <h3 class="vc-title-md">${editedMode ? 'Edited payload result' : escapeHtml(payload?.studentName || 'Credential details')}</h3>
            ${badge(result.status)}
          </div>
          <dl class="vc-defs">
            <div><dt>Credential ID</dt><dd>${escapeHtml(result.credentialId || sourceCredential?.id || '—')}</dd></div>
            <div><dt>Institution</dt><dd>${escapeHtml(payload?.institutionName || '—')}</dd></div>
            <div><dt>Credential</dt><dd>${escapeHtml(payload?.credentialType || '—')}</dd></div>
            <div><dt>Program</dt><dd>${escapeHtml(payload?.program || '—')}</dd></div>
            <div><dt>Trust score</dt><dd>${result.trustScore}/4</dd></div>
            <div><dt>Anchor transaction</dt><dd class="vc-hash">${escapeHtml(result.anchor?.txHash || '—')}</dd></div>
            <div><dt>Hash checked</dt><dd class="vc-hash">${escapeHtml(result.hashToCheck || sourceCredential?.hash || '—')}</dd></div>
          </dl>
          <div class="vc-link-row">
            ${sourceCredential?.pdfPath ? `<a class="vc-btn vc-btn-secondary" href="${sourceCredential.pdfPath}" target="_blank">Open PDF</a>` : ''}
            ${sourceCredential?.qrPath ? `<a class="vc-btn vc-btn-secondary" href="${sourceCredential.qrPath}" target="_blank">Open QR</a>` : ''}
          </div>
        </div>
        <div class="vc-card vc-card-pad">
          <h3 class="vc-title-md">Verification checks</h3>
          <div class="vc-panel-list" style="margin-top:0.75rem;">${checks}</div>
        </div>
      </div>
    </div>
  `;

  if (payload) byId('tamperPayload').value = JSON.stringify(payload, null, 2);
  state.currentVerification = result;
}

async function loadCredentials() {
  const credentials = await api('/api/credentials');
  state.credentials = credentials;
  renderCredentials();
}

async function verifyById(id) {
  const result = await api(`/api/verify/${encodeURIComponent(id)}`);
  byId('verifyId').value = id;
  renderVerification(result);
  return result;
}

async function bootstrap() {
  byId('verifyForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const credentialId = byId('verifyId').value.trim();
    if (!credentialId) return;
    try {
      await verifyById(credentialId);
    } catch (error) {
      byId('verifyResult').innerHTML = `<div class="vc-alert vc-alert-danger">${escapeHtml(error.message)}</div>`;
    }
  });

  byId('verifyEditedBtn').addEventListener('click', async () => {
    if (!state.currentVerification) return;
    try {
      const documentPayload = JSON.parse(byId('tamperPayload').value);
      const credentialId = state.currentVerification.credential?.id || state.currentVerification.canonicalCredential?.id;
      const result = await api('/api/verify', {
        method: 'POST',
        body: JSON.stringify({ credentialId, document: documentPayload }),
      });
      renderVerification(result, true);
    } catch (error) {
      byId('verifyResult').innerHTML = `<div class="vc-alert vc-alert-danger">${escapeHtml(error.message)}</div>`;
    }
  });

  await loadCredentials();

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) {
    try {
      await verifyById(id);
    } catch (error) {
      byId('verifyResult').innerHTML = `<div class="vc-alert vc-alert-danger">${escapeHtml(error.message)}</div>`;
    }
  }
}

bootstrap().catch((error) => {
  console.error(error);
  byId('verifyResult').innerHTML = `<div class="vc-alert vc-alert-danger">${escapeHtml(error.message)}</div>`;
});
