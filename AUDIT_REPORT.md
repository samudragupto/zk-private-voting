# Technical Audit Report: ZK Private Voting Prototype

**Repository:** `samudragupto/zk-private-voting`  
**Auditor:** Senior ZK Engineer, Solidity Security Auditor, Circom Developer  
**Status:** Audit Completed & Remediated  
**Target Event:** Pragma Mumbai Technical Session  
**Designation:** Educational Prototype / Technical Demo  

---

## Executive Summary

An audit of the initial repository revealed substantial divergences between documentation claims and the underlying cryptographic/smart contract implementation. The original system claimed to be a "production-ready" private voting system with "complete anonymity", sub-15ms GPU proving on RTX 4060 GPUs, and live testnet deployment.

In reality:
1. **Eligibility was completely insecure**: Eligibility was implemented as a private user-supplied input `tokenBalance`, constrained only by `tokenBalance * inv === 1`. Any user could input `tokenBalance = 1` without proving token ownership or Merkle membership.
2. **Nullifier was derived from wallet address in the frontend**: The frontend hashed `userAddress + proposalNonce`, directly binding nullifiers to Ethereum account identities while claiming anonymity.
3. **Smart contracts leaked voter addresses**: `Voting.sol` emitted `event VoteCast(address indexed voter, uint256 voteCommitment)`.
4. **Benchmarks were synthetic / fabricated**: Synthetic benchmark tables claimed RTX 4060 CUDA/ICICLE times (<15ms) and Colab T4 times (<30ms) despite no GPU provers being installed or configured.
5. **Network Standardization**: Standardized on Polygon Amoy (Chain ID 80002) using POL currency.
6. **On-chain commit-reveal lacked preimage verification**: Reveal accepted any arbitrary `computedCommitment` without verifying Poseidon hash preimages on-chain.

All issues have been remediated in this codebase.

---

## Detailed Audit Findings & Remediation (Sections A - G)

### A. Circuit Validity

#### Findings
- **Compiler Compatibility**: The original circuit in `circuits/voting.circom` claimed 434 constraints. However, it used an unconstrained `tokenBalance` input.
- **Poseidon Import**: It imported `circomlib/circuits/poseidon.circom` and instantiated `Poseidon(2)`, which compiles cleanly under Circom 2.2+.
- **Constraint Count**:
  - Original claim: 434 constraints.
  - Actual constraint count for the original insecure circuit: 434 constraints.
  - Actual constraint count for the remediated Merkle membership circuit: **3530 constraints** (verified via `snarkjs r1cs info circuits/build/voting.r1cs`).
- **Signal Ordering & Solidity Compatibility**:
  - The Circom compilation places output signals first in public input order.
  - Public signals are now strictly ordered:
    1. `merkleRoot`
    2. `proposalId`
    3. `nullifierHash`
    4. `voteCommitment`
- **Binary Vote Enforcement**: `vote * (vote - 1) === 0` is strictly enforced.
- **Public Output Signals**: `nullifierHash` and `voteCommitment` were correctly exposed as outputs, but `root` and `proposalId` were previously omitted from circuit context outputs.

#### Verification Command
```bash
snarkjs r1cs info circuits/build/voting.r1cs
```
**Actual Output:**
```
[INFO]  snarkJS: Curve: bn-128
[INFO]  snarkJS: # of Wires: 3538
[INFO]  snarkJS: # of Constraints: 3530
[INFO]  snarkJS: # of Private Inputs: 13
[INFO]  snarkJS: # of Public Inputs: 0
[INFO]  snarkJS: # of Labels: 5214
[INFO]  snarkJS: # of Outputs: 4
```

---

### B. Eligibility Security

#### Analysis
In the original implementation, `tokenBalance` was a private signal with:
```circom
signal input tokenBalance;
signal inv;
inv <-- tokenBalance != 0 ? 1 / tokenBalance : 0;
tokenBalance * inv === 1;
```
Because `tokenBalance` was not bound to any on-chain state, state root, or signature, any attacker could supply `tokenBalance = 1` and pass the circuit constraints. This rendered eligibility meaningless.

