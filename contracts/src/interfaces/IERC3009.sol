// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IERC3009 (minimal)
/// @notice EIP-3009 transfer-with-authorization surface, narrowed to the single
///         method 0xRecipe relies on for gasless deposits into the escrow.
/// @dev Minimal hand-written interface; in production prefer the canonical token's ABI.
///
/// IMPORTANT (see IMPLEMENTATION_PLAN §1.5 C11 / R1):
/// Deposits MUST use `receiveWithAuthorization`, NOT `transferWithAuthorization`.
/// `receiveWithAuthorization` binds the recipient to `msg.sender == to`, so when the
/// escrow calls it, the escrow itself is the payee and passes that check. A relayer
/// cannot redirect funds to itself, and the funds are credited to the signer `from`.
/// `transferWithAuthorization` would let funds land at the contract WITHOUT going
/// through the escrow's accounting hook — money arrives but no balance is recorded.
interface IERC3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
