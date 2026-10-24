// Purpose: Handles client-side Groth16 ZK proof generation, nullifier derivation, and proof ABI encoding.
import { useState, useCallback, useRef } from "react";
import { ethers } from "ethers";
import * as snarkjs from "snarkjs";

/**
 * Hook for generating Zero-Knowledge proofs directly in the voter's browser.
 */
export function useProof() {
  const [isProving, setIsProving] = useState(false);
  const [progress, setProgress] = useState("");
  const [proofData, setProofData] = useState(null);
  const [error, setError] = useState(null);

  // In-memory cache for WASM and zkey to prevent redundant HTTP downloads
  const cacheRef = useRef({ wasm: null, zkey: null });

  /**
   * Generates a Groth16 proof off-chain.
   * @param {string} userAddress - Connected Ethereum wallet address.
   * @param {number} voteChoice - 0 (Against) or 1 (For).
   * @param {number|string} tokenBalance - Eligibility balance (must be >= 1).
   */
  const generateZKProof = useCallback(
    async (userAddress, voteChoice, tokenBalance = "1") => {
      setIsProving(true);
      setError(null);
      setProgress("Initializing ZK proof generator...");

      try {
        if (!userAddress) {
          throw new Error("Wallet not connected. Please connect your wallet first.");
        }
        if (BigInt(tokenBalance) < 1n) {
          throw new Error("Insufficient tokens: Voter must hold at least 1 DAO token.");
        }
        if (voteChoice !== 0 && voteChoice !== 1) {
          throw new Error("Invalid vote choice: Must be binary 0 or 1.");
        }

        // 1. Deterministic Nullifier Derivation: SHA256(address + proposalSalt)
        // Decouples voter identity while strictly binding one ballot per wallet
        setProgress("Deriving cryptographic nullifier...");
        const proposalNonce = "PRAGMA_MUMBAI_DAO_PROPOSAL_1";
        const nullifierHex = ethers.keccak256(
          ethers.toUtf8Bytes(userAddress.toLowerCase() + proposalNonce)
        );
        // Convert to BigInt within BN128 scalar field
        const bn128Modulus = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
        const nullifier = (BigInt(nullifierHex) % bn128Modulus).toString();

        // 2. Generate random 256-bit blinding salt to conceal the vote choice
        setProgress("Blinding ballot with random entropy...");
        const randomSaltBytes = ethers.randomBytes(31);
        const salt = (BigInt(ethers.hexlify(randomSaltBytes)) % bn128Modulus).toString();

        const circuitInput = {
          nullifier: nullifier,
          vote: voteChoice.toString(),
          tokenBalance: tokenBalance.toString(),
          salt: salt,
        };

        setProgress("Generating Groth16 witness and proof via WASM...");

        // Fetch or read from cache
        if (!cacheRef.current.wasm || !cacheRef.current.zkey) {
          setProgress("Loading circuit WASM and proving key into memory...");
          const resWasm = await fetch("/circuits/voting.wasm");
          const resZkey = await fetch("/circuits/voting_final.zkey");

          if (!resWasm.ok || !resZkey.ok) {
            throw new Error("Could not load /circuits/voting.wasm or /circuits/voting_final.zkey from server.");
          }

          cacheRef.current.wasm = new Uint8Array(await resWasm.arrayBuffer());
          cacheRef.current.zkey = new Uint8Array(await resZkey.arrayBuffer());
        }

        setProgress("Executing cryptographic proof generation in browser WASM...");
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          circuitInput,
          cacheRef.current.wasm,
          cacheRef.current.zkey
        );

        // 3. Format into ABI-encoded bytes payload for Voting.sol
        setProgress("Encoding Solidity calldata...");
        const a = [proof.pi_a[0], proof.pi_a[1]];
        const b = [
          [proof.pi_b[0][1], proof.pi_b[0][0]],
          [proof.pi_b[1][1], proof.pi_b[1][0]],
        ];
        const c = [proof.pi_c[0], proof.pi_c[1]];

        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const encodedProofBytes = abiCoder.encode(
          ["uint256[2]", "uint256[2][2]", "uint256[2]"],
          [a, b, c]
        );

        const resultData = {
          proofBytes: encodedProofBytes,
          nullifierHash: publicSignals[0],
          voteCommitment: publicSignals[1],
          voteChoice,
          salt,
          rawProof: proof,
        };

        setProofData(resultData);
        setProgress("ZK proof successfully generated.");
        setIsProving(false);
        return resultData;
      } catch (err) {
        console.error("Proof generation failed:", err);
        setError(err.message || "Failed to generate Zero-Knowledge proof.");
        setIsProving(false);
        throw err;
      }
    },
    []
  );

  return {
    generateZKProof,
    isProving,
    progress,
    proofData,
    error,
    resetProof: () => {
      setProofData(null);
      setError(null);
      setProgress("");
    },
  };
}
