import React, { useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { useProof } from "../hooks/useProof";
import { useVoting } from "../hooks/useVoting";
import { ProofGenerator } from "./ProofGenerator";

export function VotingInterface() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const [voterIndex, setVoterIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null); // 0 or 1
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [revealSuccess, setRevealSuccess] = useState(false);

  const { generateZKProof, isProving, progress, proofData, error: proofError, resetProof } =
    useProof();
  const { castVote, revealVote, isSubmitting, txHash, txError } = useVoting();

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    resetProof();
    setSubmissionSuccess(false);
    setRevealSuccess(false);
  };

  const handleSubmitVote = async () => {
    if (selectedOption === null) return;

    try {
      setSubmissionSuccess(false);
      setRevealSuccess(false);

      // 1. Generate client-side Groth16 proof using Merkle tree membership
      const proofResult = await generateZKProof(voterIndex, selectedOption);

      // 2. Submit proof to Voting.sol on Polygon Amoy
      await castVote(proofResult.proofBytes, proofResult.publicSignals);

      setSubmissionSuccess(true);
    } catch (err) {
      console.error("Ballot submission error:", err);
    }
  };

  const handleRevealVote = async () => {
    if (!proofData) return;

    try {
      setRevealSuccess(false);
      await revealVote(proofData.voteChoice, proofData.salt);
      setRevealSuccess(true);
    } catch (err) {
      console.error("Ballot reveal error:", err);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-8 max-w-3xl mx-auto shadow-2xl border border-slate-800">
      {/* Privacy & Relayer Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs mb-6">
        <span className="font-bold block text-sm mb-0.5">Privacy Notice</span>
        <span>Demo mode: transaction sender is public unless submitted through a relayer.</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-darkBorder mb-6">
        <div>
          <span className="text-xs font-mono font-medium text-brand-400 uppercase tracking-wider">
            Active Governance Ballot (Polygon Amoy)
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-white mt-1">
            Cast Anonymous DAO Ballot
          </h2>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2">
          <span className="text-xs text-slate-400">Eligibility:</span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-semibold border border-emerald-500/30">
            Merkle Membership (Depth 4)
          </span>
        </div>
      </div>

      {/* Demo Voter Identity Selector */}
      <div className="p-4 rounded-xl bg-darkCard border border-darkBorder mb-6 space-y-2 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-slate-200 block">Voter Identity Selection:</span>
            <span className="text-slate-400">
              Voter proves membership in the approved Merkle tree without revealing their identity leaf.
            </span>
          </div>
          <select
            value={voterIndex}
            onChange={(e) => {
              setVoterIndex(Number(e.target.value));
              resetProof();
              setSubmissionSuccess(false);
              setRevealSuccess(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-brand-500"
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <option key={i} value={i}>
                Voter #{i + 1} (Leaf Index {i})
              </option>
            ))}
          </select>
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
            Vote in favor of approving the treasury allocation for Pragma Mumbai builder grants.
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
            Vote against the proposal and retain funds in the community treasury.
          </p>
        </div>
      </div>

      {/* Action Buttons: Cast Ballot & Reveal Ballot */}
      <div className="space-y-3">
        <button
          disabled={isConnected && (selectedOption === null || isProving || isSubmitting)}
          onClick={() => {
            if (!isConnected) {
              if (typeof window !== "undefined" && !window.ethereum) {
                alert("MetaMask (or a compatible Web3 wallet) was not detected in this browser window.\n\nPlease install MetaMask from https://metamask.io.");
                return;
              }
              const preferred =
                connectors.find((c) => c.id === "metaMask" || c.name.toLowerCase().includes("metamask")) ||
                connectors[0];
              if (preferred) connect({ connector: preferred });
              return;
            }
            handleSubmitVote();
          }}
          className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center space-x-2 transition-all transform ${
            isConnected && (selectedOption === null || isProving || isSubmitting)
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-gradient-to-r from-brand-600 via-zkPurple-600 to-brand-500 hover:from-brand-500 hover:to-zkPurple-500 text-white shadow-xl shadow-brand-500/25 hover:-translate-y-0.5"
          }`}
        >
          {isProving ? (
            <span>Computing Client-Side ZK-Proof (WASM)...</span>
          ) : isSubmitting ? (
            <span>Submitting to Polygon Amoy...</span>
          ) : !isConnected ? (
            <span>Connect Wallet to Vote</span>
          ) : selectedOption === null ? (
            <span>Select an Option Above</span>
          ) : (
            <span>1. Generate ZK Proof & Submit Private Ballot</span>
          )}
        </button>

        {submissionSuccess && proofData && !revealSuccess && (
          <button
            disabled={isSubmitting}
            onClick={handleRevealVote}
            className="w-full py-3.5 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2"
          >
            <span>2. Reveal Ballot & Increment Tally On-Chain</span>
          </button>
        )}
      </div>

      {/* Proof Generation Inspector */}
      <ProofGenerator
        isProving={isProving}
        progress={progress}
        proofData={proofData}
        error={proofError}
      />

      {/* Error Alert */}
      {txError && (
        <div className="mt-4 p-4 rounded-xl bg-red-950/30 border border-red-500/40 text-xs text-red-200">
          <span className="font-semibold block">Submission Error:</span>
          <span>{txError}</span>
        </div>
      )}

      {/* Success Alerts */}
      {submissionSuccess && (
        <div className="mt-4 p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200">
          <span className="font-bold text-sm text-emerald-300 block mb-1">
            Private Ballot Submitted Successfully
          </span>
          <p className="text-slate-300">
            Your Groth16 zk-SNARK proof and vote commitment have been verified on Polygon Amoy.
          </p>
          {txHash && (
            <a
              href={`https://amoy.polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 font-mono text-brand-400 hover:underline"
            >
              View on Polygonscan Amoy
            </a>
          )}
        </div>
      )}

      {revealSuccess && (
        <div className="mt-4 p-5 rounded-2xl bg-purple-950/30 border border-purple-500/40 text-xs text-purple-200">
          <span className="font-bold text-sm text-purple-300 block mb-1">
            Ballot Revealed and Tallied
          </span>
          <p className="text-slate-300">
            On-chain Poseidon verified your commitment matching (vote, salt), updating the public tally.
          </p>
        </div>
      )}
    </div>
  );
}
