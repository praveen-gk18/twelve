const express = require('express');
const path = require('path');
const { randomUUID } = require('crypto');
const QRCode = require('qrcode');
const { readJson, writeJson, ensureDir } = require('./src/lib/storage');
const { stableStringify, sha256, generateIssuerKeys, signHash, verifySignature } = require('./src/lib/crypto');
const { anchorCredential, revokeAnchoredCredential, getAnchoredCredential } = require('./src/lib/blockchain');
const { buildCertificatePdf } = require('./src/lib/pdf');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const publicDir = path.join(rootDir, 'public');
const generatedQrDir = path.join(publicDir, 'generated', 'qr');
const generatedPdfDir = path.join(publicDir, 'generated', 'certificates');
const issuersFile = path.join(dataDir, 'issuers.json');
const credentialsFile = path.join(dataDir, 'credentials.json');

ensureDir(generatedQrDir);
ensureDir(generatedPdfDir);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

function getIssuers() {
  return readJson(issuersFile, []);
}

function saveIssuers(issuers) {
  writeJson(issuersFile, issuers);
}

function getCredentials() {
  return readJson(credentialsFile, []);
}

function saveCredentials(credentials) {
  writeJson(credentialsFile, credentials);
}

function buildVerifyUrl(req, credentialId) {
  return `${req.protocol}://${req.get('host')}/?view=verify&id=${encodeURIComponent(credentialId)}`;
}

function buildCredentialId(prefix = 'CSHLD') {
  const year = new Date().getFullYear();
  const short = randomUUID().split('-')[0].toUpperCase();
  return `${prefix}-${year}-${short}`;
}

function canonicalPayload(input) {
  return {
    payloadVersion: 1,
    credentialId: input.credentialId,
    issuerId: input.issuerId,
    institutionName: input.institutionName,
    studentName: input.studentName,
    studentEmail: input.studentEmail,
    studentId: input.studentId,
    credentialType: input.credentialType,
    program: input.program,
    grade: input.grade,
    issueDate: input.issueDate,
    expiresAt: input.expiresAt || null,
  };
}

function evaluateVerification({ credentialRecord, hashToCheck, issuer, anchor, signatureValid }) {
  const now = new Date();
  const isExpired = Boolean(credentialRecord.payload.expiresAt) && new Date(credentialRecord.payload.expiresAt) < now;
  const checks = {
    issuerApproved: Boolean(issuer && issuer.status === 'approved'),
    hashMatched: Boolean(anchor && anchor.hash === hashToCheck),
    signatureValid: Boolean(signatureValid),
    active: Boolean(anchor && anchor.status === 'active' && credentialRecord.status !== 'revoked' && !isExpired),
  };

  let status = 'VERIFIED';
  if (!checks.issuerApproved) status = 'UNKNOWN_ISSUER';
  else if (!checks.hashMatched || !checks.signatureValid) status = 'TAMPERED';
  else if (anchor && anchor.status === 'revoked') status = 'REVOKED';
  else if (isExpired) status = 'EXPIRED';

  const trustScore = Object.values(checks).filter(Boolean).length;

  return {
    status,
    trustScore,
    checks,
    isExpired,
  };
}

function sanitizeIssuer(issuer) {
  if (!issuer) return null;
  const { privateKey, ...safeIssuer } = issuer;
  return safeIssuer;
}

