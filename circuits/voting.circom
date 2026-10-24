pragma circom 2.0.0;

/**
 * @title VotingCircuit
 * @notice Educational Zero-Knowledge Private DAO Voting Circuit.
 *
 * Eligibility and Security Model:
 * 1. Merkle Membership: Voter proves knowledge of `identitySecret` such that
 *    `identityCommitment = Poseidon(identitySecret)` is a leaf in the approved `merkleRoot`.
 * 2. Proposal Nullifier: `nullifierHash = Poseidon(identitySecret, proposalId)` prevents
 *    double-voting per proposal without linking to wallet address or identity commitment.
 * 3. Vote Choice Blinding: `voteCommitment = Poseidon(vote, salt)` conceals the ballot.
 * 4. Binary Constraint: `vote * (vote - 1) === 0` strictly enforces 0 (Nay) or 1 (Yea).
 *
 * Public Signals (in exact order for Solidity verifier compatibility):
 * 1. merkleRoot
 * 2. proposalId
 * 3. nullifierHash
 * 4. voteCommitment
 *
 * Depth Parameter:
 * Fixed at depth = 4 (supporting 16 demo voters). Clearly designated for educational demo purposes.
 */

include "../node_modules/circomlib/circuits/poseidon.circom";

template Voting(depth) {
    // ==========================================
    // 1. PRIVATE INPUT SIGNALS
    // ==========================================
    signal input identitySecret;               // Private secret scalar known only to the voter
    signal input merkleProof[depth];           // Sibling hashes along the Merkle authentication path
    signal input merklePathIndices[depth];     // Direction bit (0 = left, 1 = right) for each level
    signal input vote;                         // Binary vote choice (0 or 1)
    signal input salt;                         // Random blinding factor to conceal the vote

    // Context signals provided by prover
    signal input root;                         // Expected Merkle root
    signal input proposal;                     // Unique proposal identifier

    // ==========================================
    // 2. PUBLIC OUTPUT SIGNALS (Exact Order)
    // ==========================================
    signal output merkleRoot;                  // Public signal 1: Approved governance Merkle root
    signal output proposalId;                  // Public signal 2: Governance proposal ID
    signal output nullifierHash;               // Public signal 3: Nullifier hash preventing double voting
    signal output voteCommitment;              // Public signal 4: Blinded ballot commitment

    // Bind public context outputs
    merkleRoot <== root;
    proposalId <== proposal;

    // ==========================================
    // 3. CONSTRAINTS
    // ==========================================

    // Constraint 1: Vote must be binary (0 or 1)
    vote * (vote - 1) === 0;

    // Constraint 2: Compute Identity Commitment leaf = Poseidon(identitySecret)
    component leafHasher = Poseidon(1);
    leafHasher.inputs[0] <== identitySecret;
    signal identityCommitment;
    identityCommitment <== leafHasher.out;

    // Constraint 3: Verify Merkle Membership of Identity Commitment
    signal currentHash[depth + 1];
    currentHash[0] <== identityCommitment;

    component levelHashers[depth];
    signal left[depth];
    signal right[depth];

    for (var i = 0; i < depth; i++) {
        // Enforce path index is binary (0 or 1)
        merklePathIndices[i] * (merklePathIndices[i] - 1) === 0;

        // Route left and right based on path index bit:
        // If pathIndex == 0: left = current, right = proof
        // If pathIndex == 1: left = proof, right = current
        left[i] <== currentHash[i] + merklePathIndices[i] * (merkleProof[i] - currentHash[i]);
        right[i] <== merkleProof[i] + merklePathIndices[i] * (currentHash[i] - merkleProof[i]);

        levelHashers[i] = Poseidon(2);
        levelHashers[i].inputs[0] <== left[i];
        levelHashers[i].inputs[1] <== right[i];

        currentHash[i + 1] <== levelHashers[i].out;
    }

    // Merkle root must match the expected public root
    currentHash[depth] === root;

    // Constraint 4: Generate Proposal-scoped Nullifier Hash
    // nullifierHash = Poseidon(identitySecret, proposalId)
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== identitySecret;
    nullifierHasher.inputs[1] <== proposal;
    nullifierHash <== nullifierHasher.out;

    // Constraint 5: Generate Vote Commitment
    // voteCommitment = Poseidon(vote, salt)
    component voteHasher = Poseidon(2);
    voteHasher.inputs[0] <== vote;
    voteHasher.inputs[1] <== salt;
    voteCommitment <== voteHasher.out;
}

// Tree depth = 4 (16 authorized demo voters)
component main = Voting(4);
