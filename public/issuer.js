const state = {
  issuers: [],
  credentials: [],
};

const statusTone = {
  VERIFIED: 'green',
  FAILED: 'red',
  approved: 'green',
  suspended: 'amber',
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
  if (!state.issuers.length) {
    byId('issuerList').innerHTML = `
      <div class="vc-empty">
        <div class="vc-empty-title">No issuers yet</div>
        <div class="vc-empty-sub">Approve an institution to begin issuing credentials.</div>
      </div>
    `;
    return;
  }

  byId('issuerList').innerHTML = state.issuers
    .map((issuer) => `
      <div class="vc-item">
        <div class="vc-item-head">
          <div class="vc-item-title">${escapeHtml(issuer.name)}</div>
          ${badge(issuer.status)}
        </div>
        <div class="vc-meta-line">
          <span>${escapeHtml(issuer.email)}</span>
          <span>${escapeHtml(issuer.did)}</span>
        </div>
        ${issuer.status === 'approved' ? `<div class="vc-action-row"><button class="vc-btn vc-btn-secondary vc-btn-sm" data-suspend="${issuer.id}">Suspend</button></div>` : ''}
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
        <span>${escapeHtml(item.payload.issueDate)}</span>
      </div>
      <div class="vc-link-row">
        <a class="vc-text-link" href="${item.verifyUrl || `/verify?id=${encodeURIComponent(item.id)}`}">Verify</a>
        ${item.pdfPath ? `<a class="vc-text-link" href="${item.pdfPath}" target="_blank">PDF</a>` : ''}
        ${item.qrPath ? `<a class="vc-text-link" href="${item.qrPath}" target="_blank">QR</a>` : ''}
      </div>
      ${item.status !== 'revoked' ? `<div class="vc-action-row"><button class="vc-btn vc-btn-danger vc-btn-sm" data-revoke="${item.id}">Revoke</button></div>` : ''}
    </div>
  `;
}

function renderCredentials() {
  if (!state.credentials.length) {
    byId('credentialList').innerHTML = `
      <div class="vc-empty">
        <div class="vc-empty-title">No credentials issued</div>
        <div class="vc-empty-sub">Issue a credential to see it listed here with QR and verification links.</div>
      </div>
    `;
    return;
  }

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
    <div class="vc-card vc-card-pad vc-animate-pop" style="margin-top:1rem;">
      <div class="vc-toolbar">
        <h3 class="vc-title-md">Credential issued</h3>
        ${badge('VERIFIED')}
      </div>
      <dl class="vc-defs">
        <div><dt>Credential ID</dt><dd>${escapeHtml(credential.id)}</dd></div>
        <div><dt>Student</dt><dd>${escapeHtml(credential.payload.studentName)}</dd></div>
        <div><dt>Anchor transaction</dt><dd class="vc-hash">${escapeHtml(credential.anchor.txHash)}</dd></div>
        <div><dt>Hash</dt><dd class="vc-hash">${escapeHtml(credential.hash)}</dd></div>
      </dl>
      <div class="vc-link-row">
        <a class="vc-btn vc-btn-primary" href="${credential.verifyUrl}">Open verifier portal</a>
        <a class="vc-btn vc-btn-secondary" href="${credential.pdfPath}" target="_blank">Download PDF</a>
        <a class="vc-btn vc-btn-secondary" href="${credential.qrPath}" target="_blank">Open QR</a>
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
