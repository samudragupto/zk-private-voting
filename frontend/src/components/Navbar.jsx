// Purpose: Header navigation bar with wallet connection and network detection.
import React from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";

export function Navbar({ activeTab, setActiveTab }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  const handleConnect = async () => {
    if (typeof window !== "undefined" && !window.ethereum) {
      alert(
        "MetaMask (or a compatible Web3 wallet) was not detected in this browser window.\n\n" +
        "Please ensure MetaMask is installed from https://metamask.io and that the extension is active on localhost:3000."
      );
      return;
    }

    try {
      const preferredConnector =
        connectors.find((c) => c.id === "metaMask" || c.name.toLowerCase().includes("metamask")) ||
        connectors[0];

      if (preferredConnector) {
        connect(
          { connector: preferredConnector },
          {
            onError: (err) => {
              console.error("Wallet connection error:", err);
              if (!err.message?.includes("User rejected")) {
                alert(`Wallet connection failed: ${err.shortMessage || err.message}`);
              }
            },
          }
        );
      } else {
        alert("No compatible Web3 connector found in Wagmi.");
      }
    } catch (err) {
      console.error("Connect execution failed:", err);
      alert(`Connection failed: ${err.message || err}`);
    }
  };

  const truncateAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-darkBorder/80 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab("vote")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-zkPurple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-brand-500/20 font-bold text-white text-xs">
            ZK
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-white tracking-tight">ZK Vote</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Pragma Mumbai
              </span>
            </div>
            <p className="text-xs text-slate-400">Zero-Knowledge Private DAO Governance</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 p-1 bg-darkCard/80 rounded-xl border border-darkBorder">
          <button
            onClick={() => setActiveTab("vote")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "vote"
                ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            Cast Private Ballot
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "results"
                ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            Live Results
          </button>
          <button
            onClick={() => setActiveTab("benchmark")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "benchmark"
                ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            Performance Benchmarks
          </button>
        </nav>

        {/* Network and Wallet Controls */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-darkCard border border-darkBorder text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300 font-mono">
              {chainId === 80002 ? "Polygon Amoy" : "Polygon Testnet"}
            </span>
          </div>

          {isConnected ? (
            <div className="flex items-center space-x-2">
              <div className="px-3 py-1.5 rounded-lg bg-darkCard border border-brand-500/40 text-slate-200 text-xs font-mono">
                {truncateAddress(address)}
              </div>
              <button
                onClick={() => disconnect()}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/30 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isPending}
              className={`px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-zkPurple-600 hover:from-brand-500 hover:to-zkPurple-500 text-white text-sm font-semibold shadow-lg shadow-brand-500/25 transition-all transform hover:-translate-y-0.5 ${
                isPending ? "opacity-75 cursor-wait" : ""
              }`}
            >
              {isPending ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
