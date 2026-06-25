// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "../src/interfaces/IERC20.sol";
import {IERC3009} from "../src/interfaces/IERC3009.sol";

/// @title MockUSDC
/// @notice Test-only USDC stand-in: 6-decimal ERC-20 plus a real EIP-712
///         `receiveWithAuthorization` (EIP-3009) so tests can prove that escrow
///         accounting binds to the recovered signer, not the relayer.
/// @dev Domain mirrors the real testnet USDC: name="USDC", version="2",
///      chainId=block.chainid, verifyingContract=this. The receive variant enforces
///      `msg.sender == to`, exactly like FiatTokenInjectiveV2_2.
contract MockUSDC is IERC20, IERC3009 {
    string public constant name = "USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;
    string public constant version = "2";

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    bytes32 private constant _EIP712_DOMAIN_TYPEHASH =
        0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;

    // keccak256("ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
    bytes32 private constant _RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8;

    bytes32 public immutable DOMAIN_SEPARATOR;

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                _EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                address(this)
            )
        );
    }

    // --- test mint helper ---
    function mint(address to, uint256 value) external {
        balanceOf[to] += value;
        totalSupply += value;
    }

    // --- ERC-20 ---
    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
    }

    // --- EIP-3009 ReceiveWithAuthorization ---
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
    ) external {
        // The defining property of the *receive* variant: caller must be the payee.
        require(to == msg.sender, "caller must be payee");
        require(block.timestamp > validAfter, "auth not yet valid");
        require(block.timestamp < validBefore, "auth expired");
        require(!authorizationState[from][nonce], "auth used");

        bytes32 structHash = keccak256(
            abi.encode(
                _RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address recovered = ecrecover(digest, v, r, s);
        require(recovered != address(0) && recovered == from, "invalid signature");

        authorizationState[from][nonce] = true;
        _transfer(from, to, value);
    }
}
