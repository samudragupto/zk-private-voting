const { expect } = require("chai");
const { ethers } = require("hardhat");
const { poseidonContract, buildPoseidon } = require("circomlibjs");
const snarkjs = require("snarkjs");
const path = require("path");
const fs = require("fs");
const { createDemoMerkleTree, DEMO_IDENTITY_SECRETS } = require("../../scripts/merkleTree");

describe("ZK Private Voting System (Educational Prototype)", function () {
  let mockVerifier;
  let realVerifier;
  let poseidon;
  let voting;
  let deployer;
  let voter1;
  let voter2;
  let treeInfo;
  let poseidonJs;

  const PROPOSAL_ID = 1n;
  let APPROVED_ROOT;

  // Mock proof data
  const mockA = [1n, 2n];
  const mockB = [[3n, 4n], [5n, 6n]];
  const mockC = [7n, 8n];
  let encodedMockProof;

  before(async function () {
    poseidonJs = await buildPoseidon();
    treeInfo = await createDemoMerkleTree();
    APPROVED_ROOT = BigInt(treeInfo.root);
  });

  beforeEach(async function () {
    [deployer, voter1, voter2] = await ethers.getSigners();

    // 1. Deploy real Poseidon contract
    const poseidonFactory = new ethers.ContractFactory(
      poseidonContract.generateABI(2),
      poseidonContract.createCode(2),
      deployer
    );
    poseidon = await poseidonFactory.deploy();
    await poseidon.waitForDeployment();

    // 2. Deploy MockVerifier
    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    mockVerifier = await MockVerifier.deploy();
    await mockVerifier.waitForDeployment();

    // 3. Deploy Voting with MockVerifier
    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy(
      await mockVerifier.getAddress(),
      await poseidon.getAddress(),
      APPROVED_ROOT,
      PROPOSAL_ID
    );
    await voting.waitForDeployment();

    encodedMockProof = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256[2]", "uint256[2][2]", "uint256[2]"],
      [mockA, mockB, mockC]
    );
  });

  describe("Contract Deployment & Setup", function () {
    it("Should correctly set verifier, poseidon, approved root, and proposalId", async function () {
      expect(await voting.verifier()).to.equal(await mockVerifier.getAddress());
      expect(await voting.poseidon()).to.equal(await poseidon.getAddress());
      expect(await voting.approvedMerkleRoot()).to.equal(APPROVED_ROOT);
      expect(await voting.proposalId()).to.equal(PROPOSAL_ID);
    });

    it("Should initialize with zero votes", async function () {
      const [v0, v1] = await voting.getResults();
      expect(v0).to.equal(0n);
      expect(v1).to.equal(0n);
      expect(await voting.totalVotesCast()).to.equal(0n);
    });

    it("Should revert if deployed with zero addresses or zero root", async function () {
      const Voting = await ethers.getContractFactory("Voting");
      const verifierAddr = await mockVerifier.getAddress();
      const poseidonAddr = await poseidon.getAddress();

      await expect(
        Voting.deploy(ethers.ZeroAddress, poseidonAddr, APPROVED_ROOT, PROPOSAL_ID)
      ).to.be.revertedWithCustomError(voting, "ZeroVerifierAddress");

      await expect(
        Voting.deploy(verifierAddr, ethers.ZeroAddress, APPROVED_ROOT, PROPOSAL_ID)
      ).to.be.revertedWithCustomError(voting, "ZeroPoseidonAddress");

      await expect(
        Voting.deploy(verifierAddr, poseidonAddr, 0n, PROPOSAL_ID)
      ).to.be.revertedWithCustomError(voting, "ZeroMerkleRoot");
    });
  });

  describe("Ballot Submission Verification", function () {
    const salt1 = 123456789n;
    const voteChoice1 = 1n; // Yea
    let commitment1;
    const nullifier1 = 987654321n;

    beforeEach(async function () {
      commitment1 = BigInt(
        poseidonJs.F.toString(poseidonJs([voteChoice1, salt1]))
      );
    });

    it("Should submit a valid vote and emit VoteSubmitted without voter address", async function () {
      const publicSignals = [APPROVED_ROOT, PROPOSAL_ID, nullifier1, commitment1];

      const tx = await voting.connect(voter1).vote(encodedMockProof, publicSignals);
      await expect(tx)
        .to.emit(voting, "VoteSubmitted")
        .withArgs(nullifier1, commitment1);

      expect(await voting.isNullifierUsed(nullifier1)).to.be.true;
      expect(await voting.validCommitments(commitment1)).to.be.true;
      expect(await voting.totalVotesCast()).to.equal(1n);
    });

    it("Should reject vote with wrong Merkle root", async function () {
      const wrongRoot = 999999999n;
      const publicSignals = [wrongRoot, PROPOSAL_ID, nullifier1, commitment1];

      await expect(
        voting.connect(voter1).vote(encodedMockProof, publicSignals)
      ).to.be.revertedWithCustomError(voting, "InvalidMerkleRoot");
    });

    it("Should reject vote with wrong proposal ID", async function () {
      const wrongProposal = 2n;
      const publicSignals = [APPROVED_ROOT, wrongProposal, nullifier1, commitment1];

      await expect(
        voting.connect(voter1).vote(encodedMockProof, publicSignals)
      ).to.be.revertedWithCustomError(voting, "InvalidProposalId");
    });

    it("Should reject vote with zero nullifier or zero commitment", async function () {
      const zeroNullifierSignals = [APPROVED_ROOT, PROPOSAL_ID, 0n, commitment1];
      await expect(
        voting.connect(voter1).vote(encodedMockProof, zeroNullifierSignals)
      ).to.be.revertedWithCustomError(voting, "ZeroNullifier");

      const zeroCommitmentSignals = [APPROVED_ROOT, PROPOSAL_ID, nullifier1, 0n];
      await expect(
        voting.connect(voter1).vote(encodedMockProof, zeroCommitmentSignals)
      ).to.be.revertedWithCustomError(voting, "ZeroCommitment");
    });

    it("Should prevent double voting with the same nullifier", async function () {
      const publicSignals = [APPROVED_ROOT, PROPOSAL_ID, nullifier1, commitment1];
      await voting.connect(voter1).vote(encodedMockProof, publicSignals);

      const commitment2 = 555555555n;
      const secondSignals = [APPROVED_ROOT, PROPOSAL_ID, nullifier1, commitment2];

      await expect(
        voting.connect(voter2).vote(encodedMockProof, secondSignals)
      ).to.be.revertedWithCustomError(voting, "AlreadyVoted");
    });

    it("Should reject vote when Verifier returns false (InvalidProof)", async function () {
      await mockVerifier.setShouldPass(false);
      const publicSignals = [APPROVED_ROOT, PROPOSAL_ID, nullifier1, commitment1];

      await expect(
        voting.connect(voter1).vote(encodedMockProof, publicSignals)
      ).to.be.revertedWithCustomError(voting, "InvalidProof");
    });
  });

  describe("Tally and Reveal Mechanics", function () {
    const saltOption0 = 111111111n;
    const saltOption1 = 222222222n;
    let commitmentOption0;
    let commitmentOption1;
    const nullifierA = 100000001n;
    const nullifierB = 100000002n;

    beforeEach(async function () {
      commitmentOption0 = BigInt(poseidonJs.F.toString(poseidonJs([0n, saltOption0])));
      commitmentOption1 = BigInt(poseidonJs.F.toString(poseidonJs([1n, saltOption1])));

      // Submit ballots
      await voting.vote(encodedMockProof, [APPROVED_ROOT, PROPOSAL_ID, nullifierA, commitmentOption0]);
      await voting.vote(encodedMockProof, [APPROVED_ROOT, PROPOSAL_ID, nullifierB, commitmentOption1]);
    });

    it("Should reveal and increment tallies correctly using on-chain Poseidon", async function () {
      // Reveal Nay (Option 0)
      await expect(voting.revealVote(0, saltOption0))
        .to.emit(voting, "VoteRevealed")
        .withArgs(commitmentOption0, 0);

      // Reveal Yea (Option 1)
      await expect(voting.revealVote(1, saltOption1))
        .to.emit(voting, "VoteRevealed")
        .withArgs(commitmentOption1, 1);

      const [v0, v1] = await voting.getResults();
      expect(v0).to.equal(1n);
      expect(v1).to.equal(1n);
    });

    it("Should reject reveal with incorrect salt or vote choice", async function () {
      // Incorrect salt for Option 0
      const wrongSalt = 999999999n;
      await expect(
        voting.revealVote(0, wrongSalt)
      ).to.be.revertedWithCustomError(voting, "CommitmentNotFound");

      // Attempting to reveal Option 1 with salt of Option 0
      await expect(
        voting.revealVote(1, saltOption0)
      ).to.be.revertedWithCustomError(voting, "CommitmentNotFound");
    });

    it("Should reject invalid vote option (> 1)", async function () {
      await expect(
        voting.revealVote(2, saltOption0)
      ).to.be.revertedWithCustomError(voting, "InvalidVoteOption");
    });

    it("Should prevent revealing the same commitment twice", async function () {
      await voting.revealVote(0, saltOption0);

      await expect(
        voting.revealVote(0, saltOption0)
      ).to.be.revertedWithCustomError(voting, "AlreadyRevealed");
    });
  });

  describe("Real Groth16 End-to-End Integration", function () {
    it("Should successfully verify a genuine SnarkJS Groth16 proof with Groth16Verifier.sol", async function () {
      const wasmPath = path.join(__dirname, "..", "..", "circuits", "build", "voting_js", "voting.wasm");
      const zkeyPath = path.join(__dirname, "..", "..", "circuits", "build", "voting_final.zkey");

      if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        console.log("Skipping full proof integration: compiled circuit artifacts not found.");
        return;
      }

      // 1. Deploy real Groth16Verifier
      const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
      realVerifier = await Groth16Verifier.deploy();
      await realVerifier.waitForDeployment();

      // 2. Deploy Voting with real verifier
      const Voting = await ethers.getContractFactory("Voting");
      const realVoting = await Voting.deploy(
        await realVerifier.getAddress(),
        await poseidon.getAddress(),
        APPROVED_ROOT,
        PROPOSAL_ID
      );
      await realVoting.waitForDeployment();

      // 3. Generate genuine witness & proof for Leaf 0
      const proofInfo = treeInfo.tree.getProof(0);
      const voteChoice = 1;
      const salt = "4242424242";

      const circuitInput = {
        root: treeInfo.root,
        proposal: PROPOSAL_ID.toString(),
        identitySecret: DEMO_IDENTITY_SECRETS[0],
        merkleProof: proofInfo.merkleProof,
        merklePathIndices: proofInfo.merklePathIndices,
        vote: voteChoice.toString(),
        salt: salt
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuitInput, wasmPath, zkeyPath);
      const calldataRaw = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
      const argv = JSON.parse("[" + calldataRaw + "]");

      const a = argv[0];
      const b = argv[1];
      const c = argv[2];
      const pubSignalsOnChain = argv[3];

      // 4. Submit to Voting contract via voteWithProof
      const tx = await realVoting.voteWithProof(a, b, c, pubSignalsOnChain);
      await expect(tx).to.emit(realVoting, "VoteSubmitted");

      expect(await realVoting.totalVotesCast()).to.equal(1n);

      // 5. Reveal vote on-chain
      await realVoting.revealVote(voteChoice, BigInt(salt));
      const [v0, v1] = await realVoting.getResults();
      expect(v0).to.equal(0n);
      expect(v1).to.equal(1n);
    });
  });
});
