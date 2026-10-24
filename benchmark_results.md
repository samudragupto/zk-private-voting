# Empirical ZK-SNARK Benchmark Report

- **Date**: 2026-10-24T12:45:09.494Z
- **Circuit**: `circuits/voting.circom`
- **R1CS Constraints**: 3530
- **Iterations**: 10

## Execution Environment
- **Host**: `LAPTOP-KR7AT2H4` (Windows_NT 10.0.26200 (x64))
- **Node.js**: `v22.20.0`
- **CPU**: AMD Ryzen 7 7840HS w/ Radeon 780M Graphics      (16 threads)
- **RAM**: 15.19 GB
- **Prover Mode**: SnarkJS WASM on CPU (single process)
- **GPU Status**: `GPU proving: not configured; SnarkJS WASM benchmark executed on CPU.`

## Empirical Results

| Metric | Measured Value | Notes |
| :--- | :--- | :--- |
| **Circuit Constraints** | `3530` | Verified via `snarkjs r1cs info` |
| **Average Proof Time** | `144.32 ms` | Min: `128.12 ms`, Max: `169.24 ms` |
| **Average Verify Time** | `8.75 ms` | Min: `7.17 ms`, Max: `14.77 ms` |
| **Process Heap Used** | `9.65 MB` | Node.js process heap allocation |
| **Resident Set Size (RSS)** | `540.33 MB` | Total process memory resident in RAM |

> **Hardware & Disclosure Note**:
> All benchmarks reported above were executed on CPU using the SnarkJS WASM witness calculator and prover. No external GPU acceleration libraries (e.g., ICICLE, Rapidsnark CUDA) are bundled or executed in this run.
