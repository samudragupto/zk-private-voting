const { buildPoseidon } = require("circomlibjs");

const TREE_DEPTH = 4;
const NUM_LEAVES = 16; // 2^4

// 16 deterministic demo secrets for technical demonstration
const DEMO_IDENTITY_SECRETS = [
    "1111111111111111111111111111111111111111111111111111111111111111",
    "2222222222222222222222222222222222222222222222222222222222222222",
    "3333333333333333333333333333333333333333333333333333333333333333",
    "4444444444444444444444444444444444444444444444444444444444444444",
    "5555555555555555555555555555555555555555555555555555555555555555",
    "6666666666666666666666666666666666666666666666666666666666666666",
    "7777777777777777777777777777777777777777777777777777777777777777",
    "8888888888888888888888888888888888888888888888888888888888888888",
    "9999999999999999999999999999999999999999999999999999999999999999",
    "1010101010101010101010101010101010101010101010101010101010101010",
    "1212121212121212121212121212121212121212121212121212121212121212",
    "1313131313131313131313131313131313131313131313131313131313131313",
    "1414141414141414141414141414141414141414141414141414141414141414",
    "1515151515151515151515151515151515151515151515151515151515151515",
    "1616161616161616161616161616161616161616161616161616161616161616",
    "1717171717171717171717171717171717171717171717171717171717171717"
];

class DemoMerkleTree {
    constructor(poseidon, leaves) {
        this.poseidon = poseidon;
        this.leaves = leaves;
        this.layers = [];
        this.buildTree();
    }

    hashPair(left, right) {
        return this.poseidon.F.toString(this.poseidon([left, right]));
    }

    buildTree() {
        this.layers = [this.leaves.slice()];
        let currentLayer = this.leaves.slice();

        for (let level = 0; level < TREE_DEPTH; level++) {
            const nextLayer = [];
            for (let i = 0; i < currentLayer.length; i += 2) {
                const left = currentLayer[i];
                const right = currentLayer[i + 1];
                nextLayer.push(this.hashPair(left, right));
            }
            this.layers.push(nextLayer);
            currentLayer = nextLayer;
        }
    }

    getRoot() {
        return this.layers[TREE_DEPTH][0];
    }

    getProof(leafIndex) {
        if (leafIndex < 0 || leafIndex >= NUM_LEAVES) {
            throw new Error(`Leaf index ${leafIndex} out of bounds`);
        }

        const merkleProof = [];
        const merklePathIndices = [];
        let index = leafIndex;

        for (let level = 0; level < TREE_DEPTH; level++) {
            const isRightChild = index % 2 === 1;
            const siblingIndex = isRightChild ? index - 1 : index + 1;

            merkleProof.push(this.layers[level][siblingIndex]);
            merklePathIndices.push(isRightChild ? 1 : 0);

            index = Math.floor(index / 2);
        }

        return {
            merkleProof,
            merklePathIndices
        };
    }
}

async function createDemoMerkleTree(secrets = DEMO_IDENTITY_SECRETS) {
    const poseidon = await buildPoseidon();
    const identityCommitments = secrets.map(secret =>
        poseidon.F.toString(poseidon([secret]))
    );
    const tree = new DemoMerkleTree(poseidon, identityCommitments);
    return {
        poseidon,
        secrets,
        identityCommitments,
        tree,
        root: tree.getRoot()
    };
}

module.exports = {
    TREE_DEPTH,
    NUM_LEAVES,
    DEMO_IDENTITY_SECRETS,
    DemoMerkleTree,
    createDemoMerkleTree
};
