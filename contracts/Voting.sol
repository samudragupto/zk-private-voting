// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IVerifier.sol";

/**
 * @title Voting
 * @author Pragma Mumbai ZK Workshop
 * @notice Production-grade Zero-Knowledge Private DAO Voting System.
 * @dev Verifies voter eligibility and binary vote validity off-chain using Groth16 zk-SNARKs.
 *      Preserves complete voter anonymity while strictly preventing double-voting via nullifiers.
 */
contract Voting is ReentrancyGuard {
    // ==========================================
    // CUSTOM ERRORS (Gas-optimized error handling)
    // ==========================================
    error ZeroVerifierAddress();
    error ZeroNullifier();
    error ZeroCommitment();
    error AlreadyVoted();
    error InvalidProof();
    error InvalidVoteOption();
    error CommitmentNotFound();
    error AlreadyRevealed();
    error InvalidRevealCommitment();

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    /// @notice The immutable Groth16 Verifier contract instance
    IVerifier public immutable verifier;

    /// @notice Tracks nullifier hashes that have already cast a vote to prevent double-voting
    mapping(uint256 => bool) public usedNullifiers;

    /// @notice Records valid vote commitments submitted to the contract
    mapping(uint256 => bool) public validCommitments;

    /// @notice Records which commitments have been tallied/revealed
    mapping(uint256 => bool) public revealedCommitments;

    /// @notice Total tally of votes for Option 0 (e.g. Against / Nay)
    uint256 public votesForOption0;

    /// @notice Total tally of votes for Option 1 (e.g. For / Yea)
    uint256 public votesForOption1;

    /// @notice Total count of anonymous ballots cast
    uint256 public totalVotesCast;

    // ==========================================
    // EVENTS
    // ==========================================
    /// @notice Emitted whenever a voter successfully casts a private ballot
    /// @param voter The sender address casting the transaction (can be voter or relayer)
    /// @param voteCommitment The blinding commitment concealing the vote choice
    event VoteCast(address indexed voter, uint256 voteCommitment);

    /// @notice Emitted when a commitment is revealed and tallied into the public count
    /// @param voteCommitment The commitment that was tallied
    /// @param voteOption The revealed choice (0 or 1)
    event VoteRevealed(uint256 indexed voteCommitment, uint256 indexed voteOption);

    // ==========================================
    // CONSTRUCTOR
    // ==========================================
    /**
     * @notice Initializes the Private Voting contract with the deployed Verifier.
     * @param _verifierAddress Address of the deployed Verifier contract.
     */
    constructor(address _verifierAddress) {
        if (_verifierAddress == address(0)) {
            revert ZeroVerifierAddress();
        }
        verifier = IVerifier(_verifierAddress);
    }

    // ==========================================
    // CORE VOTING FUNCTIONS
    // ==========================================

    /**
     * @notice Cast a private ballot using an ABI-encoded Groth16 zk-SNARK proof.
     * @dev Validates that the nullifier has not been previously consumed, then verifies the proof.
     * @param proof ABI-encoded proof containing uint256[2] a, uint256[2][2] b, uint256[2] c.
     * @param nullifierHash Hash of voter's secret nullifier (guarantees 1 voter = 1 vote).
     * @param voteCommitment Poseidon/Sha commitment hiding (vote + salt).
     */
    function vote(
        bytes calldata proof,
        uint256 nullifierHash,
        uint256 voteCommitment
    ) external nonReentrant {
        // Decode ABI-encoded proof points
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = abi.decode(
            proof,
            (uint256[2], uint256[2][2], uint256[2])
        );

        _processVote(a, b, c, nullifierHash, voteCommitment);
    }

    /**
     * @notice Direct interface for casting a vote with unpacked proof coordinates.
     * @param a Proof point A in G1.
     * @param b Proof point B in G2.
     * @param c Proof point C in G1.
     * @param nullifierHash Hash of the nullifier.
     * @param voteCommitment Commitment hiding the vote.
     */
    function voteWithProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256 nullifierHash,
        uint256 voteCommitment
    ) external nonReentrant {
        _processVote(a, b, c, nullifierHash, voteCommitment);
    }

    /**
     * @notice Internal logic to verify zk-SNARK proof and register the private ballot.
     */
    function _processVote(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256 nullifierHash,
        uint256 voteCommitment
    ) internal {
        // Input validation
        if (nullifierHash == 0) revert ZeroNullifier();
        if (voteCommitment == 0) revert ZeroCommitment();

        // Prevent double voting via nullifier uniqueness
        if (usedNullifiers[nullifierHash]) {
            revert AlreadyVoted();
        }

        // Verify Groth16 zk-SNARK proof with Verifier contract
        // Public signals are [nullifierHash, voteCommitment]
        uint256[2] memory publicSignals = [nullifierHash, voteCommitment];
        bool isValid = verifier.verifyProof(a, b, c, publicSignals);
        if (!isValid) {
            revert InvalidProof();
        }

        // Mark nullifier as spent and record commitment
        usedNullifiers[nullifierHash] = true;
        validCommitments[voteCommitment] = true;
        totalVotesCast += 1;

        emit VoteCast(msg.sender, voteCommitment);
    }

    /**
     * @notice Tally a cast vote ballot into the public results.
     * @dev Does not leak which Ethereum address voted because nullifier was decoupled from address.
     * @param voteOption Vote choice: 0 (Against) or 1 (For).
     * @param computedCommitment The commitment calculated from (voteOption, salt).
     */
    function revealVote(
        uint256 voteOption,
        uint256 computedCommitment
    ) external nonReentrant {
        if (voteOption > 1) revert InvalidVoteOption();
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

    /**
     * @notice Convenient atomic function to cast private ballot and tally it simultaneously.
     * @param proof ABI-encoded zk-SNARK proof.
     * @param nullifierHash Hash of nullifier.
     * @param voteCommitment Public commitment.
     * @param voteOption Ballot choice (0 or 1).
     */
    function castAndRevealVote(
        bytes calldata proof,
        uint256 nullifierHash,
        uint256 voteCommitment,
        uint256 voteOption
    ) external nonReentrant {
        if (voteOption > 1) revert InvalidVoteOption();

        // 1. Process and record the private ballot
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = abi.decode(
            proof,
            (uint256[2], uint256[2][2], uint256[2])
        );
        _processVote(a, b, c, nullifierHash, voteCommitment);

        // 2. Mark revealed and update tally
        revealedCommitments[voteCommitment] = true;
        if (voteOption == 0) {
            votesForOption0 += 1;
        } else {
            votesForOption1 += 1;
        }

        emit VoteRevealed(voteCommitment, voteOption);
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
