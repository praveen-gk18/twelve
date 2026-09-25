const state = {
  credentials: [],
  currentVerification: null,
};

const statusTone = {
  VERIFIED: 'good',
  FAILED: 'bad',
  REVOKED: 'bad',
  TAMPERED: 'bad',
  EXPIRED: 'warn',
  UNKNOWN_ISSUER: 'warn',
  active: 'good',
  revoked: 'bad',
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
  const tone = statusTone[status] || 'warn';
  return `<span class="status ${tone}">${escapeHtml(status)}</span>`;
}

function credentialLink(item) {
  return `
    <div class="list-item">
      <div class="card-header">
        <strong>${escapeHtml(item.payload.studentName)}</strong>
        ${badge(item.status)}
      </div>
      <div>${escapeHtml(item.payload.credentialType)} • ${escapeHtml(item.payload.program)}</div>
      <div class="meta-row">
        <span>${escapeHtml(item.id)}</span>
        <span>${escapeHtml(item.payload.institutionName)}</span>
      </div>
      <div class="links">
        <a href="/verify?id=${encodeURIComponent(item.id)}">Verify</a>
        ${item.pdfPath ? `<a href="${item.pdfPath}" target="_blank">PDF</a>` : ''}
        ${item.qrPath ? `<a href="${item.qrPath}" target="_blank">QR</a>` : ''}
      </div>
    </div>
  `;
}

function renderCredentials() {
  byId('credentialCount').textContent = state.credentials.length;
  byId('credentialList').innerHTML = state.credentials.map(credentialLink).join('');
}

function renderVerification(result, editedMode = false) {
  const checks = Object.entries(result.checks)
    .map(([key, ok]) => `
      <div class="check">
        <span>${escapeHtml(key)}</span>
        ${badge(ok ? 'VERIFIED' : 'FAILED')}
      </div>
    `)
    .join('');

  byId('verifyResult').innerHTML = `
    <div class="result-card">
      <div class="result-grid">
        <div>
          <div class="card-header">
            <h3>${editedMode ? 'Edited payload result' : escapeHtml(result.credential.payload.studentName)}</h3>
            ${badge(result.status)}
          </div>
          <div class="kv"><div class="key">Credential ID</div><div>${escapeHtml(result.credentialId || result.credential.id)}</div></div>
          <div class="kv"><div class="key">Institution</div><div>${escapeHtml(result.credential?.payload?.institutionName || result.canonicalCredential?.payload?.institutionName || '—')}</div></div>
          <div class="kv"><div class="key">Credential</div><div>${escapeHtml(result.credential?.payload?.credentialType || result.canonicalCredential?.payload?.credentialType || '—')}</div></div>
          <div class="kv"><div class="key">Program</div><div>${escapeHtml(result.credential?.payload?.program || result.canonicalCredential?.payload?.program || '—')}</div></div>
          <div class="kv"><div class="key">Trust score</div><div>${result.trustScore}/4</div></div>
          <div class="kv"><div class="key">Anchor tx</div><div>${escapeHtml(result.anchor?.txHash || '—')}</div></div>
          <div class="kv"><div class="key">Hash checked</div><div>${escapeHtml(result.hashToCheck || result.credential?.hash || '—')}</div></div>
          <div class="links">
            ${result.credential?.pdfPath ? `<a href="${result.credential.pdfPath}" target="_blank">Open PDF</a>` : ''}
            ${result.credential?.qrPath ? `<a href="${result.credential.qrPath}" target="_blank">Open QR</a>` : ''}
          </div>
        </div>
        <div>
          <h3>Verification checks</h3>
          <div class="checks">${checks}</div>
        </div>
      </div>
    </div>
  `;

  const payload = result.credential?.payload || result.canonicalCredential?.payload;
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
      byId('verifyResult').innerHTML = `<p class="message">${escapeHtml(error.message)}</p>`;
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
      byId('verifyResult').innerHTML = `<p class="message">${escapeHtml(error.message)}</p>`;
    }
  });

  await loadCredentials();

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) {
    try {
      await verifyById(id);
    } catch (error) {
      byId('verifyResult').innerHTML = `<p class="message">${escapeHtml(error.message)}</p>`;
    }
  }
}

bootstrap().catch((error) => {
  console.error(error);
  byId('verifyResult').innerHTML = `<p class="message">${escapeHtml(error.message)}</p>`;
});
