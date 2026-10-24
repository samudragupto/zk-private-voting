// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

interface IVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[4] calldata input
    ) external view returns (bool);
}
