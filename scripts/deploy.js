/**
 * @file deploy.js
 * @notice Automated deployment script for Polygon Mumbai / Amoy Testnet & Local Hardhat.
 *         Deploys Verifier.sol and Voting.sol, validates deployment state, and optionally
 *         submits source code for verification on Polygonscan.
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  console.log("==================================================");
  console.log("Deploying ZK Private Voting System");
  console.log("==================================================");
  console.log(`Network:          ${network}`);
  console.log(`Deployer Account: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Balance: ${hre.ethers.formatEther(balance)} MATIC/ETH\n`);

  // 1. Deploy Verifier Contract
  console.log("[1/2] Deploying Groth16 Verifier...");
  const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`Verifier deployed at: ${verifierAddress}`);

  // 2. Deploy Voting Contract
  console.log("\n[2/2] Deploying Voting Contract with Verifier link...");
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(verifierAddress);
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log(`Voting deployed at:   ${votingAddress}`);

  // 3. Export deployed contract addresses for Frontend & Scripts
  const deploymentInfo = {
    network,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    verifierAddress,
    votingAddress,
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, "..", "deployed_addresses.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentPath}`);

  // Also write to frontend config if frontend/src exists
  const frontendConfigDir = path.join(__dirname, "..", "frontend", "src", "config");
  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(frontendConfigDir, "contracts.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // 4. Verify on Polygonscan (only on live networks like mumbai/amoy)
  if (network === "mumbai" || network === "amoy") {
    console.log("\nWaiting 5 block confirmations before Polygonscan verification...");
    await voting.deploymentTransaction().wait(5);

    try {
      console.log("Verifying Verifier on Polygonscan...");
      await hre.run("verify:verify", {
        address: verifierAddress,
        constructorArguments: [],
      });
      console.log("Verifier verified.");
    } catch (err) {
      console.warn("Verifier verification note:", err.message);
    }

    try {
      console.log("Verifying Voting on Polygonscan...");
      await hre.run("verify:verify", {
        address: votingAddress,
        constructorArguments: [verifierAddress],
      });
      console.log("Voting verified.");
    } catch (err) {
      console.warn("Voting verification note:", err.message);
    }
  }

  console.log("\nDeployment completed successfully.");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
