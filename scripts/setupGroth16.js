/**
 * @file setupGroth16.js
 * @notice Development trusted setup ceremony and Solidity verifier generation.
 *         Uses Hermez Powers of Tau (pot12, 4096 slots) for BN128 curve.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const CIRCUITS_DIR = path.join(ROOT_DIR, "circuits");
const BUILD_DIR = path.join(CIRCUITS_DIR, "build");
const CONTRACTS_DIR = path.join(ROOT_DIR, "contracts");
const FRONTEND_CIRCUITS_DIR = path.join(ROOT_DIR, "frontend", "public", "circuits");

async function main() {
  console.log("==================================================");
  console.log("Groth16 Trusted Setup & Verifier Export Pipeline");
  console.log("==================================================");

  const r1csPath = path.join(BUILD_DIR, "voting.r1cs");
  if (!fs.existsSync(r1csPath)) {
    throw new Error(`R1CS file not found at ${r1csPath}. Run compileCircuit.js first.`);
  }

  // 1. Powers of Tau (pot12 = 4096 slots, supporting 3530 constraints)
  console.log("\n[Step 1/4] Ensuring Powers of Tau ceremony (pot12, BN128)...");
  const ptauPath = path.join(BUILD_DIR, "pot12_final.ptau");
  if (!fs.existsSync(ptauPath)) {
    console.log("Generating development Powers of Tau (2^12 = 4096 slots)...");
    const ptau0 = path.join(BUILD_DIR, "pot12_0000.ptau");
    const ptau1 = path.join(BUILD_DIR, "pot12_0001.ptau");
    execSync(`npx snarkjs powersoftau new bn128 12 "${ptau0}"`, { stdio: "inherit" });
    execSync(`npx snarkjs powersoftau contribute "${ptau0}" "${ptau1}" --name="DevelopmentContributor" -v -e="entropy"`, { stdio: "inherit" });
    execSync(`npx snarkjs powersoftau prepare phase2 "${ptau1}" "${ptauPath}" -v`, { stdio: "inherit" });
    if (fs.existsSync(ptau0)) fs.unlinkSync(ptau0);
    if (fs.existsSync(ptau1)) fs.unlinkSync(ptau1);
  }
  console.log(`Powers of Tau ready at: ${ptauPath}`);

  // 2. Groth16 Circuit Setup
  console.log("\n[Step 2/4] Running Groth16 circuit setup...");
  const zkey0 = path.join(BUILD_DIR, "voting_0000.zkey");
  const finalZkey = path.join(BUILD_DIR, "voting_final.zkey");

  execSync(`npx snarkjs groth16 setup "${r1csPath}" "${ptauPath}" "${zkey0}"`, { stdio: "inherit" });
  execSync(`npx snarkjs zkey contribute "${zkey0}" "${finalZkey}" --name="PragmaMumbaiContributor" -v -e="pragma-entropy"`, { stdio: "inherit" });
  if (fs.existsSync(zkey0)) fs.unlinkSync(zkey0);
  console.log(`Final zkey generated at: ${finalZkey}`);

  // 3. Export Verification Key
  console.log("\n[Step 3/4] Exporting Verification Key...");
  const vkeyPath = path.join(BUILD_DIR, "verification_key.json");
  execSync(`npx snarkjs zkey export verificationkey "${finalZkey}" "${vkeyPath}"`, { stdio: "inherit" });
  console.log(`Verification key saved to: ${vkeyPath}`);

  // 4. Export Solidity Verifier
  console.log("\n[Step 4/4] Exporting Solidity Verifier...");
  const verifierSol = path.join(CONTRACTS_DIR, "Verifier.sol");
  execSync(`npx snarkjs zkey export solidityverifier "${finalZkey}" "${verifierSol}"`, { stdio: "inherit" });

  // Update Verifier.sol with IVerifier interface linkage and alias
  let verifierContent = fs.readFileSync(verifierSol, "utf8");
  verifierContent = verifierContent.replace(
    "contract Groth16Verifier {",
    'import "./IVerifier.sol";\n\ncontract Groth16Verifier is IVerifier {'
  );
  verifierContent += "\ncontract Verifier is Groth16Verifier {}\n";
  fs.writeFileSync(verifierSol, verifierContent, "utf8");
  console.log(`Verifier.sol generated and linked to IVerifier at: ${verifierSol}`);

  // Copy artifacts to frontend
  if (fs.existsSync(FRONTEND_CIRCUITS_DIR)) {
    fs.copyFileSync(finalZkey, path.join(FRONTEND_CIRCUITS_DIR, "voting_final.zkey"));
    fs.copyFileSync(vkeyPath, path.join(FRONTEND_CIRCUITS_DIR, "verification_key.json"));
    console.log("Synchronized zkey and verification key to frontend/public/circuits/");
  }

  console.log("\nTrusted setup and verifier export completed successfully.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Setup error:", err);
    process.exit(1);
  });
}

module.exports = { main };
