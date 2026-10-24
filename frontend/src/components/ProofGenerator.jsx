// Purpose: Renders the client-side cryptographic proof generation pipeline status.
import React from "react";

export function ProofGenerator({ isProving, progress, proofData, error }) {
  if (!isProving && !proofData && !error) return null;

  return (
    <div className="mt-6 p-5 rounded-2xl glass-panel border border-brand-500/20 relative overflow-hidden transition-all">
      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2.5">
          {isProving ? (
            <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"></div>
          ) : error ? (
            <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs">
              [X]
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              [OK]
            </div>
          )}
          <h4 className="text-sm font-semibold text-slate-200">
            {isProving
              ? "Generating Zero-Knowledge Proof (WASM Groth16)"
              : error
              ? "Proof Generation Failed"
              : "Zero-Knowledge Proof Ready"}
          </h4>
        </div>
        <span className="text-xs font-mono text-slate-400">BN128 / Alt-BN128</span>
      </div>

      {progress && (
        <p className="text-xs text-brand-300 font-mono mb-3 bg-brand-950/40 px-3 py-1.5 rounded-lg border border-brand-800/40">
          Status: {progress}
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
          {error}
        </div>
      )}

      {proofData && !isProving && (
        <div className="space-y-3 pt-2 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-darkCard/90 border border-darkBorder">
              <span className="text-slate-400 block mb-1 font-medium">[0] Merkle Root:</span>
              <p className="font-mono text-brand-400 break-all text-[11px]">
                {proofData.merkleRoot}
              </p>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Public Signal 1: Verified against approved governance tree
              </span>
            </div>

            <div className="p-3 rounded-xl bg-darkCard/90 border border-darkBorder">
              <span className="text-slate-400 block mb-1 font-medium">[1] Proposal ID:</span>
              <p className="font-mono text-cyan-400 break-all text-[11px]">
                {proofData.proposalId}
              </p>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Public Signal 2: Binds ballot to target proposal
              </span>
            </div>

            <div className="p-3 rounded-xl bg-darkCard/90 border border-darkBorder">
              <span className="text-slate-400 block mb-1 font-medium">[2] Nullifier Hash:</span>
              <p className="font-mono text-emerald-400 break-all text-[11px]">
                {proofData.nullifierHash}
              </p>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Public Signal 3: Recorded on-chain to prevent double-voting
              </span>
            </div>

            <div className="p-3 rounded-xl bg-darkCard/90 border border-darkBorder">
              <span className="text-slate-400 block mb-1 font-medium">[3] Vote Commitment:</span>
              <p className="font-mono text-purple-400 break-all text-[11px]">
                {proofData.voteCommitment}
              </p>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Public Signal 4: Blinds ballot choice until reveal
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-300">
            <span>Identity secret & ballot choice concealed inside zk-SNARK witness</span>
            <span className="font-mono font-semibold">Groth16 Verified</span>
          </div>
        </div>
      )}
    </div>
  );
}
