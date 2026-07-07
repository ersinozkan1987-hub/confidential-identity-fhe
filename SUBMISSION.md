# ConfidentialIdentity — Private On-Chain KYC with Zama FHE

**Zama Developer Program · Builder Track submission**

- **Live contract (Sepolia):** [`0x349bf00b6E29538A9c6F7D1F18cD8C48f7f94870`](https://sepolia.etherscan.io/address/0x349bf00b6E29538A9c6F7D1F18cD8C48f7f94870)
- **GitHub:** https://github.com/ersinozkan1987-hub/confidential-identity-fhe
- **Stack:** FHEVM (`@fhevm/solidity`), Hardhat, `@zama-fhe/relayer-sdk` browser dApp

## The problem

On-chain KYC today is all-or-nothing. To prove *"I'm old enough"* or *"I'm not from a
sanctioned jurisdiction,"* users hand over their full date of birth and nationality —
which then sit on-chain or in a centralized database forever, ready to leak. The
check is a single boolean, but the cost is your entire identity.

## What I built

ConfidentialIdentity lets a user store their identity **encrypted** and then prove
*facts* about it without ever revealing the underlying data:

1. **Register** — the user encrypts their age (`euint8`) and country code (`euint16`)
   **in the browser** and stores the ciphertext on-chain. The plaintext never leaves
   their device.
2. **Attest** — the contract computes an encrypted boolean over that ciphertext, e.g.
   `age >= 18` (`FHE.ge`) or `country != <banned>` (`FHE.ne`), and grants **one chosen
   verifier** permission to decrypt *only that boolean* via `FHE.allow`.
3. **Verify** — the verifier decrypts the single boolean off-chain (EIP-712
   user-decrypt through the relayer) and gates access. Age and nationality stay
   private forever.

This is KYC reduced to exactly the bit that matters — nothing more.

## Why FHE is essential here

The comparison runs **on encrypted data**: the contract, validators, and the public
never see the age or country, yet the chain still produces a verifiable
allow/deny result. This is impossible with plaintext storage, and unlike a ZK
attestation the encrypted value stays live on-chain and can be re-used for new
predicates (age, region, accredited-investor…) without re-submitting anything.

Core logic: [`contracts/ConfidentialIdentity.sol`](contracts/ConfidentialIdentity.sol)

## Status — working end to end

- ✅ Contract deployed, live, and [verified on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x349bf00b6E29538A9c6F7D1F18cD8C48f7f94870#code).
- ✅ Full round-trip proven on-chain: browser encrypt → `registerIdentity` →
  `attestMinimumAge` → EIP-712 `userDecrypt` → `attestation = true`.
- ✅ 7 passing Hardhat tests on the FHEVM mock (`test/ConfidentialIdentity.ts`):
  registration, age true/false, sanctioned-country true/false, verifier-scoped
  decryption, and the no-identity revert.
- ✅ Zero-build browser dApp in [`frontend/`](frontend/) using the relayer SDK.

## Try it

```bash
git clone https://github.com/ersinozkan1987-hub/confidential-identity-fhe
cd confidential-identity-fhe && npm install
npx hardhat test test/ConfidentialIdentity.ts   # 7 passing
npx serve frontend                               # connect MetaMask on Sepolia
```

## Roadmap

- ERC-7984 confidential attestation token — a portable, revocable "verified adult" badge.
- Attestation expiry + revocation.
- Batch predicates (age + region + accreditation) in a single call.
- Worker-based encryption for a non-blocking UI.

Built by [@UfukDegen](https://x.com/UfukDegen).
