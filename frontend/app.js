/* ConfidentialIdentity dApp — browser-side FHE via @zama-fhe/relayer-sdk (Sepolia).
 *
 * Flow:
 *   1. connect wallet (MetaMask) on Sepolia
 *   2. init the relayer SDK instance
 *   3. register: encrypt age+country in the browser, send handles+proof on-chain
 *   4. attest: ask the contract to compute an encrypted boolean for a verifier
 *   5. decrypt: the verifier (or owner) decrypts ONLY that boolean off-chain
 */

const { ethers } = window; // ethers UMD
const SDK = window.relayerSDK; // relayer SDK UMD

const $ = (id) => document.getElementById(id);
const log = (msg) => {
  const el = $("log");
  el.textContent += `\n${msg}`;
  el.scrollTop = el.scrollHeight;
};

let signer, provider, contract, instance, account;

async function connect() {
  if (!window.ethereum) return log("❌ MetaMask not found.");
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  const net = await provider.getNetwork();
  if (net.chainId !== 11155111n) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: window.APP_CONFIG.chainIdHex }],
      });
    } catch {
      return log("❌ Please switch MetaMask to Sepolia.");
    }
  }

  signer = await provider.getSigner();
  account = await signer.getAddress();
  contract = new ethers.Contract(window.APP_CONFIG.contractAddress, window.CONTRACT_ABI, signer);
  $("account").textContent = account;
  log(`✅ Connected: ${account}`);

  log("⏳ Initializing FHE SDK (loading wasm)…");
  await SDK.initSDK();
  instance = await SDK.createInstance({ ...SDK.SepoliaConfig, network: window.ethereum });
  log("✅ FHE instance ready.");
}

async function register() {
  const age = parseInt($("age").value, 10);
  const country = parseInt($("country").value, 10);
  log(`⏳ Encrypting age=${age}, country=${country} in the browser…`);

  const enc = await instance
    .createEncryptedInput(window.APP_CONFIG.contractAddress, account)
    .add8(age)
    .add16(country)
    .encrypt();

  log("⏳ Sending registerIdentity tx…");
  const tx = await contract.registerIdentity(enc.handles[0], enc.handles[1], enc.inputProof);
  await tx.wait();
  log(`✅ Identity registered. tx: ${tx.hash}`);
}

async function attestAge() {
  const threshold = parseInt($("threshold").value, 10);
  const verifier = $("verifier").value.trim() || account;
  log(`⏳ Attesting age ≥ ${threshold} for verifier ${verifier}…`);
  const tx = await contract.attestMinimumAge(threshold, verifier);
  await tx.wait();
  log(`✅ Attestation issued. tx: ${tx.hash}`);
}

async function decryptAttestation() {
  const owner = $("owner").value.trim() || account;
  log(`⏳ Reading attestation handle for ${owner}…`);
  const handle = await contract.getAttestation(owner);
  if (handle === ethers.ZeroHash) return log("⚠️ No attestation found for that address.");

  // Build a user-decrypt request signed via EIP-712 (canonical Zama flow).
  const keypair = instance.generateKeypair();
  const start = Math.floor(Date.now() / 1000).toString();
  const days = "1";
  const contracts = [window.APP_CONFIG.contractAddress];
  const eip712 = instance.createEIP712(keypair.publicKey, contracts, start, days);

  log("⏳ Sign the decrypt request in MetaMask…");
  const signature = await signer.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    eip712.message,
  );

  log("⏳ Requesting decryption from the relayer…");
  const results = await instance.userDecrypt(
    [{ handle, contractAddress: window.APP_CONFIG.contractAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature.replace(/^0x/, ""),
    contracts,
    account,
    start,
    days,
  );

  const value = results[handle];
  log(`🔓 Decrypted attestation = ${value} (true = passes the check)`);
}

$("btnConnect").onclick = () => connect().catch((e) => log("❌ " + (e.message || e)));
$("btnRegister").onclick = () => register().catch((e) => log("❌ " + (e.message || e)));
$("btnAttest").onclick = () => attestAge().catch((e) => log("❌ " + (e.message || e)));
$("btnDecrypt").onclick = () => decryptAttestation().catch((e) => log("❌ " + (e.message || e)));
