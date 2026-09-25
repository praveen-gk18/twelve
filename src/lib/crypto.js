const crypto = require('crypto');

function stableStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }

  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }

  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generateIssuerKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

function signHash(hash, privateKeyPem) {
  return crypto.sign(null, Buffer.from(hash), privateKeyPem).toString('base64');
}

function verifySignature(hash, signature, publicKeyPem) {
  return crypto.verify(null, Buffer.from(hash), publicKeyPem, Buffer.from(signature, 'base64'));
}

module.exports = {
  stableStringify,
  sha256,
  generateIssuerKeys,
  signHash,
  verifySignature,
};
