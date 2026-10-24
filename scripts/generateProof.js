/**
 * @file generateProof.js
 * @notice Generates a Groth16 zk-SNARK proof and public signals from circuits/input.json
 *         or demo Merkle tree inputs using SnarkJS with BN128 curve.
 *
 * Output Artifacts:
 * - scripts/generated/proof.json & circuits/build/proof.json
 * - scripts/generated/public.json & circuits/build/public.json
 * - Formatted Solidity calldata for direct contract interaction
 */

const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const { createDemoMerkleTree, DEMO_IDENTITY_SECRETS } = require("./merkleTree");

const ROOT_DIR = path.resolve(__dirname, "..");
const CIRCUITS_DIR = path.join(ROOT_DIR, "circuits");
const BUILD_DIR = path.join(CIRCUITS_DIR, "build");
const GENERATED_DIR = path.join(__dirname, "generated");

async function main() {
  console.log("==================================================");
  console.log("Groth16 ZK-Proof Generation Pipeline (BN128)");
  console.log("==================================================");

  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  // 1. Load or prepare input signals
  const inputPath = path.join(CIRCUITS_DIR, "input.json");
  let input;

  if (fs.existsSync(inputPath)) {
    input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    console.log("Loaded circuit inputs from circuits/input.json");
  } else {
    console.log("Generating fresh demo inputs from 16-leaf Merkle tree...");
    const { root, tree } = await createDemoMerkleTree();
    const proofInfo = tree.getProof(0);
    input = {
      root: root,
      proposal: "1",
      identitySecret: DEMO_IDENTITY_SECRETS[0],
      merkleProof: proofInfo.merkleProof,
      merklePathIndices: proofInfo.merklePathIndices,
      vote: "1",
      salt: "123456789"
    };
    fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
  }

  console.log({
    proposalId: input.proposal,
    vote: input.vote,
    merkleRoot: `${input.root.slice(0, 14)}...`,
    identitySecret: `${input.identitySecret.slice(0, 8)}...`
  });

  if (input.vote !== "0" && input.vote !== "1") {
    throw new Error("Invalid Vote: Vote must be strictly binary ('0' or '1')");
  }

  // 2. Identify WASM and ZKEY
  const wasmPath = path.join(BUILD_DIR, "voting_js", "voting.wasm");
  const fallbackWasmPath = path.join(BUILD_DIR, "voting.wasm");
  const activeWasm = fs.existsSync(wasmPath) ? wasmPath : fallbackWasmPath;
  const zkeyPath = path.join(BUILD_DIR, "voting_final.zkey");

  if (!fs.existsSync(activeWasm) || !fs.existsSync(zkeyPath)) {
    throw new Error("Missing compiled artifacts in circuits/build. Please run compilation and setup first.");
  }

  // 3. Compute Groth16 proof
  console.log("\nComputing witness and Groth16 proof...");
  const startTime = process.hrtime.bigint();

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    activeWasm,
    zkeyPath
  );

  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1e6;

  console.log(`Proof generated in ${durationMs.toFixed(2)} ms`);
  console.log("\nPublic Signals (in exact Solidity verifier order):");
  console.log(`   [0] Merkle Root:      ${publicSignals[0]}`);
  console.log(`   [1] Proposal ID:      ${publicSignals[1]}`);
  console.log(`   [2] Nullifier Hash:   ${publicSignals[2]}`);
  console.log(`   [3] Vote Commitment:  ${publicSignals[3]}`);

  // 4. Save artifacts to scripts/generated and circuits/build
  fs.writeFileSync(path.join(GENERATED_DIR, "proof.json"), JSON.stringify(proof, null, 2));
  fs.writeFileSync(path.join(GENERATED_DIR, "public.json"), JSON.stringify(publicSignals, null, 2));
  fs.writeFileSync(path.join(BUILD_DIR, "proof.json"), JSON.stringify(proof, null, 2));
  fs.writeFileSync(path.join(BUILD_DIR, "public.json"), JSON.stringify(publicSignals, null, 2));

  // 5. Generate and display Solidity calldata
  const calldataRaw = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  console.log("\nFormatted Solidity CallData:");
  console.log(calldataRaw);

  console.log("\nProof generation complete. Artifacts saved to scripts/generated/ and circuits/build/.");
}

if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Proof generation error:", err);
      process.exit(1);
    });
}

module.exports = { main };
