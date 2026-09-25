# CredShield MVP

A **GitHub-ready hackathon prototype** for a verifiable digital certificate network inspired by **Indian currency-note anti-counterfeit design**.

## What makes this different

Instead of saying “we put certificates on blockchain,” CredShield uses a **3-layer trust model**:

1. **Visible trust** — QR code, credential ID, institution details, PDF certificate
2. **Cryptographic trust** — SHA-256 hash, Ed25519 issuer signature, blockchain anchor record
3. **Authority trust** — approved issuer registry, live verification status, revocation and expiry checks

## What is included in this repo

### Working MVP app
- Admin can approve or suspend issuers
- Issuer can issue credentials
- System generates:
  - credential hash
  - digital signature
  - mock blockchain anchor transaction
  - QR code
  - PDF certificate
- Verifier can:
  - check live status
  - see trust score out of 4
  - simulate tampering by editing the credential payload

### Solidity contracts
- `contracts/InstitutionRegistry.sol`
- `contracts/CredentialRegistry.sol`
- Hardhat deploy script for Polygon Amoy / local EVM

## Repo structure

```text
credshield/
├── contracts/               # Solidity + Hardhat
├── data/                    # Local JSON data for mock mode
├── public/                  # Frontend + generated files
├── src/lib/                 # Crypto, storage, PDF, mock-chain helpers
├── server.js                # Express API + static app server
├── package.json
└── README.md
```

## Quick start

```bash
npm install
npm start
```

Open:

- `http://localhost:3000` locally
- or the live preview URL when run in a cloud sandbox

## Default demo data

The app seeds one sample approved issuer if the data folder is empty:
- **ABC University**
- one sample credential for **Arun Kumar**

## API summary

- `GET /api/issuers`
- `POST /api/issuers/approve`
- `POST /api/issuers/:issuerId/suspend`
- `GET /api/credentials`
- `POST /api/credentials/issue`
- `POST /api/credentials/:credentialId/revoke`
- `GET /api/verify/:credentialId`
- `POST /api/verify` for tamper testing with a custom payload

## Demo flow for judges

1. Open the app
2. Show trust model
3. Approve an issuer or use seeded `ABC University`
4. Issue a new credential
5. Open PDF + QR
6. Verify the credential and show `Trust score: 4/4`
7. Edit the grade in the tamper tester
8. Re-run verify and show `TAMPERED`

## Mock-chain vs real chain

The running MVP uses a local **mock blockchain anchor** so the demo works instantly.

The real EVM smart contracts are included in `/contracts` for deployment to Polygon Amoy or any EVM network.

## Push to GitHub

If you want to publish this repo to your GitHub account:

```bash
git init
git add .
git commit -m "Initial CredShield MVP"
git remote add origin https://github.com/YOUR-USERNAME/credshield.git
git branch -M main
git push -u origin main
```

## Suggested next upgrades

- Replace mock-chain storage with live contract calls
- Add wallet-based issuer authentication
- Add CSV bulk issuance
- Add IPFS metadata storage
- Add DID / Verifiable Credentials compliance
- Add downloadable verification report
