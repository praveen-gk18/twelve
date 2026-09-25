# CredShield Contracts

These are the Solidity contracts for the production blockchain layer:

- `InstitutionRegistry.sol` — approve and suspend issuing institutions
- `CredentialRegistry.sol` — issue, verify, and revoke credential hashes

## Quick start

```bash
cd contracts
npm install
cp .env.example .env
npm run compile
npm run deploy:amoy
```

The web MVP in the repo runs in **mock-chain mode by default** so you can demo without setting up RPC keys first.
