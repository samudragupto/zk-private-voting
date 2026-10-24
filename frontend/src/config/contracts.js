export const VOTING_CONTRACT_ADDRESS =
  import.meta.env.VITE_VOTING_CONTRACT_ADDRESS ||
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export const VOTING_ABI = [
  {
    inputs: [
      { internalType: "bytes", name: "proof", type: "bytes" },
      { internalType: "uint256", name: "nullifierHash", type: "uint256" },
      { internalType: "uint256", name: "voteCommitment", type: "uint256" },
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes", name: "proof", type: "bytes" },
      { internalType: "uint256", name: "nullifierHash", type: "uint256" },
      { internalType: "uint256", name: "voteCommitment", type: "uint256" },
      { internalType: "uint256", name: "voteOption", type: "uint256" },
    ],
    name: "castAndRevealVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "voteOption", type: "uint256" },
      { internalType: "uint256", name: "computedCommitment", type: "uint256" },
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
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "voter", type: "address" },
      { indexed: false, internalType: "uint256", name: "voteCommitment", type: "uint256" },
    ],
    name: "VoteCast",
    type: "event",
  },
];
