/**
 * @file generateProof.js
 * @notice Generates a Groth16 zk-SNARK proof and public signals from circuits/input.json
 *         using SnarkJS with BN128 curve optimization for Ethereum precompile compatibility.
 *
 * Deliverables:
 * - proof.json: Groth16 elliptic curve points (A in G1, B in G2, C in G1)
 * - public.json: Public outputs [nullifierHash, voteCommitment]
 * - Formatted Solidity calldata for direct contract interaction
 */

const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const { ethers } = require("ethers");

const ROOT_DIR = path.resolve(__dirname, "..");
const CIRCUITS_DIR = path.join(ROOT_DIR, "circuits");
const BUILD_DIR = path.join(CIRCUITS_DIR, "build");

async function main() {
  console.log("==================================================");
  console.log("Groth16 ZK-Proof Generation Pipeline (BN128)");
  console.log("==================================================");

  // 1. Read input signals
  const inputPath = path.join(CIRCUITS_DIR, "input.json");
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing input file: ${inputPath}`);
  }
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  console.log("Loaded Voter Inputs:");
  console.log({
    nullifier: input.nullifier ? `${input.nullifier.slice(0, 10)}...` : undefined,
    vote: input.vote,
    tokenBalance: input.tokenBalance,
    salt: input.salt ? `${input.salt.slice(0, 10)}...` : undefined,
  });

  // Verify eligibility and vote constraints locally before proving
  if (BigInt(input.tokenBalance) < 1n) {
    throw new Error("Ineligible: Voter token balance must be >= 1");
  }
  if (input.vote !== "0" && input.vote !== "1") {
    throw new Error("Invalid Vote: Vote must be strictly binary ('0' or '1')");
  }

  // 2. Identify WASM and ZKEY
  const wasmPath = path.join(BUILD_DIR, "voting.wasm");
  const zkeyPath = path.join(BUILD_DIR, "voting_final.zkey");

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    throw new Error("Missing compiled artifacts in circuits/build. Please run compilation first.");
  }

  // 3. Full Prove with SnarkJS Groth16
  console.log("\nComputing witness and Groth16 proof...");
  const startTime = process.hrtime.bigint();

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1e6;

  console.log(`Proof successfully generated in ${durationMs.toFixed(2)} ms`);
  console.log("\nPublic Signals:");
  console.log(`   - Nullifier Hash:   ${publicSignals[0]}`);
  console.log(`   - Vote Commitment:  ${publicSignals[1]}`);

  // 4. Save artifacts
  fs.writeFileSync(path.join(BUILD_DIR, "proof.json"), JSON.stringify(proof, null, 2));
  fs.writeFileSync(
    path.join(BUILD_DIR, "public.json"),
    JSON.stringify(publicSignals, null, 2)
  );

  // 5. Generate and display Solidity calldata
  const calldataRaw = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  console.log("\nFormatted Solidity CallData:");
  console.log(calldataRaw);

  console.log("\nProof generation complete.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Proof generation error:", err);
    process.exit(1);
  });
}

module.exports = { main };
