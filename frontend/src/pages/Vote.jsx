// Purpose: Main Voting Page presenting the DAO proposal and voting interface.
import React from "react";
import { VotingInterface } from "../components/VotingInterface";

export function Vote() {
  return (
    <div className="py-8 px-4 max-w-6xl mx-auto space-y-8">
      {/* Hero Proposal Header */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-darkBorder relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Active Proposal
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
            PIP-42
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
            ZK-SNARK Groth16 Ballot
          </span>
        </div>

        <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
          PIP-42: Fund Pragma Mumbai Zero-Knowledge Developer Grants
        </h1>

        <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-3xl mb-6">
          Community proposal to fund developer grants for builders creating privacy-preserving
          zero-knowledge tooling at Pragma Mumbai. Ballot choices are blinded with Groth16 zk-SNARK
          commitments and voter eligibility is verified via Merkle tree membership.
        </p>

        {/* 3 Privacy & Cryptographic Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-darkBorder/60 text-xs">
          <div className="flex items-start space-x-2.5">
            <div>
              <span className="font-semibold text-slate-200 block">Merkle Membership</span>
              <span className="text-slate-400">Voter proves presence in approved tree without revealing leaf index</span>
            </div>
          </div>

          <div className="flex items-start space-x-2.5">
            <div>
              <span className="font-semibold text-slate-200 block">Double-Voting Immune</span>
              <span className="text-slate-400">Cryptographic nullifiers strictly enforce 1 voter = 1 vote per proposal</span>
            </div>
          </div>

          <div className="flex items-start space-x-2.5">
            <div>
              <span className="font-semibold text-slate-200 block">Groth16 Verification</span>
              <span className="text-slate-400">3530 R1CS constraints verified on-chain via Alt-BN128 pairing</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Voting Interface */}
      <VotingInterface />
    </div>
  );
}
