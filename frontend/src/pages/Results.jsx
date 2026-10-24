// Purpose: Real-time DAO voting results dashboard with live tallies, percentage splits, and audit metrics.
import React from "react";
import { useVoting } from "../hooks/useVoting";

export function Results() {
  const { votesForOption0, votesForOption1, totalVotes, isLoadingResults, refetchResults, votingAddress } =
    useVoting();

  const totalCalculated = votesForOption0 + votesForOption1;
  const pctFor = totalCalculated > 0 ? ((votesForOption1 / totalCalculated) * 100).toFixed(1) : 0;
  const pctAgainst = totalCalculated > 0 ? ((votesForOption0 / totalCalculated) * 100).toFixed(1) : 0;

  return (
    <div className="py-8 px-4 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-medium text-brand-400 uppercase tracking-wider">
            Governance Dashboard
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            Real-Time Voting Results
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tallies verified by on-chain zk-SNARK Groth16 Verifier
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => refetchResults()}
            className="px-4 py-2 rounded-xl bg-darkCard border border-darkBorder hover:border-slate-600 text-xs font-medium text-slate-300 flex items-center space-x-2 transition-colors"
          >
            <span>{isLoadingResults ? "Refreshing..." : "Refresh Tally"}</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-darkBorder">
          <span className="text-xs text-slate-400 font-medium">Total Ballots Cast</span>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white font-mono">{totalVotes}</span>
            <span className="text-xs text-emerald-400 font-medium">zk-Verified</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-darkBorder">
          <span className="text-xs text-emerald-400 font-medium">Option 1: YEA (For)</span>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">{votesForOption1}</span>
            <span className="text-xs text-slate-400 font-mono">({pctFor}%)</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-darkBorder">
          <span className="text-xs text-rose-400 font-medium">Option 0: NAY (Against)</span>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-rose-400 font-mono">{votesForOption0}</span>
            <span className="text-xs text-slate-400 font-mono">({pctAgainst}%)</span>
          </div>
        </div>
      </div>

      {/* Visual Percentage Progress Bar */}
      <div className="glass-panel p-6 rounded-3xl border border-darkBorder space-y-4">
        <div className="flex justify-between items-center text-sm font-semibold">
          <span className="text-emerald-400 flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span>Support: {pctFor}%</span>
          </span>
          <span className="text-rose-400 flex items-center space-x-1.5">
            <span>Oppose: {pctAgainst}%</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
          </span>
        </div>

        {/* Progress Track */}
        <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${pctFor}%` }}
            className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-700 ease-out"
          ></div>
          <div
            style={{ width: `${pctAgainst}%` }}
            className="bg-gradient-to-r from-rose-500 to-rose-400 h-full transition-all duration-700 ease-out"
          ></div>
        </div>

        <div className="flex justify-between text-xs text-slate-400 font-mono pt-1">
          <span>{votesForOption1} Votes</span>
          <span>{votesForOption0} Votes</span>
        </div>
      </div>

      {/* Contract and Zero-Knowledge Verification Audit Details */}
      <div className="glass-panel p-6 rounded-3xl border border-darkBorder">
        <h3 className="font-bold text-base text-white mb-3">On-Chain Verification Audit</h3>
        <div className="space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-darkCard border border-darkBorder">
            <span className="text-slate-400">Deployed Voting Contract:</span>
            <span className="font-mono text-brand-300 break-all">{votingAddress}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-darkCard border border-darkBorder">
            <span className="text-slate-400">Circuit Constraints:</span>
            <span className="font-mono text-slate-200">434 Constraints (Poseidon BN128)</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-darkCard border border-darkBorder">
            <span className="text-slate-400">Proof System:</span>
            <span className="font-mono text-slate-200">Groth16 zk-SNARK (Alt-BN128 Pairing)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
