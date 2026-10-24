// Purpose: Voting choice selector and transaction submission interface.
import React, { useState } from "react";
import { useAccount } from "wagmi";
import { useProof } from "../hooks/useProof";
import { useVoting } from "../hooks/useVoting";
import { ProofGenerator } from "./ProofGenerator";

export function VotingInterface() {
  const { address, isConnected } = useAccount();
  const [selectedOption, setSelectedOption] = useState(null); // 0 or 1
  const [tokenBalance, setTokenBalance] = useState("1");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const { generateZKProof, isProving, progress, proofData, error: proofError, resetProof } =
    useProof();
  const { castAndReveal, isSubmitting, txHash, txError } = useVoting();

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    resetProof();
    setSubmissionSuccess(false);
  };

  const handleVoteSubmission = async () => {
    if (selectedOption === null) return;

    try {
      setSubmissionSuccess(false);
      // 1. Generate client-side Groth16 proof
      const proofResult = await generateZKProof(address, selectedOption, tokenBalance);

      // 2. Submit proof to Voting.sol on Polygon Mumbai
      await castAndReveal(
        proofResult.proofBytes,
        proofResult.nullifierHash,
        proofResult.voteCommitment,
        selectedOption
      );

      setSubmissionSuccess(true);
    } catch (err) {
      console.error("Vote process encountered error:", err);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-8 max-w-3xl mx-auto shadow-2xl border border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-darkBorder mb-6">
        <div>
          <span className="text-xs font-mono font-medium text-brand-400 uppercase tracking-wider">
            Active Governance Ballot
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-white mt-1">
            Cast Anonymous DAO Ballot
          </h2>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2">
          <span className="text-xs text-slate-400">Eligibility:</span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-semibold border border-emerald-500/30">
            Min 1 Token Required
          </span>
        </div>
      </div>

      {/* Vote Option Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Option 1: FOR */}
        <div
          onClick={() => handleOptionSelect(1)}
          className={`cursor-pointer rounded-2xl p-5 border-2 transition-all transform hover:-translate-y-1 ${
            selectedOption === 1
              ? "bg-emerald-950/30 border-emerald-500 shadow-lg shadow-emerald-500/20"
              : "bg-darkCard/70 border-darkBorder hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
              1
            </span>
            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                selectedOption === 1
                  ? "border-emerald-400 bg-emerald-400 text-black font-bold text-xs"
                  : "border-slate-600"
              }`}
            >
              {selectedOption === 1 && "Y"}
            </div>
          </div>
          <h3 className="font-bold text-base text-white">Option 1: YEA (Support)</h3>
          <p className="text-xs text-slate-400 mt-1">
            Vote in favor of approving the PIP-42 treasury grant allocation.
          </p>
        </div>

        {/* Option 0: AGAINST */}
        <div
          onClick={() => handleOptionSelect(0)}
          className={`cursor-pointer rounded-2xl p-5 border-2 transition-all transform hover:-translate-y-1 ${
            selectedOption === 0
              ? "bg-rose-950/30 border-rose-500 shadow-lg shadow-rose-500/20"
              : "bg-darkCard/70 border-darkBorder hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              0
            </span>
            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                selectedOption === 0
                  ? "border-rose-400 bg-rose-400 text-black font-bold text-xs"
                  : "border-slate-600"
              }`}
            >
              {selectedOption === 0 && "N"}
            </div>
          </div>
          <h3 className="font-bold text-base text-white">Option 0: NAY (Oppose)</h3>
          <p className="text-xs text-slate-400 mt-1">
            Vote against the proposal and retain existing treasury funds.
          </p>
        </div>
      </div>

      {/* Voter Eligibility Settings */}
      <div className="p-4 rounded-xl bg-darkCard border border-darkBorder mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="font-medium text-slate-300 block">Simulated Token Balance:</span>
          <span className="text-slate-500">
            Verified inside the ZK witness: circuit enforces (tokenBalance &gt;= 1)
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            min="0"
            value={tokenBalance}
            onChange={(e) => setTokenBalance(e.target.value)}
            className="w-20 px-3 py-1.5 rounded-lg bg-black/50 border border-slate-700 text-white font-mono text-center focus:outline-none focus:border-brand-500"
          />
          <span className="text-slate-400 font-mono">VOTE CREDITS</span>
        </div>
      </div>

      {/* Main Action Button */}
      <button
        disabled={selectedOption === null || !isConnected || isProving || isSubmitting}
        onClick={handleVoteSubmission}
        className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center space-x-2 transition-all transform ${
          selectedOption === null || !isConnected || isProving || isSubmitting
            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
            : "bg-gradient-to-r from-brand-600 via-zkPurple-600 to-brand-500 hover:from-brand-500 hover:to-zkPurple-500 text-white shadow-xl shadow-brand-500/25 hover:-translate-y-0.5"
        }`}
      >
        {isProving ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Computing Client-Side ZK-Proof...</span>
          </>
        ) : isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Submitting to Polygon Mumbai...</span>
          </>
        ) : !isConnected ? (
          <span>Connect Wallet to Vote</span>
        ) : selectedOption === null ? (
          <span>Select an Option Above</span>
        ) : (
          <span>Generate ZK Proof and Cast Private Ballot</span>
        )}
      </button>

      {/* Proof Generation Inspection Component */}
      <ProofGenerator
        isProving={isProving}
        progress={progress}
        proofData={proofData}
        error={proofError}
      />

      {/* Transaction Error Alerts */}
      {txError && (
        <div className="mt-4 p-4 rounded-xl bg-red-950/30 border border-red-500/40 text-xs text-red-200 flex items-start space-x-2">
          <div>
            <span className="font-semibold block">Submission Error:</span>
            <span>{txError}</span>
          </div>
        </div>
      )}

      {/* Transaction Success Alert */}
      {submissionSuccess && (
        <div className="mt-4 p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200">
          <div className="flex items-center space-x-2 font-bold text-sm text-emerald-300 mb-1">
            <span>Private Ballot Successfully Cast</span>
          </div>
          <p className="text-slate-300">
            Your vote has been verified by the Groth16 Verifier on Polygon Mumbai without disclosing your wallet or vote choice.
          </p>
          {txHash && (
            <a
              href={`https://mumbai.polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 font-mono text-brand-400 hover:underline"
            >
              View on Polygonscan
            </a>
          )}
        </div>
      )}
    </div>
  );
}
