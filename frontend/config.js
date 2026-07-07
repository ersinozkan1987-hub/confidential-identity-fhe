// Fill this in after you deploy to Sepolia (npm run deploy:sepolia prints the address).
window.APP_CONFIG = {
  // ConfidentialIdentity contract address on Sepolia:
  contractAddress: "0x0000000000000000000000000000000000000000",
  chainIdHex: "0xaa36a7", // 11155111 Sepolia
};

// Minimal ABI — only what the UI needs.
window.CONTRACT_ABI = [
  "function registerIdentity(bytes32 ageExt, bytes32 countryExt, bytes inputProof)",
  "function attestMinimumAge(uint8 threshold, address verifier)",
  "function attestNotFromCountry(uint16 bannedCountry, address verifier)",
  "function getAttestation(address user) view returns (bytes32)",
  "function hasIdentity(address user) view returns (bool)",
];