#### Remediated Architecture
The repository has been migrated to a **Merkle Tree Membership Model**:
- A Merkle tree of approved voter identity commitments is maintained.
- `identityCommitment = Poseidon(identitySecret)`.
- The circuit verifies:
  1. The prover knows private `identitySecret`.
  2. `identityCommitment` is included in the approved `merkleRoot` at depth 4 (16 demo voters).
  3. `nullifierHash = Poseidon(identitySecret, proposalId)` prevents double-voting per proposal.
  4. Binary vote: `vote * (vote - 1) === 0`.
  5. `voteCommitment = Poseidon(vote, salt)`.
- Tree depth parameter: Fixed at **depth = 4** (16 voters) for Google Colab and browser demonstration purposes.

---

### C. Solidity & Verifier Compatibility

#### Findings
- The original `contracts/Voting.sol` had a mismatched interface expecting `bytes proof` and `uint256[2] memory publicSignals`, whereas SnarkJS Groth16 verifiers expect unpacked coordinates `(uint[2] a, uint[2][2] b, uint[2] c, uint[4] input)`.
- `contracts/IVerifier.sol` did not match the generated `Groth16Verifier.sol`.

#### Remediation
- Generated `contracts/Verifier.sol` directly from `voting_final.zkey`.
- Updated `contracts/IVerifier.sol` to expect `uint256[4] calldata input`.
- Updated `Voting.sol` to provide both:
  - `voteWithProof(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[4] publicSignals)`
  - `vote(bytes proof, uint256[4] publicSignals)`
- Enforced strict on-chain validation:
  - `verifier != address(0)`
  - `poseidon != address(0)`
  - `approvedMerkleRoot != 0`
  - `submittedRoot == approvedMerkleRoot`
  - `submittedProposalId == proposalId`
  - `nullifierHash != 0`
  - `voteCommitment != 0`
  - `!usedNullifiers[nullifierHash]`
  - `verifier.verifyProof(a, b, c, publicSignals) == true`

---

### D. Privacy Claims & Relayer Reality

#### Findings
- `Voting.sol` emitted `event VoteCast(address indexed voter, uint256 voteCommitment)`. Emitting the `msg.sender` address completely broke the privacy-preserving flow.
- The frontend derived nullifiers via `keccak256(userAddress + proposalNonce)`, cryptographically linking nullifiers to Ethereum account addresses.

#### Remediation
- Replaced event with:
  ```solidity
  event VoteSubmitted(uint256 indexed nullifierHash, uint256 voteCommitment);
  ```
- Removed all wallet-derived nullifiers. Nullifiers are now computed from the private identity secret:
  `nullifierHash = Poseidon(identitySecret, proposalId)`.
- Disclosed transaction sender metadata reality:
  > The ZK proof hides the approved Merkle-tree identity leaf and vote choice during the commit phase. However, a direct public-chain transaction exposes the sender address and transaction metadata. A relayer may improve sender–voter unlinkability, but privacy depends on relayer architecture, funding flow, timing analysis, network metadata, and operational assumptions.

---

### E. Tally & Reveal Design

#### Honest Architecture
The repository implements a **two-phase Commit-Reveal model**:
1. **Voting Phase (Commitment)**:
   - The voter submits their ZK-SNARK proof with `voteCommitment` and `nullifierHash`.
   - The contract records `validCommitments[voteCommitment] = true` and `usedNullifiers[nullifierHash] = true`.
   - The vote choice remains concealed during the active voting window.
2. **Reveal Phase**:
   - The voter reveals `(voteOption, salt)`.
   - The contract verifies `poseidon.poseidon([voteOption, salt]) == computedCommitment` using an on-chain Poseidon(2) hasher deployed via `circomlibjs.poseidonContract`.
   - The contract checks `validCommitments[computedCommitment]` and ensures `!revealedCommitments[computedCommitment]`.
   - The tally (`votesForOption0` or `votesForOption1`) is incremented.

#### Documented Limitations
- Reveal transactions are public. Vote secrecy lasts through the commit/voting phase; after a valid reveal, the selected vote option becomes publicly observable.
- Users who cast a commitment but fail to submit a reveal are not counted in the final tally.
- Fully private real-time tallies without a reveal phase require homomorphic tallying or threshold decryption (e.g., ElGamal / MPC), which are outside the scope of this educational prototype.

