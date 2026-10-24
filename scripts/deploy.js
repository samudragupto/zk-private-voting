/**
 * @file deploy.js
 * @notice Automated deployment script for Polygon Amoy Testnet & Local Hardhat.
 *         Deploys Verifier.sol, Poseidon(2) hasher, and Voting.sol.
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { poseidonContract } = require("circomlibjs");
const { createDemoMerkleTree } = require("./merkleTree");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("==================================================");
  console.log("Deploying ZK Private Voting System");
  console.log("==================================================");
  console.log(`Network:          ${network}`);
  console.log(`Deployer Account: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Balance: ${hre.ethers.formatEther(balance)} POL/ETH\n`);

  // 1. Deploy Verifier Contract
  console.log("[1/3] Deploying Groth16 Verifier...");
  const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`Verifier deployed at: ${verifierAddress}`);

  // 2. Deploy Poseidon(2) Hasher Contract
  console.log("\n[2/3] Deploying Poseidon(2) Hasher...");
  const poseidonFactory = new hre.ethers.ContractFactory(
    poseidonContract.generateABI(2),
    poseidonContract.createCode(2),
    deployer
  );
  const poseidon = await poseidonFactory.deploy();
  await poseidon.waitForDeployment();
  const poseidonAddress = await poseidon.getAddress();
  console.log(`Poseidon(2) deployed at: ${poseidonAddress}`);

  // 3. Compute Demo Merkle Root (Depth 4, 16 demo voters)
  const { root: approvedMerkleRoot } = await createDemoMerkleTree();
  const proposalId = 1n;
  console.log(`Demo Approved Root:    ${approvedMerkleRoot}`);
  console.log(`Demo Proposal ID:      ${proposalId}`);

  // 4. Deploy Voting Contract
  console.log("\n[3/3] Deploying Voting Contract...");
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(
    verifierAddress,
    poseidonAddress,
    BigInt(approvedMerkleRoot),
    proposalId
  );
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log(`Voting deployed at:   ${votingAddress}`);

  // 5. Export deployed contract addresses
  const deploymentInfo = {
    network,
    chainId: hre.network.config.chainId || 31337,
    deployer: deployer.address,
    verifierAddress,
    poseidonAddress,
    votingAddress,
    approvedMerkleRoot,
    proposalId: proposalId.toString(),
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, "..", "deployed_addresses.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentPath}`);

  // Synchronize to frontend config
  const frontendConfigDir = path.join(__dirname, "..", "frontend", "src", "config");
  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(frontendConfigDir, "contracts.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // 6. Verify on Polygonscan if deploying to Amoy
  if (network === "amoy") {
    console.log("\nWaiting 5 block confirmations before Polygonscan verification...");
    await voting.deploymentTransaction().wait(5);

    try {
      console.log("Verifying Verifier on Polygonscan Amoy...");
      await hre.run("verify:verify", {
        address: verifierAddress,
        constructorArguments: [],
      });
      console.log("Verifier verified.");
    } catch (err) {
      console.warn("Verifier verification note:", err.message);
    }

    try {
      console.log("Verifying Voting on Polygonscan Amoy...");
      await hre.run("verify:verify", {
        address: votingAddress,
        constructorArguments: [
          verifierAddress,
          poseidonAddress,
          BigInt(approvedMerkleRoot),
          proposalId
        ],
      });
      console.log("Voting verified.");
    } catch (err) {
      console.warn("Voting verification note:", err.message);
    }
  }

  console.log("\nDeployment pipeline finished successfully.");
}

if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = { main };
