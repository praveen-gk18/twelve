const state = {
  issuers: [],
  credentials: [],
};

const statusTone = {
  VERIFIED: 'good',
  FAILED: 'bad',
  approved: 'good',
  suspended: 'warn',
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

function renderCounts() {
  byId('issuerCount').textContent = state.issuers.filter((issuer) => issuer.status === 'approved').length;
  byId('credentialCount').textContent = state.credentials.length;
}

function renderIssuerSelect() {
  byId('issuerSelect').innerHTML = state.issuers
    .filter((issuer) => issuer.status === 'approved')
    .map((issuer) => `<option value="${issuer.id}">${escapeHtml(issuer.name)}</option>`)
    .join('');
}

function renderIssuers() {
  byId('issuerList').innerHTML = state.issuers
    .map((issuer) => `
      <div class="list-item">
        <div class="card-header">
          <strong>${escapeHtml(issuer.name)}</strong>
          ${badge(issuer.status)}
        </div>
        <div class="meta-row">
          <span>${escapeHtml(issuer.email)}</span>
          <span>${escapeHtml(issuer.did)}</span>
        </div>
        ${issuer.status === 'approved' ? `<button class="secondary" data-suspend="${issuer.id}">Suspend</button>` : ''}
      </div>
    `)
    .join('');

  document.querySelectorAll('[data-suspend]').forEach((button) => {
    button.addEventListener('click', async () => {
      await api(`/api/issuers/${button.dataset.suspend}/suspend`, { method: 'POST', body: '{}' });
      await loadDashboard();
    });
  });
}

function credentialCard(item) {
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
        <span>${escapeHtml(item.payload.issueDate)}</span>
      </div>
      <div class="links">
        <a href="${item.verifyUrl || `/verify?id=${encodeURIComponent(item.id)}`}">Verify</a>
        ${item.pdfPath ? `<a href="${item.pdfPath}" target="_blank">PDF</a>` : ''}
        ${item.qrPath ? `<a href="${item.qrPath}" target="_blank">QR</a>` : ''}
      </div>
      ${item.status !== 'revoked' ? `<div class="links"><button class="secondary" data-revoke="${item.id}">Revoke</button></div>` : ''}
    </div>
  `;
}

function renderCredentials() {
  byId('credentialList').innerHTML = state.credentials.map(credentialCard).join('');
  document.querySelectorAll('[data-revoke]').forEach((button) => {
    button.addEventListener('click', async () => {
      await api(`/api/credentials/${button.dataset.revoke}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Revoked from issuer portal' }),
      });
      await loadDashboard();
    });
  });
}

function renderIssueResult(data) {
  const { credential } = data;
  byId('issueResult').innerHTML = `
    <div class="result-card">
      <div class="card-header">
        <h3>Credential issued: ${escapeHtml(credential.id)}</h3>
        ${badge('VERIFIED')}
      </div>
      <div class="kv"><div class="key">Student</div><div>${escapeHtml(credential.payload.studentName)}</div></div>
      <div class="kv"><div class="key">Anchor tx</div><div>${escapeHtml(credential.anchor.txHash)}</div></div>
      <div class="kv"><div class="key">Hash</div><div>${escapeHtml(credential.hash)}</div></div>
      <div class="links">
        <a href="${credential.verifyUrl}">Open verifier portal</a>
        <a href="${credential.pdfPath}" target="_blank">Download PDF</a>
        <a href="${credential.qrPath}" target="_blank">Open QR</a>
      </div>
    </div>
  `;
}

async function loadDashboard() {
  const [issuers, credentials] = await Promise.all([api('/api/issuers'), api('/api/credentials')]);
  state.issuers = issuers;
  state.credentials = credentials;
  renderCounts();
  renderIssuerSelect();
  renderIssuers();
  renderCredentials();
}

async function bootstrap() {
  byId('issuerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    byId('issuerMessage').textContent = 'Approving issuer...';
    try {
      await api('/api/issuers/approve', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      event.target.reset();
      byId('issuerMessage').textContent = 'Issuer approved.';
      await loadDashboard();
    } catch (error) {
      byId('issuerMessage').textContent = error.message;
    }
  });

  byId('credentialForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    byId('credentialMessage').textContent = 'Issuing credential...';
    try {
      const data = await api('/api/credentials/issue', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      event.target.reset();
      byId('credentialMessage').textContent = 'Credential issued successfully.';
      renderIssueResult(data);
      await loadDashboard();
    } catch (error) {
      byId('credentialMessage').textContent = error.message;
    }
  });

  await loadDashboard();
}

bootstrap().catch((error) => {
  console.error(error);
  byId('credentialMessage').textContent = error.message;
});
