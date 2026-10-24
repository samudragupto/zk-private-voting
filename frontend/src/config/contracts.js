import deployedConfig from "./contracts.json";

export const VOTING_CONTRACT_ADDRESS =
  import.meta.env.VITE_VOTING_CONTRACT_ADDRESS ||
  deployedConfig.votingAddress ||
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

export const VERIFIER_CONTRACT_ADDRESS =
  import.meta.env.VITE_VERIFIER_CONTRACT_ADDRESS ||
  deployedConfig.verifierAddress ||
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const POSEIDON_CONTRACT_ADDRESS =
  import.meta.env.VITE_POSEIDON_CONTRACT_ADDRESS ||
  deployedConfig.poseidonAddress ||
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export const APPROVED_MERKLE_ROOT =
  deployedConfig.approvedMerkleRoot ||
  "17472554645224130603463831934347775944856028524999363438787688643257639181222";

export const PROPOSAL_ID =
  deployedConfig.proposalId || "1";

export const VOTING_ABI = [
  {
    inputs: [
      { internalType: "bytes", name: "proof", type: "bytes" },
      { internalType: "uint256[4]", name: "publicSignals", type: "uint256[4]" },
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256[2]", name: "a", type: "uint256[2]" },
      { internalType: "uint256[2][2]", name: "b", type: "uint256[2][2]" },
      { internalType: "uint256[2]", name: "c", type: "uint256[2]" },
      { internalType: "uint256[4]", name: "publicSignals", type: "uint256[4]" },
    ],
    name: "voteWithProof",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "voteOption", type: "uint256" },
      { internalType: "uint256", name: "salt", type: "uint256" },
    ],
    name: "revealVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getResults",
    outputs: [
      { internalType: "uint256", name: "_votesForOption0", type: "uint256" },
      { internalType: "uint256", name: "_votesForOption1", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "nullifierHash", type: "uint256" }],
    name: "isNullifierUsed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalVotesCast",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "approvedMerkleRoot",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proposalId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "nullifierHash", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "voteCommitment", type: "uint256" },
    ],
    name: "VoteSubmitted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "voteCommitment", type: "uint256" },
      { indexed: true, internalType: "uint256", name: "voteOption", type: "uint256" },
    ],
    name: "VoteRevealed",
    type: "event",
  },
];
