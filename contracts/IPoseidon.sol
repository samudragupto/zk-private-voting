// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

interface IPoseidon {
    function poseidon(uint256[2] calldata input) external pure returns (uint256);
}
