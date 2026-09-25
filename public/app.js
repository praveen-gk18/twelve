const state = {
  issuers: [],
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
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function setActiveView(view) {
  document.querySelectorAll('.view').forEach((node) => node.classList.remove('active'));
  document.querySelectorAll('.tab').forEach((node) => node.classList.remove('active'));
  byId(`view-${view}`).classList.add('active');
  document.querySelector(`.tab[data-view="${view}"]`).classList.add('active');
}

function badge(status) {
  const tone = statusTone[status] || 'warn';
  return `<span class="status ${tone}">${escapeHtml(status)}</span>`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderIssuers() {
  byId('issuerCount').textContent = state.issuers.filter((item) => item.status === 'approved').length;
  byId('issuerSelect').innerHTML = state.issuers
    .filter((item) => item.status === 'approved')
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
    .join('');

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
    button.onclick = async () => {
      await api(`/api/issuers/${button.dataset.suspend}/suspend`, { method: 'POST', body: '{}' });
      await loadDashboard();
    };
  });
}

function renderCredentials() {
  byId('credentialCount').textContent = state.credentials.length;
  byId('credentialList').innerHTML = state.credentials
    .map((item) => `
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
          <a href="${item.verifyUrl || `/?view=verify&id=${encodeURIComponent(item.id)}`}">Verify</a>
          ${item.pdfPath ? `<a href="${item.pdfPath}" target="_blank">PDF</a>` : ''}
          ${item.qrPath ? `<a href="${item.qrPath}" target="_blank">QR</a>` : ''}
        </div>
      </div>
    `)
    .join('');
}

function renderVerification(result) {
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
            <h3>${escapeHtml(result.credential.payload.studentName)}</h3>
            ${badge(result.status)}
          </div>
          <div class="kv"><div class="key">Credential ID</div><div>${escapeHtml(result.credential.id)}</div></div>
          <div class="kv"><div class="key">Institution</div><div>${escapeHtml(result.credential.payload.institutionName)}</div></div>
          <div class="kv"><div class="key">Credential</div><div>${escapeHtml(result.credential.payload.credentialType)}</div></div>
          <div class="kv"><div class="key">Program</div><div>${escapeHtml(result.credential.payload.program)}</div></div>
          <div class="kv"><div class="key">Grade</div><div>${escapeHtml(result.credential.payload.grade)}</div></div>
          <div class="kv"><div class="key">Anchor tx</div><div>${escapeHtml(result.anchor?.txHash || '—')}</div></div>
          <div class="links">
            ${result.credential.pdfPath ? `<a href="${result.credential.pdfPath}" target="_blank">Open PDF</a>` : ''}
            ${result.credential.qrPath ? `<a href="${result.credential.qrPath}" target="_blank">Open QR</a>` : ''}
          </div>
        </div>
        <div>
          <h3>Trust score: ${result.trustScore}/4</h3>
          <div class="checks">${checks}</div>
        </div>
      </div>
    </div>
  `;

  byId('tamperPayload').value = JSON.stringify(result.credential.payload, null, 2);
  state.currentVerification = result;
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
        <a href="${credential.verifyUrl}">Verify now</a>
        <a href="${credential.pdfPath}" target="_blank">Download PDF</a>
        <a href="${credential.qrPath}" target="_blank">Open QR</a>
      </div>
      <div class="links">
        <button class="secondary" data-revoke="${credential.id}">Revoke credential</button>
      </div>
    </div>
  `;

  document.querySelector('[data-revoke]')?.addEventListener('click', async () => {
    await api(`/api/credentials/${credential.id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Revoked from demo UI' }),
    });
    byId('credentialMessage').textContent = 'Credential revoked.';
    await loadDashboard();
  });
}

async function loadDashboard() {
  const [issuers, credentials] = await Promise.all([api('/api/issuers'), api('/api/credentials')]);
  state.issuers = issuers;
  state.credentials = credentials;
  renderIssuers();
  renderCredentials();
}

async function bootstrap() {
  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => setActiveView(button.dataset.view));
  });

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
      byId('credentialMessage').textContent = 'Credential issued successfully.';
      renderIssueResult(data);
      event.target.reset();
      await loadDashboard();
    } catch (error) {
      byId('credentialMessage').textContent = error.message;
    }
  });

  byId('verifyForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const credentialId = byId('verifyId').value.trim();
    if (!credentialId) return;
    try {
      const result = await api(`/api/verify/${encodeURIComponent(credentialId)}`);
      renderVerification(result);
    } catch (error) {
      byId('verifyResult').innerHTML = `<p class="message">${escapeHtml(error.message)}</p>`;
    }
  });

  byId('verifyEditedBtn').addEventListener('click', async () => {
    if (!state.currentVerification) return;
    try {
      const documentPayload = JSON.parse(byId('tamperPayload').value);
      const result = await api('/api/verify', {
        method: 'POST',
        body: JSON.stringify({
          credentialId: state.currentVerification.credential.id,
          document: documentPayload,
        }),
      });
      byId('verifyResult').innerHTML = `
        <div class="result-card">
          <div class="card-header">
            <h3>Edited payload check</h3>
            ${badge(result.status)}
          </div>
          <div class="kv"><div class="key">Trust score</div><div>${result.trustScore}/4</div></div>
          <div class="kv"><div class="key">Computed hash</div><div>${escapeHtml(result.hashToCheck)}</div></div>
          <div class="kv"><div class="key">Anchor hash</div><div>${escapeHtml(result.anchor?.hash || '—')}</div></div>
          <div class="checks">
            ${Object.entries(result.checks)
              .map(([key, ok]) => `<div class="check"><span>${escapeHtml(key)}</span>${badge(ok ? 'VERIFIED' : 'FAILED')}</div>`)
              .join('')}
          </div>
        </div>
      `;
    } catch (error) {
      byId('verifyResult').innerHTML = `<p class="message">${escapeHtml(error.message)}</p>`;
    }
  });

  await loadDashboard();

  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const credentialId = params.get('id');
  if (view && ['overview', 'admin', 'issue', 'verify'].includes(view)) {
    setActiveView(view);
  }
  if (credentialId) {
    byId('verifyId').value = credentialId;
    setActiveView('verify');
    const result = await api(`/api/verify/${encodeURIComponent(credentialId)}`);
    renderVerification(result);
  }
}

bootstrap().catch((error) => {
  console.error(error);
  byId('verifyResult').innerHTML = `<p class="message">Failed to boot app: ${escapeHtml(error.message)}</p>`;
});
