# ConfidentialIdentity — Private On-Chain KYC with Zama FHE

A working FHEVM demo of the **Crivacy** idea: prove facts about your identity
(*"I'm over 18"*, *"I'm not from a sanctioned country"*) to a verifier **without
ever revealing your age or nationality**. Built with Fully Homomorphic Encryption
so comparisons run over encrypted data on-chain.

Built on the [Zama FHEVM](https://github.com/zama-ai/fhevm) Hardhat template.
Candidate for the [Zama Developer Program — Builder Track](https://www.zama.org/programs/developer-program).

## How it works

1. **Register** — a user stores an *encrypted* age (`euint8`) and country code
   (`euint16`). Ciphertext never leaves the encrypted domain.
2. **Attest** — the user asks the contract to compute an encrypted boolean, e.g.
   `age >= 18` or `country != <banned>`, and grants **one specific verifier**
   permission to decrypt *only that boolean* — never the underlying value.
3. **Verify** — the verifier decrypts the boolean off-chain and gates access.
   The raw age / nationality stays private forever.

Key file: [`contracts/ConfidentialIdentity.sol`](contracts/ConfidentialIdentity.sol)
— uses `FHE.ge` / `FHE.ne` over encrypted inputs and `FHE.allow(...)` to scope
decryption rights per address.

## Quick start

```bash
npm install
npm run compile
npx hardhat test test/ConfidentialIdentity.ts   # 7 passing on the FHEVM mock
```

## Deploy

```bash
# local
npm run deploy:localhost

# Sepolia (needs MNEMONIC + INFURA_API_KEY set via `npx hardhat vars set ...`)
npm run deploy:sepolia
```

## Tests

`test/ConfidentialIdentity.ts` runs against the in-process FHEVM mock and covers:
registration, age attestation (true/false), sanctioned-country exclusion
(true/false), verifier-scoped decryption, and the no-identity revert.

## Roadmap ideas

- ERC-7984 confidential attestation token (portable "verified adult" badge).
- Expiry / revocation of attestations.
- Frontend using `@zama-fhe/relayer-sdk` for browser-side encryption.
- Batch attestations (age + region + accredited-investor in one call).

---

Scaffolded from `zama-ai/fhevm-hardhat-template`. See `contracts/FHECounter.sol`
for the upstream minimal example.
