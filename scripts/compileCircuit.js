/**
 * @file compileCircuit.js
 * @notice Compiles Circom 2.0+ circuit to R1CS, WASM, and SYM representations,
 *         and sets up the Groth16 zkey using Hermez Powers of Tau for BN128 curve.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const snarkjs = require("snarkjs");

const ROOT_DIR = path.resolve(__dirname, "..");
const CIRCUITS_DIR = path.join(ROOT_DIR, "circuits");
const BUILD_DIR = path.join(CIRCUITS_DIR, "build");
const CONTRACTS_DIR = path.join(ROOT_DIR, "contracts");

async function main() {
  console.log("==================================================");
  console.log("ZK-SNARK Circuit Compilation and Setup Pipeline");
  console.log("==================================================");

  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
    console.log(`Created build directory: ${BUILD_DIR}`);
  }

  const circuitPath = path.join(CIRCUITS_DIR, "voting.circom");
  if (!fs.existsSync(circuitPath)) {
    throw new Error(`Circuit file not found at: ${circuitPath}`);
  }

  // 1. Detect Circom Compiler
  console.log("\n[Step 1/5] Detecting Circom Compiler...");
  let circomCmd = "circom";
  try {
    const version = execSync("circom --version", { encoding: "utf8" });
    console.log(`Circom detected in PATH: ${version.trim()}`);
  } catch (err) {
    const localCircom = path.join(ROOT_DIR, "circom.exe");
    if (fs.existsSync(localCircom)) {
      circomCmd = `"${localCircom}"`;
      console.log(`Local Circom binary found: ${localCircom}`);
    } else {
      throw new Error("Circom binary not found in PATH or root directory.");
    }
  }

  // 2. Compile voting.circom
  console.log("\n[Step 2/5] Compiling voting.circom...");
  const compileCmd = `${circomCmd} "${circuitPath}" --r1cs --wasm --sym -o "${BUILD_DIR}" --prime bn128`;
  console.log(`Running: ${compileCmd}`);
  execSync(compileCmd, { stdio: "inherit" });
  console.log("Circuit compiled to R1CS, WASM, and SYM successfully.");

  // Copy WASM to circuits/build/voting.wasm
  const nestedWasm = path.join(BUILD_DIR, "voting_js", "voting.wasm");
  const targetWasm = path.join(BUILD_DIR, "voting.wasm");
  if (fs.existsSync(nestedWasm)) {
    fs.copyFileSync(nestedWasm, targetWasm);
  }

  // 3. Powers of Tau
  console.log("\n[Step 3/5] Setting up Powers of Tau...");
  const ptauPath = path.join(BUILD_DIR, "pot10_final.ptau");
  if (!fs.existsSync(ptauPath)) {
    console.log("Generating universal Powers of Tau (BN128, 2^10)...");
    const ptau0 = path.join(BUILD_DIR, "pot10_0000.ptau");
    const ptau1 = path.join(BUILD_DIR, "pot10_0001.ptau");
    execSync(`npx snarkjs powersoftau new bn128 10 "${ptau0}"`, { stdio: "inherit" });
    execSync(`npx snarkjs powersoftau contribute "${ptau0}" "${ptau1}" --name="Contributor" -v -e="entropy"`, { stdio: "inherit" });
    execSync(`npx snarkjs powersoftau prepare phase2 "${ptau1}" "${ptauPath}" -v`, { stdio: "inherit" });
  }
  console.log("Powers of Tau ready.");

  // 4. Groth16 Setup
  console.log("\n[Step 4/5] Running Groth16 trusted setup ceremony...");
  const r1csPath = path.join(BUILD_DIR, "voting.r1cs");
  const zkey0 = path.join(BUILD_DIR, "voting_0000.zkey");
  const finalZkey = path.join(BUILD_DIR, "voting_final.zkey");

  execSync(`npx snarkjs groth16 setup "${r1csPath}" "${ptauPath}" "${zkey0}"`, { stdio: "inherit" });
  execSync(`npx snarkjs zkey contribute "${zkey0}" "${finalZkey}" --name="PragmaContributor" -v -e="entropy"`, { stdio: "inherit" });
  console.log(`Final zkey generated: ${finalZkey}`);

  // 5. Export Verification Key and Solidity Verifier
  console.log("\n[Step 5/5] Exporting Verification Key and Solidity Verifier...");
  const vkeyPath = path.join(BUILD_DIR, "verification_key.json");
  execSync(`npx snarkjs zkey export verificationkey "${finalZkey}" "${vkeyPath}"`, { stdio: "inherit" });

  const verifierSol = path.join(CONTRACTS_DIR, "Verifier.sol");
  execSync(`npx snarkjs zkey export solidityverifier "${finalZkey}" "${verifierSol}"`, { stdio: "inherit" });
  fs.appendFileSync(verifierSol, "\nimport \"./IVerifier.sol\";\ncontract Verifier is Groth16Verifier {}\n");
  console.log("Verifier.sol exported successfully.");

  console.log("\nCompilation and setup pipeline completed successfully.");
}

main().catch((err) => {
  console.error("Pipeline error:", err);
  process.exit(1);
});
