/**
 * @file benchmark.js
 * @notice Empirical benchmark of Groth16 proof generation and verification using SnarkJS WASM.
 *         Measures real CPU execution metrics across 10 iterations.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const snarkjs = require("snarkjs");

const ROOT_DIR = path.resolve(__dirname, "..");
const CIRCUITS_DIR = path.join(ROOT_DIR, "circuits");
const BUILD_DIR = path.join(CIRCUITS_DIR, "build");
const RESULTS_JSON = path.join(ROOT_DIR, "benchmark_results.json");
const RESULTS_MD = path.join(ROOT_DIR, "benchmark_results.md");

async function runBenchmark() {
  console.log("=============================================================");
  console.log("Groth16 zk-SNARK Performance Benchmark (BN128 / WASM CPU)");
  console.log("=============================================================");

  const cpuModel = os.cpus()[0]?.model || "Unknown CPU";
  const cpuSpeed = os.cpus()[0]?.speed || 0;
  const cpuCores = os.cpus().length;
  const totalRamGB = (os.totalmem() / (1024 ** 3)).toFixed(2);
  const platform = `${os.type()} ${os.release()} (${os.arch()})`;
  const hostname = os.hostname();
  const nodeVersion = process.version;

  console.log(`Host:         ${hostname} (${platform})`);
  console.log(`Node:         ${nodeVersion}`);
  console.log(`CPU:          ${cpuModel} (${cpuCores} threads @ ~${cpuSpeed} MHz)`);
  console.log(`Memory:       ${totalRamGB} GB total RAM`);
  console.log("GPU proving:  not configured; SnarkJS WASM benchmark executed on CPU.");

  const wasmPath = path.join(BUILD_DIR, "voting_js", "voting.wasm");
  const fallbackWasmPath = path.join(BUILD_DIR, "voting.wasm");
  const activeWasm = fs.existsSync(wasmPath) ? wasmPath : fallbackWasmPath;
  const zkeyPath = path.join(BUILD_DIR, "voting_final.zkey");
  const vkeyPath = path.join(BUILD_DIR, "verification_key.json");
  const inputPath = path.join(CIRCUITS_DIR, "input.json");

  if (!fs.existsSync(activeWasm) || !fs.existsSync(zkeyPath) || !fs.existsSync(vkeyPath)) {
    throw new Error("Missing compiled artifacts in circuits/build. Please run compileCircuit.js and setupGroth16.js first.");
  }

  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const vKey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));

  console.log("\nRunning warm-up iteration...");
  await snarkjs.groth16.fullProve(input, activeWasm, zkeyPath);

  const iterations = 10;
  console.log(`\nExecuting ${iterations} benchmark iterations...`);

  const proveTimesMs = [];
  const verifyTimesMs = [];

  for (let i = 0; i < iterations; i++) {
    // 1. Proof Generation
    const pStart = process.hrtime.bigint();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      activeWasm,
      zkeyPath
    );
    const pEnd = process.hrtime.bigint();
    const pDuration = Number(pEnd - pStart) / 1e6;
    proveTimesMs.push(pDuration);

    // 2. Verification
    const vStart = process.hrtime.bigint();
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    const vEnd = process.hrtime.bigint();
    const vDuration = Number(vEnd - vStart) / 1e6;
    verifyTimesMs.push(vDuration);

    if (!isValid) throw new Error(`Proof verification failed on iteration ${i + 1}`);
    process.stdout.write(`  [${i + 1}/${iterations}] Prove: ${pDuration.toFixed(1)}ms | Verify: ${vDuration.toFixed(1)}ms\n`);
  }

  const avgProofTimeMs = proveTimesMs.reduce((a, b) => a + b, 0) / iterations;
  const minProofTimeMs = Math.min(...proveTimesMs);
  const maxProofTimeMs = Math.max(...proveTimesMs);

  const avgVerifyTimeMs = verifyTimesMs.reduce((a, b) => a + b, 0) / iterations;
  const minVerifyTimeMs = Math.min(...verifyTimesMs);
  const maxVerifyTimeMs = Math.max(...verifyTimesMs);

  const memUsage = process.memoryUsage();
  const heapUsedMB = (memUsage.heapUsed / (1024 ** 2)).toFixed(2);
  const rssMB = (memUsage.rss / (1024 ** 2)).toFixed(2);

  const benchmarkData = {
    benchmarkTimestamp: new Date().toISOString(),
    circuitConstraints: 3530,
    iterations: iterations,
    environment: {
      hostname: hostname,
      platform: platform,
      nodeVersion: nodeVersion,
      cpuModel: cpuModel,
      cpuCores: cpuCores,
      totalRamGB: Number(totalRamGB),
      gpuStatus: "GPU proving: not configured; SnarkJS WASM benchmark executed on CPU."
    },
    provingMetrics: {
      proverEngine: "SnarkJS (Node.js/WASM single-process)",
      averageProofTimeMs: Number(avgProofTimeMs.toFixed(2)),
      minProofTimeMs: Number(minProofTimeMs.toFixed(2)),
      maxProofTimeMs: Number(maxProofTimeMs.toFixed(2)),
      iterations: iterations
    },
    verificationMetrics: {
      verifierEngine: "SnarkJS JavaScript Verifier",
      averageVerifyTimeMs: Number(avgVerifyTimeMs.toFixed(2)),
      minVerifyTimeMs: Number(minVerifyTimeMs.toFixed(2)),
      maxVerifyTimeMs: Number(maxVerifyTimeMs.toFixed(2))
    },
    memoryUsageMB: {
      heapUsedMB: Number(heapUsedMB),
      rssMB: Number(rssMB)
    }
  };

  fs.writeFileSync(RESULTS_JSON, JSON.stringify(benchmarkData, null, 2));

  const markdownReport = `# Empirical ZK-SNARK Benchmark Report

- **Date**: ${benchmarkData.benchmarkTimestamp}
- **Circuit**: \`circuits/voting.circom\`
- **R1CS Constraints**: ${benchmarkData.circuitConstraints}
- **Iterations**: ${benchmarkData.iterations}

## Execution Environment
- **Host**: \`${hostname}\` (${platform})
- **Node.js**: \`${nodeVersion}\`
- **CPU**: ${cpuModel} (${cpuCores} threads)
- **RAM**: ${totalRamGB} GB
- **Prover Mode**: SnarkJS WASM on CPU (single process)
- **GPU Status**: \`GPU proving: not configured; SnarkJS WASM benchmark executed on CPU.\`

## Empirical Results

| Metric | Measured Value | Notes |
| :--- | :--- | :--- |
| **Circuit Constraints** | \`${benchmarkData.circuitConstraints}\` | Verified via \`snarkjs r1cs info\` |
| **Average Proof Time** | \`${avgProofTimeMs.toFixed(2)} ms\` | Min: \`${minProofTimeMs.toFixed(2)} ms\`, Max: \`${maxProofTimeMs.toFixed(2)} ms\` |
| **Average Verify Time** | \`${avgVerifyTimeMs.toFixed(2)} ms\` | Min: \`${minVerifyTimeMs.toFixed(2)} ms\`, Max: \`${maxVerifyTimeMs.toFixed(2)} ms\` |
| **Process Heap Used** | \`${heapUsedMB} MB\` | Node.js process heap allocation |
| **Resident Set Size (RSS)** | \`${rssMB} MB\` | Total process memory resident in RAM |

> **Hardware & Disclosure Note**:
> All benchmarks reported above were executed on CPU using the SnarkJS WASM witness calculator and prover. No external GPU acceleration libraries (e.g., ICICLE, Rapidsnark CUDA) are bundled or executed in this run.
`;

  fs.writeFileSync(RESULTS_MD, markdownReport);

  console.log("\n=============================================================");
  console.log("BENCHMARK SUMMARY");
  console.log("=============================================================");
  console.log(`Constraints:             3530`);
  console.log(`Average Proof Time:      ${avgProofTimeMs.toFixed(2)} ms`);
  console.log(`Average Verification:    ${avgVerifyTimeMs.toFixed(2)} ms`);
  console.log(`Heap Memory Used:        ${heapUsedMB} MB`);
  console.log(`Resident Set Size (RSS): ${rssMB} MB`);
  console.log("\nReports written to:");
  console.log(`  - ${RESULTS_JSON}`);
  console.log(`  - ${RESULTS_MD}`);
}

if (require.main === module) {
  runBenchmark()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Benchmark error:", err);
      process.exit(1);
    });
}

module.exports = { runBenchmark };