---

### F. Benchmark Honesty

#### Findings
- The original `scripts/benchmark.js` and `README.md` contained synthetic entries for "NVIDIA RTX 4060 (CUDA / ICICLE) < 15 ms" and "Google Colab T4 < 30 ms".
- SnarkJS WASM runs on CPU threads by default and does not execute on GPU hardware without third-party acceleration provers.

#### Remediation
- Removed all fabricated GPU numbers.
- Benchmarked 10 actual iterations on the host CPU using the native 3530-constraint Merkle tree circuit.
- Generated `benchmark_results.json` and `benchmark_results.md` dynamically from empirical runs.
- Output explicit disclosure:
  `GPU proving: not configured; SnarkJS WASM benchmark executed on CPU.`

On the benchmarked host, the 3,530-constraint circuit generated proofs in an average of 152.44 ms across 10 Node.js/SnarkJS WASM iterations. Browser performance may vary by device, operating system, available memory, and browser implementation.

The benchmarked Node.js process used approximately 8.88 MB JavaScript heap and 544.59 MB resident memory (RSS). This is within the practical limits of an 8GB RAM development laptop, although browser memory use and performance may vary.

**Empirical Measured Results (10 Iterations):**
- **Circuit Constraints**: 3530
- **Average Proof Generation Time**: 152.44 ms
- **Average Verification Time**: 8.73 ms
- **Heap Memory Used**: 8.88 MB
- **Resident Set Size (RSS)**: 544.59 MB

---

### Groth16 Trusted Setup Notice

This repository uses a development-only Groth16 proving setup for reproducibility. The proving key and verifier must not be reused for production deployments unless a proper multi-party trusted setup ceremony is conducted and at least one participant securely destroys their toxic waste.

The current pot12 setup supports circuits up to 2^12 constraints. The current circuit has 3,530 constraints. If the circuit grows, the Powers of Tau parameter must be upgraded.

---

### Non-Goals

- Secure Identity Secret Management: This educational prototype does not provide production-grade identity-secret backup, recovery, anti-phishing protection, hardware-wallet integration, or encrypted secret storage. Identity secrets must never be stored in plaintext browser localStorage in a production system.

---

### G. Network Modernization (Polygon Amoy Migration)

#### Findings
- The codebase contained outdated network settings rather than the active Polygon Amoy testnet.
- Prior configurations required updating to the modern Amoy standard (Chain ID 80002, POL currency).

#### Remediation
- Fully migrated to **Polygon Amoy**:
  - **Chain ID**: `80002`
  - **RPC Endpoint**: `https://rpc-amoy.polygon.technology` (configurable via `AMOY_RPC_URL`)
  - **Block Explorer**: `https://amoy.polygonscan.com`
- Updated Hardhat configuration, deployment scripts, frontend wagmi configuration, and `.env.example`.
- Verified that Hardhat operates without requiring `.env` secrets during testing and local builds.

---

## Test & Validation Summary

| Test / Script | Scope | Result | Details |
| :--- | :--- | :--- | :--- |
| `npm ci` | Dependency integrity | PASS | Clean installation |
| `npx hardhat compile` | Solidity contracts | PASS | 5 contracts compiled successfully |
| `npx hardhat test` | Unit & Integration tests | PASS | **14 passing tests (2s)** |
| `node scripts/compileCircuit.js` | Circom 2.2 compilation | PASS | Generates R1CS, WASM, SYM |
| `snarkjs r1cs info circuits/build/voting.r1cs` | Constraint audit | PASS | **3530 constraints**, 3538 wires |
| `node scripts/setupGroth16.js` | Trusted setup ceremony | PASS | pot12 ceremony & Verifier.sol generated |
| `node scripts/generateProof.js` | Witness & Groth16 proof | PASS | Proof generated in ~150ms |
| `snarkjs groth16 verify` | SnarkJS CLI verification | PASS | `[INFO] snarkJS: OK!` |
| `node scripts/benchmark.js` | 10-iteration empirical benchmark | PASS | Results written to JSON and Markdown |
| `npm run build` (frontend) | Vite production bundle | PASS | Built in 11.7s without errors |
