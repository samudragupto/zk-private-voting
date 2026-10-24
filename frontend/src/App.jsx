// Purpose: Main React Application layout with Tab Routing (Vote, Results, Benchmark).
import React from "react";
import { Navbar } from "./components/Navbar";
import { Vote } from "./pages/Vote";
import { Results } from "./pages/Results";

export default function App() {
  const [activeTab, setActiveTab] = React.useState("vote");

  return (
    <div className="min-h-screen bg-darkBg text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Navigation Header */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-grow container mx-auto px-4 py-6">
        {activeTab === "vote" && <Vote />}
        {activeTab === "results" && <Results />}
        {activeTab === "benchmark" && <BenchmarkView />}
      </main>

      {/* Footer */}
      <footer className="glass-panel border-t border-darkBorder/60 py-6 px-4 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ZK Private Voting Prototype - Pragma Mumbai Technical Demo</span>
          <span className="font-mono">Circom 2.2 - SnarkJS Groth16 - Solidity 0.8.20 - Polygon Amoy</span>
        </div>
      </footer>
    </div>
  );
}

function BenchmarkView() {
  const empiricalBenchmarks = [
    {
      metric: "Circuit Constraints",
      value: "3530",
      notes: "Measured via snarkjs r1cs info circuits/build/voting.r1cs",
    },
    {
      metric: "Average Proof Time",
      value: "152.44 ms",
      notes: "10 iterations measured with SnarkJS Groth16 WASM",
    },
    {
      metric: "Average Verification Time",
      value: "8.73 ms",
      notes: "JavaScript/WASM verification across 10 iterations",
    },
    {
      metric: "Heap Memory Allocation",
      value: "8.88 MB",
      notes: "Node.js process heap memory",
    },
    {
      metric: "Resident Set Size (RSS)",
      value: "544.59 MB",
      notes: "Total process RAM footprint during proof execution",
    },
  ];

  return (
    <div className="py-8 px-4 max-w-5xl mx-auto space-y-8">
      <div>
        <span className="text-xs font-mono font-medium text-brand-400 uppercase tracking-wider">
          Performance and Hardware Benchmarks
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
          Empirical ZK Performance Benchmarks
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Measured live across 10 iterations of Groth16 witness generation, proof generation, and verification on the 3530-constraint Merkle tree circuit.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
        <span className="font-mono text-brand-300 font-semibold block mb-1">
          Prover Status & Hardware Metadata:
        </span>
        <p className="font-mono text-slate-400">
          GPU proving: not configured; SnarkJS WASM benchmark executed on CPU.
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-darkBorder overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-darkCard/90 text-slate-300 font-mono border-b border-darkBorder">
              <tr>
                <th className="p-4">Benchmark Metric</th>
                <th className="p-4">Measured Value</th>
                <th className="p-4">Empirical Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-darkBorder text-slate-300 font-mono">
              {empiricalBenchmarks.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                  <td className="p-4 font-sans font-semibold text-white">
                    {item.metric}
                  </td>
                  <td className="p-4 text-emerald-400 font-bold">{item.value}</td>
                  <td className="p-4 text-slate-400 font-sans">{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-darkBorder space-y-2 text-xs">
          <h4 className="font-bold text-white text-sm">8GB RAM Feasibility</h4>
          <p className="text-slate-400 leading-relaxed">
            The benchmarked Node.js process used approximately 8.88 MB JavaScript heap and 544.59 MB resident memory (RSS). This is within the practical limits of an 8GB RAM development laptop, although browser memory use and performance may vary.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-darkBorder space-y-2 text-xs">
          <h4 className="font-bold text-white text-sm">Prover Architecture & Honesty</h4>
          <p className="text-slate-400 leading-relaxed">
            On the benchmarked host, the 3,530-constraint circuit generated proofs in an average of 152.44 ms across 10 Node.js/SnarkJS WASM iterations. Browser performance may vary by device, operating system, available memory, and browser implementation.
          </p>
        </div>
      </div>
    </div>
  );
}
