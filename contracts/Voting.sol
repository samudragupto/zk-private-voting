// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IVerifier.sol";
import "./IPoseidon.sol";

/**
 * @title Voting
 * @author Pragma Mumbai ZK Workshop
 * @notice Zero-Knowledge Private DAO Voting educational prototype.
 * @dev Verifies voter Merkle membership and binary vote validity off-chain using Groth16 zk-SNARKs.
 *      Nullifiers prevent double-voting. Vote commitments conceal ballot choices until reveal.
 */
contract Voting is ReentrancyGuard {
    // ==========================================
    // CUSTOM ERRORS
    // ==========================================
    error ZeroVerifierAddress();
    error ZeroPoseidonAddress();
    error ZeroMerkleRoot();
    error ZeroNullifier();
    error ZeroCommitment();
    error InvalidMerkleRoot();
    error InvalidProposalId();
    error AlreadyVoted();
    error InvalidProof();
    error InvalidVoteOption();
    error CommitmentNotFound();
    error AlreadyRevealed();

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    /// @notice The immutable Groth16 Verifier contract instance
    IVerifier public immutable verifier;

    /// @notice The immutable Poseidon hasher contract instance
    IPoseidon public immutable poseidon;

    /// @notice The approved Merkle root of eligible voter identity commitments
    uint256 public immutable approvedMerkleRoot;

    /// @notice The identifier of the proposal being voted on
    uint256 public immutable proposalId;

    /// @notice Tracks nullifier hashes that have already cast a vote to prevent double-voting
    mapping(uint256 => bool) public usedNullifiers;

    /// @notice Records valid vote commitments submitted to the contract
    mapping(uint256 => bool) public validCommitments;

    /// @notice Records which commitments have been tallied/revealed
    mapping(uint256 => bool) public revealedCommitments;

    /// @notice Total tally of votes for Option 0 (Against / Nay)
    uint256 public votesForOption0;

    /// @notice Total tally of votes for Option 1 (For / Yea)
    uint256 public votesForOption1;

    /// @notice Total count of anonymous ballots cast
    uint256 public totalVotesCast;

    // ==========================================
    // EVENTS
    // ==========================================
    /// @notice Emitted whenever a voter successfully submits a private ballot
    /// @dev Does not emit the voter address to preserve privacy in the SNARK flow
    /// @param nullifierHash The unique nullifier hash preventing duplicate voting
    /// @param voteCommitment The blinding commitment concealing the vote choice
    event VoteSubmitted(uint256 indexed nullifierHash, uint256 voteCommitment);

    /// @notice Emitted when a commitment is revealed and tallied into the public count
    /// @param voteCommitment The commitment that was tallied
    /// @param voteOption The revealed choice (0 or 1)
    event VoteRevealed(uint256 indexed voteCommitment, uint256 indexed voteOption);

    // ==========================================
    // CONSTRUCTOR
    // ==========================================
    /**
     * @notice Initializes the Private Voting contract.
     * @param _verifierAddress Address of the deployed Groth16 Verifier contract.
     * @param _poseidonAddress Address of the deployed Poseidon(2) hasher contract.
     * @param _approvedMerkleRoot Approved Merkle root of eligible voter commitments.
     * @param _proposalId Identifier of the proposal.
     */
    constructor(
        address _verifierAddress,
        address _poseidonAddress,
        uint256 _approvedMerkleRoot,
        uint256 _proposalId
    ) {
        if (_verifierAddress == address(0)) revert ZeroVerifierAddress();
        if (_poseidonAddress == address(0)) revert ZeroPoseidonAddress();
        if (_approvedMerkleRoot == 0) revert ZeroMerkleRoot();

        verifier = IVerifier(_verifierAddress);
        poseidon = IPoseidon(_poseidonAddress);
        approvedMerkleRoot = _approvedMerkleRoot;
        proposalId = _proposalId;
    }

    // ==========================================
    // CORE VOTING FUNCTIONS
    // ==========================================

    /**
     * @notice Cast a private ballot using an ABI-encoded Groth16 zk-SNARK proof.
     * @param proof ABI-encoded proof containing uint256[2] a, uint256[2][2] b, uint256[2] c.
     * @param publicSignals Array of 4 public signals: [merkleRoot, proposalId, nullifierHash, voteCommitment].
     */
    function vote(
        bytes calldata proof,
        uint256[4] calldata publicSignals
    ) external nonReentrant {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = abi.decode(
            proof,
            (uint256[2], uint256[2][2], uint256[2])
        );

        _processVote(a, b, c, publicSignals);
    }

    /**
     * @notice Direct interface for casting a vote with unpacked proof coordinates.
     * @param a Proof point A in G1.
     * @param b Proof point B in G2.
     * @param c Proof point C in G1.
     * @param publicSignals Array of 4 public signals: [merkleRoot, proposalId, nullifierHash, voteCommitment].
     */
    function voteWithProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[4] calldata publicSignals
    ) external nonReentrant {
        _processVote(a, b, c, publicSignals);
    }

    /**
     * @notice Internal logic to verify zk-SNARK proof and register the private ballot.
     */
    function _processVote(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[4] memory publicSignals
    ) internal {
        uint256 submittedRoot = publicSignals[0];
        uint256 submittedProposalId = publicSignals[1];
        uint256 nullifierHash = publicSignals[2];
        uint256 voteCommitment = publicSignals[3];

        // Signal validation
        if (submittedRoot != approvedMerkleRoot) revert InvalidMerkleRoot();
        if (submittedProposalId != proposalId) revert InvalidProposalId();
        if (nullifierHash == 0) revert ZeroNullifier();
        if (voteCommitment == 0) revert ZeroCommitment();

        // Prevent double voting via nullifier uniqueness
        if (usedNullifiers[nullifierHash]) {
            revert AlreadyVoted();
        }

        // Verify Groth16 zk-SNARK proof with Verifier contract
        bool isValid = verifier.verifyProof(a, b, c, publicSignals);
        if (!isValid) {
            revert InvalidProof();
        }

        // Mark nullifier as spent and record commitment
        usedNullifiers[nullifierHash] = true;
        validCommitments[voteCommitment] = true;
        totalVotesCast += 1;

        emit VoteSubmitted(nullifierHash, voteCommitment);
    }

    /**
     * @notice Reveal a previously committed ballot into the public tally.
     * @dev Calculates Poseidon(voteOption, salt) on-chain to match the submitted commitment.
     * @param voteOption Vote choice: 0 (Against) or 1 (For).
     * @param salt The blinding factor used to construct the vote commitment.
     */
    function revealVote(
        uint256 voteOption,
        uint256 salt
    ) external nonReentrant {
        if (voteOption > 1) revert InvalidVoteOption();

        uint256 computedCommitment = poseidon.poseidon([voteOption, salt]);
        if (!validCommitments[computedCommitment]) revert CommitmentNotFound();
        if (revealedCommitments[computedCommitment]) revert AlreadyRevealed();

        revealedCommitments[computedCommitment] = true;

        if (voteOption == 0) {
            votesForOption0 += 1;
        } else {
            votesForOption1 += 1;
        }

        emit VoteRevealed(computedCommitment, voteOption);
    }

    // ==========================================
    // VIEW FUNCTIONS
    // ==========================================

    /**
     * @notice Returns the aggregate voting results.
     * @return _votesForOption0 Count of votes for Option 0 (Against)
     * @return _votesForOption1 Count of votes for Option 1 (For)
     */
    function getResults()
        external
        view
        returns (uint256 _votesForOption0, uint256 _votesForOption1)
    {
        return (votesForOption0, votesForOption1);
    }

    /**
     * @notice Check whether a nullifier has already been consumed.
     * @param nullifierHash The nullifier hash to check.
     * @return bool True if already voted, false otherwise.
     */
    function isNullifierUsed(uint256 nullifierHash) external view returns (bool) {
        return usedNullifiers[nullifierHash];
    }
}
