import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialIdentity, ConfidentialIdentity__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner; // the identity owner
  bob: HardhatEthersSigner; // the verifier (e.g. a dApp gate)
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ConfidentialIdentity")) as ConfidentialIdentity__factory;
  const contract = (await factory.deploy()) as ConfidentialIdentity;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

describe("ConfidentialIdentity", function () {
  let signers: Signers;
  let contract: ConfidentialIdentity;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }
    ({ contract, contractAddress } = await deployFixture());
  });

  async function registerAlice(age: number, country: number) {
    const enc = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(age)
      .add16(country)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .registerIdentity(enc.handles[0], enc.handles[1], enc.inputProof);
    await tx.wait();
  }

  it("starts with no identity registered", async function () {
    expect(await contract.hasIdentity(signers.alice.address)).to.eq(false);
  });

  it("registers an encrypted identity", async function () {
    await registerAlice(25, 792); // age 25, country TR (792)
    expect(await contract.hasIdentity(signers.alice.address)).to.eq(true);
  });

  it("attests age >= 18 as TRUE for a 25 year old, decryptable only by the verifier", async function () {
    await registerAlice(25, 792);

    const tx = await contract.connect(signers.alice).attestMinimumAge(18, signers.bob.address);
    await tx.wait();

    const handle = await contract.getAttestation(signers.alice.address);

    // Bob (the verifier) can decrypt the boolean result...
    const resultForBob = await fhevm.userDecryptEbool(handle, contractAddress, signers.bob);
    expect(resultForBob).to.eq(true);

    // ...and Alice can see her own result too.
    const resultForAlice = await fhevm.userDecryptEbool(handle, contractAddress, signers.alice);
    expect(resultForAlice).to.eq(true);
  });

  it("attests age >= 21 as FALSE for a 18 year old", async function () {
    await registerAlice(18, 792);

    const tx = await contract.connect(signers.alice).attestMinimumAge(21, signers.bob.address);
    await tx.wait();

    const handle = await contract.getAttestation(signers.alice.address);
    const result = await fhevm.userDecryptEbool(handle, contractAddress, signers.bob);
    expect(result).to.eq(false);
  });

  it("attests 'not from banned country' correctly (TR user, US banned => TRUE)", async function () {
    await registerAlice(30, 792); // TR

    const tx = await contract.connect(signers.alice).attestNotFromCountry(840, signers.bob.address); // US = 840
    await tx.wait();

    const handle = await contract.getAttestation(signers.alice.address);
    const result = await fhevm.userDecryptEbool(handle, contractAddress, signers.bob);
    expect(result).to.eq(true);
  });

  it("attests 'not from banned country' as FALSE when user IS from the banned country", async function () {
    await registerAlice(30, 840); // US

    const tx = await contract.connect(signers.alice).attestNotFromCountry(840, signers.bob.address);
    await tx.wait();

    const handle = await contract.getAttestation(signers.alice.address);
    const result = await fhevm.userDecryptEbool(handle, contractAddress, signers.bob);
    expect(result).to.eq(false);
  });

  it("reverts attestation when the caller has no identity", async function () {
    await expect(
      contract.connect(signers.alice).attestMinimumAge(18, signers.bob.address),
    ).to.be.revertedWithCustomError(contract, "IdentityNotFound");
  });
});
