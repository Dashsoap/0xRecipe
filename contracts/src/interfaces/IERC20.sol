// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IERC20 (minimal)
/// @notice Minimal ERC-20 interface. Only the methods used by 0xRecipe contracts.
/// @dev Minimal hand-written interface; in production prefer OpenZeppelin's IERC20.
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);

    function transferFrom(address from, address to, uint256 value) external returns (bool);

    function balanceOf(address account) external view returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);
}
