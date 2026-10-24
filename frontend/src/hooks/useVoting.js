// Purpose: Smart contract interactions with Voting.sol using Wagmi v2 and Viem.
import { useState, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { VOTING_CONTRACT_ADDRESS, VOTING_ABI } from "../config/contracts";

export function useVoting() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [txHash, setTxHash] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txError, setTxError] = useState(null);

  // 1. Fetch real-time aggregate voting results
  const {
    data: resultsData,
    refetch: refetchResults,
    isLoading: isLoadingResults,
  } = useReadContract({
    address: VOTING_CONTRACT_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getResults",
    query: {
      refetchInterval: 4000,
    },
  });

  // 2. Fetch total count of ballots
  const { data: totalVotesData, refetch: refetchTotal } = useReadContract({
    address: VOTING_CONTRACT_ADDRESS,
    abi: VOTING_ABI,
    functionName: "totalVotesCast",
    query: {
      refetchInterval: 4000,
    },
  });

  /**
   * Cast a private vote ballot on Polygon Amoy.
   * @param {string} proofBytes - ABI-encoded proof bytes.
   * @param {Array<string>} publicSignals - [merkleRoot, proposalId, nullifierHash, voteCommitment].
   */
  const castVote = useCallback(
    async (proofBytes, publicSignals) => {
      setIsSubmitting(true);
      setTxError(null);
      setTxHash(null);

      try {
        if (!isConnected) {
          throw new Error("Please connect your wallet to submit a vote.");
        }

        const formattedSignals = publicSignals.map((s) => BigInt(s));

        const hash = await writeContractAsync({
          address: VOTING_CONTRACT_ADDRESS,
          abi: VOTING_ABI,
          functionName: "vote",
          args: [proofBytes, formattedSignals],
        });

        setTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        await refetchResults();
        await refetchTotal();
        setIsSubmitting(false);
        return hash;
      } catch (err) {
        console.error("Contract vote execution error:", err);
        let friendlyMessage = err.message || "Failed to submit vote.";
        if (friendlyMessage.includes("AlreadyVoted")) {
          friendlyMessage = "Double-voting rejected: This nullifier has already been consumed.";
        } else if (friendlyMessage.includes("InvalidProof")) {
          friendlyMessage = "Verification failed: Groth16 verifier rejected the proof.";
        } else if (friendlyMessage.includes("InvalidMerkleRoot")) {
          friendlyMessage = "Merkle verification failed: Proof root does not match approved governance root.";
        } else if (friendlyMessage.includes("InvalidProposalId")) {
          friendlyMessage = "Proposal mismatch: Ballot is for a different proposal ID.";
        }
        setTxError(friendlyMessage);
        setIsSubmitting(false);
        throw new Error(friendlyMessage);
      }
    },
    [isConnected, writeContractAsync, publicClient, refetchResults, refetchTotal]
  );

  /**
   * Reveal a previously submitted vote commitment on Polygon Amoy.
   * @param {number} voteOption - 0 (Against / Nay) or 1 (For / Yea).
   * @param {string|bigint} salt - The blinding salt used in the ballot.
   */
  const revealVote = useCallback(
    async (voteOption, salt) => {
      setIsSubmitting(true);
      setTxError(null);
      setTxHash(null);

      try {
        if (!isConnected) {
          throw new Error("Please connect your wallet to reveal your ballot.");
        }

        const hash = await writeContractAsync({
          address: VOTING_CONTRACT_ADDRESS,
          abi: VOTING_ABI,
          functionName: "revealVote",
          args: [BigInt(voteOption), BigInt(salt)],
        });

        setTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        await refetchResults();
        await refetchTotal();
        setIsSubmitting(false);
        return hash;
      } catch (err) {
        console.error("Contract revealVote error:", err);
        let friendlyMessage = err.message || "Failed to reveal ballot.";
        if (friendlyMessage.includes("CommitmentNotFound")) {
          friendlyMessage = "Commitment not found: Computed Poseidon(vote, salt) was never submitted.";
        } else if (friendlyMessage.includes("AlreadyRevealed")) {
          friendlyMessage = "Double-counting prevented: This vote commitment has already been revealed.";
        } else if (friendlyMessage.includes("InvalidVoteOption")) {
          friendlyMessage = "Invalid vote option: Must be 0 or 1.";
        }
        setTxError(friendlyMessage);
        setIsSubmitting(false);
        throw new Error(friendlyMessage);
      }
    },
    [isConnected, writeContractAsync, publicClient, refetchResults, refetchTotal]
  );

  /**
   * Check if a specific nullifier hash has already been used on-chain.
   */
  const checkIfVoted = useCallback(
    async (nullifierHash) => {
      if (!publicClient || !nullifierHash) return false;
      try {
        const isUsed = await publicClient.readContract({
          address: VOTING_CONTRACT_ADDRESS,
          abi: VOTING_ABI,
          functionName: "isNullifierUsed",
          args: [BigInt(nullifierHash)],
        });
        return isUsed;
      } catch (e) {
        console.warn("Could not check nullifier status:", e);
        return false;
      }
    },
    [publicClient]
  );

  const votesForOption0 = resultsData ? Number(resultsData[0]) : 0;
  const votesForOption1 = resultsData ? Number(resultsData[1]) : 0;
  const totalVotes = totalVotesData ? Number(totalVotesData) : votesForOption0 + votesForOption1;

  return {
    castVote,
    revealVote,
    checkIfVoted,
    refetchResults,
    votesForOption0,
    votesForOption1,
    totalVotes,
    isLoadingResults,
    isSubmitting,
    txHash,
    txError,
    votingAddress: VOTING_CONTRACT_ADDRESS,
  };
}