function issueDemoDataIfEmpty() {
  const issuers = getIssuers();
  const credentials = getCredentials();
  if (issuers.length || credentials.length) return;

  const keys = generateIssuerKeys();
  const demoIssuer = {
    id: randomUUID(),
    name: 'ABC University',
    email: 'registrar@abcuniversity.edu',
    did: 'did:credshield:abc-university',
    status: 'approved',
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    createdAt: new Date().toISOString(),
  };

  const payload = canonicalPayload({
    credentialId: buildCredentialId(),
    issuerId: demoIssuer.id,
    institutionName: demoIssuer.name,
    studentName: 'Arun Kumar',
    studentEmail: 'arun@example.com',
    studentId: '22CSE1042',
    credentialType: 'Bachelor of Technology',
    program: 'Computer Science and Engineering',
    grade: 'First Class with Distinction',
    issueDate: new Date().toISOString().slice(0, 10),
    expiresAt: null,
  });

  const hash = sha256(stableStringify(payload));
  const signature = signHash(hash, demoIssuer.privateKey);
  const anchor = {
    credentialId: payload.credentialId,
    hash,
    issuerId: demoIssuer.id,
    metadataURI: `local://credentials/${payload.credentialId}`,
    issuedAt: Date.now(),
    expiresAt: null,
    status: 'active',
    txHash: '0xDEMO' + hash.slice(0, 60),
    anchoredAt: new Date().toISOString(),
  };

  saveIssuers([demoIssuer]);
  saveCredentials([
    {
      id: payload.credentialId,
      payload,
      hash,
      signature,
      status: 'active',
      issuedAt: new Date().toISOString(),
      anchor,
      verifyUrl: '',
      qrPath: '',
      pdfPath: '',
      issuerSnapshot: sanitizeIssuer(demoIssuer),
    },
  ]);
  writeJson(path.join(dataDir, 'mock-chain.json'), [anchor]);
}

issueDemoDataIfEmpty();

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'CredShield', mode: 'mock-chain', time: new Date().toISOString() });
});

app.get('/api/issuers', (req, res) => {
  const issuers = getIssuers().map(sanitizeIssuer);
  res.json(issuers);
});

app.post('/api/issuers/approve', (req, res) => {
  const { name, email, did } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const issuers = getIssuers();
  const existing = issuers.find((issuer) => issuer.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    existing.status = 'approved';
    saveIssuers(issuers);
    return res.json(sanitizeIssuer(existing));
  }

  const keys = generateIssuerKeys();
  const issuer = {
    id: randomUUID(),
    name,
    email,
    did: did || `did:credshield:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    status: 'approved',
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    createdAt: new Date().toISOString(),
  };

  issuers.push(issuer);
  saveIssuers(issuers);
  res.status(201).json(sanitizeIssuer(issuer));
});

app.post('/api/issuers/:issuerId/suspend', (req, res) => {
  const issuers = getIssuers();
  const issuer = issuers.find((item) => item.id === req.params.issuerId);
  if (!issuer) return res.status(404).json({ error: 'issuer not found' });

  issuer.status = 'suspended';
  issuer.suspendedAt = new Date().toISOString();
  saveIssuers(issuers);
  res.json(sanitizeIssuer(issuer));
});

app.get('/api/credentials', (req, res) => {
  const credentials = getCredentials().map((credential) => ({
    id: credential.id,
    payload: credential.payload,
    status: credential.status,
    issuedAt: credential.issuedAt,
    verifyUrl: credential.verifyUrl,
    qrPath: credential.qrPath,
    pdfPath: credential.pdfPath,
    anchor: credential.anchor,
  }));
  res.json(credentials);
});

app.post('/api/credentials/issue', async (req, res) => {
  try {
    const {
      issuerId,
      studentName,
      studentEmail,
      studentId,
      institutionName,
      credentialType,
      program,
      grade,
      issueDate,
      expiresAt,
    } = req.body || {};

    if (!issuerId || !studentName || !studentEmail || !studentId || !credentialType || !program || !grade) {
      return res.status(400).json({ error: 'issuerId, studentName, studentEmail, studentId, credentialType, program and grade are required' });
    }

    const issuers = getIssuers();
    const issuer = issuers.find((item) => item.id === issuerId);
    if (!issuer) return res.status(404).json({ error: 'issuer not found' });
    if (issuer.status !== 'approved') return res.status(403).json({ error: 'issuer is not approved' });

    const credentialId = buildCredentialId();
    const payload = canonicalPayload({
      credentialId,
      issuerId,
      institutionName: institutionName || issuer.name,
      studentName,
      studentEmail,
      studentId,
      credentialType,
      program,
      grade,
      issueDate: issueDate || new Date().toISOString().slice(0, 10),
      expiresAt: expiresAt || null,
    });

    const hash = sha256(stableStringify(payload));
    const signature = signHash(hash, issuer.privateKey);
    const verifyUrl = buildVerifyUrl(req, credentialId);
    const qrFileName = `${credentialId}.png`;
    const pdfFileName = `${credentialId}.pdf`;
    const qrAbsPath = path.join(generatedQrDir, qrFileName);
    const pdfAbsPath = path.join(generatedPdfDir, pdfFileName);
    const qrPath = `/generated/qr/${qrFileName}`;
    const pdfPath = `/generated/certificates/${pdfFileName}`;

    await QRCode.toFile(qrAbsPath, verifyUrl, { margin: 1, width: 300, color: { dark: '#0f172a', light: '#ffffff' } });
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 300 });

    const anchor = await anchorCredential({
      credentialId,
      hash,
      issuerId,
      metadataURI: `local://credentials/${credentialId}`,
      issuedAt: Date.now(),
      expiresAt: payload.expiresAt,
    });

    const credential = {
      id: credentialId,
      payload,
      hash,
      signature,
      status: 'active',
      issuedAt: new Date().toISOString(),
      anchor,
      verifyUrl,
      qrPath,
      pdfPath,
      issuerSnapshot: sanitizeIssuer(issuer),
    };

    await buildCertificatePdf({ filePath: pdfAbsPath, credential, issuer, qrDataUrl });

    const credentials = getCredentials();
    credentials.unshift(credential);
    saveCredentials(credentials);

    res.status(201).json({
      message: 'credential issued successfully',
      credential,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'failed to issue credential', detail: error.message });
  }
});

