// Purpose: Client-side Groth16 ZK proof generation using Merkle tree membership.
import { useState, useCallback, useRef } from "react";
import { ethers } from "ethers";
import * as snarkjs from "snarkjs";
import { getDemoMerkleTree } from "../config/merkle";
import { APPROVED_MERKLE_ROOT, PROPOSAL_ID } from "../config/contracts";

export function useProof() {
  const [isProving, setIsProving] = useState(false);
  const [progress, setProgress] = useState("");
  const [proofData, setProofData] = useState(null);
  const [error, setError] = useState(null);

  // In-memory cache for WASM and zkey to avoid redundant network requests
  const cacheRef = useRef({ wasm: null, zkey: null });

  /**
   * Generates a Groth16 proof off-chain.
   * @param {number} voterIndex - Demo voter index (0 to 15).
   * @param {number} voteChoice - 0 (Against / Nay) or 1 (For / Yea).
   */
  const generateZKProof = useCallback(
    async (voterIndex, voteChoice) => {
      setIsProving(true);
      setError(null);
      setProgress("Initializing ZK proof generator...");

      try {
        if (voteChoice !== 0 && voteChoice !== 1) {
          throw new Error("Invalid vote choice: Must be binary 0 (Nay) or 1 (Yea).");
        }

        // 1. Fetch Merkle tree and proof for the selected voter
        setProgress("Calculating Merkle tree path for voter identity...");
        const { tree, secrets, root } = await getDemoMerkleTree();
        const voterSecret = secrets[voterIndex];
        if (!voterSecret) {
          throw new Error(`Voter index ${voterIndex} not found in approved registry.`);
        }

        const { merkleProof, merklePathIndices } = tree.getProof(voterIndex);

        // 2. Generate random 256-bit blinding salt for ballot commitment
        setProgress("Generating random ballot blinding salt...");
        const bn128Modulus =
          21888242871839275222246405745257275088548364400416034343698204186575808495617n;
        const randomSaltBytes = ethers.randomBytes(31);
        const salt = (BigInt(ethers.hexlify(randomSaltBytes)) % bn128Modulus).toString();

        const circuitInput = {
          root: root,
          proposal: PROPOSAL_ID.toString(),
          identitySecret: voterSecret,
          merkleProof: merkleProof,
          merklePathIndices: merklePathIndices,
          vote: voteChoice.toString(),
          salt: salt,
        };

        // 3. Load WASM and zkey
        if (!cacheRef.current.wasm || !cacheRef.current.zkey) {
          setProgress("Fetching circuit WASM and proving key...");
          const [resWasm, resZkey] = await Promise.all([
            fetch("/circuits/voting.wasm"),
            fetch("/circuits/voting_final.zkey"),
          ]);

          if (!resWasm.ok || !resZkey.ok) {
            throw new Error(
              "Could not load circuit artifacts from /circuits/voting.wasm or /circuits/voting_final.zkey."
            );
          }

          cacheRef.current.wasm = new Uint8Array(await resWasm.arrayBuffer());
          cacheRef.current.zkey = new Uint8Array(await resZkey.arrayBuffer());
        }

        // 4. Compute Groth16 witness and proof in WASM
        setProgress("Computing Groth16 witness and proof in browser WASM...");
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          circuitInput,
          cacheRef.current.wasm,
          cacheRef.current.zkey
        );

        // 5. Format proof coordinates into Solidity arrays
        setProgress("Formatting Solidity calldata...");
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
          a,
          b,
          c,
          proofBytes: encodedProofBytes,
          publicSignals: publicSignals, // [merkleRoot, proposalId, nullifierHash, voteCommitment]
          merkleRoot: publicSignals[0],
          proposalId: publicSignals[1],
          nullifierHash: publicSignals[2],
          voteCommitment: publicSignals[3],
          voteChoice,
          salt,
          voterIndex,
          rawProof: proof,
        };

        setProofData(resultData);
        setProgress("ZK proof successfully generated.");
        setIsProving(false);
        return resultData;
      } catch (err) {
        console.error("Proof generation error:", err);
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
