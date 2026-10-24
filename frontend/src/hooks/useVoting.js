// Purpose: React hook for smart contract interactions with Voting.sol using Wagmi v2 and Viem.
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
      refetchInterval: 4000, // Poll every 4 seconds
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
   * Cast a private vote ballot on Polygon Mumbai.
   */
  const castVote = useCallback(
    async (proofBytes, nullifierHash, voteCommitment) => {
      setIsSubmitting(true);
      setTxError(null);
      setTxHash(null);

      try {
        if (!isConnected) {
          throw new Error("Please connect your wallet to submit a vote.");
        }

        const hash = await writeContractAsync({
          address: VOTING_CONTRACT_ADDRESS,
          abi: VOTING_ABI,
          functionName: "vote",
          args: [proofBytes, BigInt(nullifierHash), BigInt(voteCommitment)],
        });

        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        await refetchResults();
        await refetchTotal();
        setIsSubmitting(false);
        return hash;
      } catch (err) {
        console.error("Contract vote execution error:", err);
        let friendlyMessage = err.message || "Failed to submit vote.";
        if (friendlyMessage.includes("AlreadyVoted")) {
          friendlyMessage = "Double-voting detected: This wallet has already cast a vote!";
        } else if (friendlyMessage.includes("InvalidProof")) {
          friendlyMessage = "Verification failed: The submitted zk-SNARK proof was rejected by the verifier.";
        }
        setTxError(friendlyMessage);
        setIsSubmitting(false);
        throw new Error(friendlyMessage);
      }
    },
    [isConnected, writeContractAsync, publicClient, refetchResults, refetchTotal]
  );

  /**
   * Cast ballot and immediately tally it in one atomic transaction.
   */
  const castAndReveal = useCallback(
    async (proofBytes, nullifierHash, voteCommitment, voteOption) => {
      setIsSubmitting(true);
      setTxError(null);
      setTxHash(null);

      try {
        if (!isConnected) {
          throw new Error("Please connect your wallet to submit a vote.");
        }

        const hash = await writeContractAsync({
          address: VOTING_CONTRACT_ADDRESS,
          abi: VOTING_ABI,
          functionName: "castAndRevealVote",
          args: [
            proofBytes,
            BigInt(nullifierHash),
            BigInt(voteCommitment),
            BigInt(voteOption),
          ],
        });

        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        await refetchResults();
        await refetchTotal();
        setIsSubmitting(false);
        return hash;
      } catch (err) {
        console.error("Contract castAndReveal error:", err);
        let friendlyMessage = err.message || "Failed to cast and reveal vote.";
        if (friendlyMessage.includes("AlreadyVoted")) {
          friendlyMessage = "Double-voting detected: This wallet has already cast a vote!";
        } else if (friendlyMessage.includes("InvalidProof")) {
          friendlyMessage = "Verification failed: The zk-SNARK proof is invalid.";
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

  /**
   * Mock eligibility verification (in a production DAO, this queries token balance).
   */
  const checkEligibility = useCallback(async (userAddress) => {
    if (!userAddress) return { isEligible: false, balance: 0 };
    // In our system, all connected addresses in the demo hold 1 voting credit
    return { isEligible: true, balance: 1 };
  }, []);

  const votesForOption0 = resultsData ? Number(resultsData[0]) : 0;
  const votesForOption1 = resultsData ? Number(resultsData[1]) : 0;
  const totalVotes = totalVotesData ? Number(totalVotesData) : votesForOption0 + votesForOption1;

  return {
    castVote,
    castAndReveal,
    checkIfVoted,
    checkEligibility,
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
