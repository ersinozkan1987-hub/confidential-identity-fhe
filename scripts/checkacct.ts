import { ethers } from "hardhat";
async function main() {
  const [deployer] = await ethers.getSigners();
  const addr = await deployer.getAddress();
  const bal = await ethers.provider.getBalance(addr);
  console.log("Deployer:", addr);
  console.log("Balance :", ethers.formatEther(bal), "SepoliaETH");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
