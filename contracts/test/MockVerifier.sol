// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../IVerifier.sol";

/**
 * @title MockVerifier
 * @notice Controllable mock verifier used in Hardhat unit tests to test valid & invalid proof branches.
 */
contract MockVerifier is IVerifier {
    bool public shouldPass = true;

    function setShouldPass(bool _pass) external {
        shouldPass = _pass;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[4] calldata
    ) external view override returns (bool r) {
        return shouldPass;
    }
}
