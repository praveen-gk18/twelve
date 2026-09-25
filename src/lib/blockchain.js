const path = require('path');
const { readJson, writeJson } = require('./storage');
const { sha256 } = require('./crypto');

const chainFile = path.join(__dirname, '..', '..', 'data', 'mock-chain.json');

function getChain() {
  return readJson(chainFile, []);
}

function writeChain(records) {
  writeJson(chainFile, records);
}

function makeTxHash(seed) {
  return '0x' + sha256(seed + Date.now().toString() + Math.random().toString()).slice(0, 64);
}

async function anchorCredential({ credentialId, hash, issuerId, metadataURI, issuedAt, expiresAt }) {
  const chain = getChain();
  const txHash = makeTxHash(`${credentialId}:${hash}:${issuerId}`);
  const record = {
    credentialId,
    hash,
    issuerId,
    metadataURI,
    issuedAt,
    expiresAt,
    status: 'active',
    txHash,
    anchoredAt: new Date().toISOString(),
  };
  chain.push(record);
  writeChain(chain);
  return record;
}

async function revokeAnchoredCredential(credentialId, reason = 'Revoked by issuer') {
  const chain = getChain();
  const index = chain.findIndex((item) => item.credentialId === credentialId);
  if (index === -1) return null;

  chain[index] = {
    ...chain[index],
    status: 'revoked',
    revocationReason: reason,
    revokedAt: new Date().toISOString(),
    revocationTxHash: makeTxHash(`${credentialId}:${reason}`),
  };

  writeChain(chain);
  return chain[index];
}

function getAnchoredCredential(credentialId) {
  const chain = getChain();
  return chain.find((item) => item.credentialId === credentialId) || null;
}

module.exports = {
  anchorCredential,
  revokeAnchoredCredential,
  getAnchoredCredential,
};