app.post('/api/credentials/:credentialId/revoke', async (req, res) => {
  const { reason } = req.body || {};
  const credentials = getCredentials();
  const credential = credentials.find((item) => item.id === req.params.credentialId);
  if (!credential) return res.status(404).json({ error: 'credential not found' });

  credential.status = 'revoked';
  credential.revokedAt = new Date().toISOString();
  credential.revocationReason = reason || 'Revoked by issuer';
  credential.anchor = await revokeAnchoredCredential(credential.id, credential.revocationReason);
  saveCredentials(credentials);

  res.json({ message: 'credential revoked', credential });
});

app.get('/api/credentials/:credentialId', (req, res) => {
  const credential = getCredentials().find((item) => item.id === req.params.credentialId);
  if (!credential) return res.status(404).json({ error: 'credential not found' });
  res.json(credential);
});

app.get('/api/verify/:credentialId', (req, res) => {
  const credential = getCredentials().find((item) => item.id === req.params.credentialId);
  if (!credential) return res.status(404).json({ error: 'credential not found' });

  const issuers = getIssuers();
  const issuer = issuers.find((item) => item.id === credential.payload.issuerId);
  const anchor = getAnchoredCredential(credential.id);
  const recomputedHash = sha256(stableStringify(credential.payload));
  const signatureValid = issuer ? verifySignature(recomputedHash, credential.signature, issuer.publicKey) : false;
  const evaluation = evaluateVerification({
    credentialRecord: credential,
    hashToCheck: recomputedHash,
    issuer,
    anchor,
    signatureValid,
  });

  res.json({
    credentialId: credential.id,
    verificationMode: 'stored-record',
    ...evaluation,
    hashToCheck: recomputedHash,
    anchor,
    issuer: sanitizeIssuer(issuer),
    credential,
  });
});

app.post('/api/verify', (req, res) => {
  const { credentialId, document } = req.body || {};
  if (!credentialId || !document) {
    return res.status(400).json({ error: 'credentialId and document are required' });
  }

  const credential = getCredentials().find((item) => item.id === credentialId);
  if (!credential) return res.status(404).json({ error: 'credential not found' });

  const issuers = getIssuers();
  const issuer = issuers.find((item) => item.id === credential.payload.issuerId);
  const anchor = getAnchoredCredential(credential.id);
  const docPayload = canonicalPayload({
    ...credential.payload,
    ...document,
    credentialId,
    issuerId: credential.payload.issuerId,
  });
  const hashToCheck = sha256(stableStringify(docPayload));
  const signatureValid = issuer ? verifySignature(hashToCheck, credential.signature, issuer.publicKey) : false;
  const evaluation = evaluateVerification({
    credentialRecord: credential,
    hashToCheck,
    issuer,
    anchor,
    signatureValid,
  });

  res.json({
    credentialId,
    verificationMode: 'custom-document',
    document: docPayload,
    ...evaluation,
    hashToCheck,
    anchor,
    issuer: sanitizeIssuer(issuer),
    canonicalCredential: credential,
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CredShield MVP running at http://0.0.0.0:${PORT}`);
});
