const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZK-SNARK Private Voting System", function () {
  let verifier;
  let voting;
  let deployer;
  let voter1;
  let voter2;

  // Mock valid proof elements for testing
  const mockA = [
    "0x1111111111111111111111111111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222222222222222222222222222",
  ];
  const mockB = [
    [
      "0x3333333333333333333333333333333333333333333333333333333333333333",
      "0x4444444444444444444444444444444444444444444444444444444444444444",
    ],
    [
      "0x5555555555555555555555555555555555555555555555555555555555555555",
      "0x6666666666666666666666666666666666666666666666666666666666666666",
    ],
  ];
  const mockC = [
    "0x7777777777777777777777777777777777777777777777777777777777777777",
    "0x8888888888888888888888888888888888888888888888888888888888888888",
  ];

  let encodedProof;

  beforeEach(async function () {
    [deployer, voter1, voter2] = await ethers.getSigners();

    // Deploy mock verifier or actual verifier
    // For unit testing Voting logic without requiring trusted setup execution on every run:
    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    verifier = await MockVerifier.deploy();
    await verifier.waitForDeployment();

    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy(await verifier.getAddress());
    await voting.waitForDeployment();

    encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256[2]", "uint256[2][2]", "uint256[2]"],
      [mockA, mockB, mockC]
    );
  });

  describe("Deployment", function () {
    it("Should correctly set the verifier address", async function () {
      expect(await voting.verifier()).to.equal(await verifier.getAddress());
    });

    it("Should initialize with zero votes", async function () {
      const [v0, v1] = await voting.getResults();
      expect(v0).to.equal(0n);
      expect(v1).to.equal(0n);
      expect(await voting.totalVotesCast()).to.equal(0n);
    });

    it("Should revert if deployed with zero address for verifier", async function () {
      const Voting = await ethers.getContractFactory("Voting");
      await expect(Voting.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        voting,
        "ZeroVerifierAddress"
      );
    });
  });

  describe("Private Voting Execution", function () {
    const nullifier1 = 123456789n;
    const commitment1 = 987654321n;

    it("Should allow a voter to cast a valid private vote", async function () {
      await expect(voting.connect(voter1).vote(encodedProof, nullifier1, commitment1))
        .to.emit(voting, "VoteCast")
        .withArgs(voter1.address, commitment1);

      expect(await voting.isNullifierUsed(nullifier1)).to.be.true;
      expect(await voting.validCommitments(commitment1)).to.be.true;
      expect(await voting.totalVotesCast()).to.equal(1n);
    });

    it("Should PREVENT double voting with the same nullifier (Revert AlreadyVoted)", async function () {
      // First vote succeeds
      await voting.connect(voter1).vote(encodedProof, nullifier1, commitment1);

      // Attempt to vote again with same nullifier (even with different voter/commitment)
      const commitment2 = 999999999n;
      await expect(
        voting.connect(voter2).vote(encodedProof, nullifier1, commitment2)
      ).to.be.revertedWithCustomError(voting, "AlreadyVoted");
    });

    it("Should reject vote with zero nullifier or zero commitment", async function () {
      await expect(
        voting.connect(voter1).vote(encodedProof, 0n, commitment1)
      ).to.be.revertedWithCustomError(voting, "ZeroNullifier");

      await expect(
        voting.connect(voter1).vote(encodedProof, nullifier1, 0n)
      ).to.be.revertedWithCustomError(voting, "ZeroCommitment");
    });

    it("Should reject vote when Verifier returns false (InvalidProof)", async function () {
      await verifier.setShouldPass(false);
      await expect(
        voting.connect(voter1).vote(encodedProof, nullifier1, commitment1)
      ).to.be.revertedWithCustomError(voting, "InvalidProof");
    });
  });

  describe("Tally and Reveal Mechanics", function () {
    const nullifier1 = 1111111n;
    const commitment1 = 2222222n;
    const nullifier2 = 3333333n;
    const commitment2 = 4444444n;

    it("Should reveal and increment tallies correctly", async function () {
      // Cast ballots
      await voting.connect(voter1).vote(encodedProof, nullifier1, commitment1);
      await voting.connect(voter2).vote(encodedProof, nullifier2, commitment2);

      // Reveal Option 1
      await expect(voting.revealVote(1, commitment1))
        .to.emit(voting, "VoteRevealed")
        .withArgs(commitment1, 1);

      // Reveal Option 0
      await expect(voting.revealVote(0, commitment2))
        .to.emit(voting, "VoteRevealed")
        .withArgs(commitment2, 0);

      const [v0, v1] = await voting.getResults();
      expect(v0).to.equal(1n);
      expect(v1).to.equal(1n);
    });

    it("Should prevent revealing an unknown commitment", async function () {
      await expect(voting.revealVote(1, 999999999n)).to.be.revertedWithCustomError(
        voting,
        "CommitmentNotFound"
      );
    });

    it("Should prevent revealing the same commitment twice", async function () {
      await voting.connect(voter1).vote(encodedProof, nullifier1, commitment1);
      await voting.revealVote(1, commitment1);

      await expect(voting.revealVote(1, commitment1)).to.be.revertedWithCustomError(
        voting,
        "AlreadyRevealed"
      );
    });

    it("Should support atomic castAndRevealVote", async function () {
      await voting.connect(voter1).castAndRevealVote(
        encodedProof,
        nullifier1,
        commitment1,
        1
      );

      const [v0, v1] = await voting.getResults();
      expect(v0).to.equal(0n);
      expect(v1).to.equal(1n);
      expect(await voting.isNullifierUsed(nullifier1)).to.be.true;
    });
  });
});
