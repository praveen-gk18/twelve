# CredShield

A **GitHub-ready prototype** for a verifiable digital certificate network inspired by **Indian currency-note anti-counterfeit design**.

## Core concept

CredShield is split into **two dedicated portals**:

1. **Issuer Portal** — for institutions to approve issuers, issue credentials, generate QR codes and PDFs, anchor proof records, and revoke credentials.
2. **Verifier Portal** — for employers, universities, and HR teams to instantly verify a credential using its ID or QR link.

## What makes this different

Instead of just saying “we put certificates on blockchain,” CredShield uses a **3-layer trust model**:

1. **Visible trust** — QR code, credential ID, institution details, PDF certificate
2. **Cryptographic trust** — SHA-256 hash, Ed25519 issuer signature, blockchain anchor record
3. **Authority trust** — approved issuer registry, live verification status, revocation and expiry checks

## What is included in this repo

### Issuer Portal
- Approve or suspend issuers
- Issue a credential for a student or professional
- Generate:
  - credential hash
  - digital signature
  - mock blockchain anchor transaction
  - QR code
  - PDF certificate
- Revoke credentials

### Verifier Portal
- Verify a credential instantly
- Show trust score out of 4
- Check:
  - issuer approval
  - hash match
  - signature validity
  - active/revoked/expired state
- Simulate tampering by editing the credential payload

### Solidity contracts
- `contracts/InstitutionRegistry.sol`
- `contracts/CredentialRegistry.sol`
- Hardhat deploy script for Polygon Amoy / local EVM

## Repo structure

```text
credshield/
├── contracts/               # Solidity + Hardhat
├── data/                    # Local JSON data for mock mode
├── public/                  # Frontend pages + generated files
│   ├── index.html           # Home page
│   ├── issuer.html          # Issuer portal
│   ├── verify.html          # Verifier portal
│   ├── issuer.js
│   ├── verify.js
│   └── styles.css
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

- `http://localhost:3000/` — home
- `http://localhost:3000/issuer` — issuer portal
- `http://localhost:3000/verify` — verifier portal

Or use the live preview URL when running in a cloud sandbox.

## Default demo data

If the data folder is empty, the app seeds:
- **ABC University** as an approved issuer
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

## Example walkthrough

1. Open `/issuer`
2. Approve an issuer or use seeded `ABC University`
3. Issue a new credential
4. Open the generated PDF and QR
5. Move to `/verify` or click the verify link
6. Show `Trust score: 4/4`
7. Edit the grade or program in the tamper tester
8. Re-run verification and show `TAMPERED`

## Mock-chain vs real chain

The running app uses a local **mock blockchain anchor** so the workflow works instantly without wallet setup.

The real EVM smart contracts are included in `/contracts` for deployment to Polygon Amoy or any EVM network.

## Push to GitHub

If you want to publish this repo to your GitHub account:

```bash
git remote add origin https://github.com/YOUR-USERNAME/credshield.git
git branch -M main
git push -u origin main
```

If your local branch is still `master`, this command renames it to `main` before the first push.

## Deploy on Render

This repo now includes:
- `render.yaml`
- `.nvmrc`
- Node engine in `package.json`

### Render steps
1. Push this repo to GitHub.
2. Sign in to Render.
3. Click **New +** → **Blueprint** or **Web Service**.
4. Connect your GitHub repo.
5. Render should detect:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Deploy.
7. Use `/api/health` as the health check path if Render asks.

### Important deployment note
This app uses local JSON files under `data/` and generated QR/PDF files under `public/generated/`.
That is perfect for a **demo**, but on a cloud restart or redeploy, data may reset unless you add persistent storage or a real database/object store.

For a more durable deployment later, replace local storage with:
- PostgreSQL / MongoDB for records
- S3 / Cloudinary / object storage for generated files
- real blockchain contract calls for the anchor layer

## Suggested next upgrades

- Replace mock-chain storage with live contract calls
- Add wallet-based issuer authentication
- Add CSV bulk issuance
- Add IPFS metadata storage
- Add DID / Verifiable Credentials compliance
- Add camera-based QR scanning
- Add downloadable verification report
