// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentEscrow} from "../src/AgentEscrow.sol";
import {FusionPayoutSplitter} from "../src/FusionPayoutSplitter.sol";
import {MockUSDC} from "./MockUSDC.sol";

/// @notice A splitter that re-enters AgentEscrow during distribute(), used to prove
///         the nonReentrant guard reverts the whole charge tx.
/// @dev distribute() runs while charge()'s nonReentrant lock is held, with the splitter
///      as msg.sender. It re-enters withdraw() — also nonReentrant, but callable by any
///      account (not gated by onlyBackend) — so the guard, not an access-control check,
///      is what fires. (Re-entering charge() instead would hit onlyBackend first and
///      never exercise the reentrancy lock.)
contract ReentrantSplitter {
    AgentEscrow public escrow;
    uint256 public amount;
    bool public armed;

    function arm(AgentEscrow _escrow, uint256 _amount) external {
        escrow = _escrow;
        amount = _amount;
        armed = true;
    }

    function distribute(address) external {
        if (armed) {
            armed = false; // only re-enter once
            // This must revert with "reentrant" and bubble up to fail the outer charge.
            escrow.withdraw(amount);
        }
    }
}

contract AgentEscrowTest is Test {
    MockUSDC internal usdc;
    FusionPayoutSplitter internal splitter;
    AgentEscrow internal escrow;

    address internal backend = address(0xB4C);
    address internal platform = address(0xF11);
    address internal creator = address(0xC12);
    address internal relayer = address(0xDEAD);

    // Signer derived from a known private key (proves accounting binds to signer).
    uint256 internal signerKey = 0xA11CE;
    address internal signer;

    // EIP-712 typehash for ReceiveWithAuthorization (matches MockUSDC).
    bytes32 internal constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8;

    function setUp() public {
        signer = vm.addr(signerKey);

        usdc = new MockUSDC();
        splitter = new FusionPayoutSplitter(address(usdc), platform);
        escrow = new AgentEscrow(address(usdc), backend, address(splitter));

        // Fund the signer with USDC (6 decimals).
        usdc.mint(signer, 1_000_000); // 1.00 USDC
    }

    // ---- helpers ----

    /// @dev Build + sign a ReceiveWithAuthorization for (from=signer, to=escrow).
    function _signReceive(uint256 value, bytes32 nonce)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s, uint256 validAfter, uint256 validBefore)
    {
        validAfter = 0;
        validBefore = block.timestamp + 1 hours;

        bytes32 structHash = keccak256(
            abi.encode(
                RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
                signer,
                address(escrow),
                value,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(signerKey, digest);
    }

    /// @dev Relayer-submitted gasless deposit crediting the signer.
    function _depositAsRelayer(uint256 value, bytes32 nonce) internal {
        (uint8 v, bytes32 r, bytes32 s, uint256 validAfter, uint256 validBefore) =
            _signReceive(value, nonce);
        vm.prank(relayer);
        escrow.depositFor(signer, value, validAfter, validBefore, nonce, v, r, s);
    }

    // ---- tests ----

    /// @notice Deposit credits the SIGNER `from`, not the relayer/msg.sender.
    function testDepositRecordsToSigner() public {
        uint256 value = 100_000; // 0.10 USDC
        _depositAsRelayer(value, keccak256("nonce-1"));

        assertEq(escrow.balanceOf(signer), value, "signer credited");
        assertEq(escrow.balanceOf(relayer), 0, "relayer not credited");
        assertEq(usdc.balanceOf(address(escrow)), value, "escrow holds funds");
    }

    /// @notice deposit 100000 -> charge 50000 -> creator 40000 / platform 10000 / escrow left 50000.
    function testChargeSplits8020() public {
        _depositAsRelayer(100_000, keccak256("nonce-2")); // 0.10 USDC

        vm.prank(backend);
        escrow.charge(signer, 50_000, creator); // 0.05 USDC

        assertEq(usdc.balanceOf(creator), 40_000, "creator 80%");
        assertEq(usdc.balanceOf(platform), 10_000, "platform 20%");
        assertEq(escrow.balanceOf(signer), 50_000, "escrow balance left");
        assertEq(usdc.balanceOf(address(escrow)), 50_000, "escrow holds remaining");
        assertEq(usdc.balanceOf(address(splitter)), 0, "splitter swept clean");
    }

    /// @notice distribute() on a zero-balance splitter does not revert.
    function testDistributeZeroBalanceNoRevert() public {
        // Fresh splitter with no funds.
        FusionPayoutSplitter empty = new FusionPayoutSplitter(address(usdc), platform);
        empty.distribute(creator); // must not revert
        assertEq(usdc.balanceOf(creator), 0, "no payout from empty splitter");
    }

    /// @notice Agent can withdraw unspent balance.
    function testWithdraw() public {
        _depositAsRelayer(100_000, keccak256("nonce-3"));

        uint256 before = usdc.balanceOf(signer);
        vm.prank(signer);
        escrow.withdraw(30_000);

        assertEq(escrow.balanceOf(signer), 70_000, "escrow debited");
        assertEq(usdc.balanceOf(signer), before + 30_000, "funds returned");
    }

    /// @notice Only the backend can charge.
    function testChargeOnlyBackend() public {
        _depositAsRelayer(100_000, keccak256("nonce-4"));

        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("only backend"));
        escrow.charge(signer, 10_000, creator);
    }

    /// @notice Charging more than the agent's balance reverts.
    function testChargeInsufficientReverts() public {
        _depositAsRelayer(10_000, keccak256("nonce-5"));

        vm.prank(backend);
        vm.expectRevert(bytes("insufficient"));
        escrow.charge(signer, 20_000, creator);
    }

    /// @notice Withdrawing more than balance reverts.
    function testWithdrawInsufficientReverts() public {
        _depositAsRelayer(10_000, keccak256("nonce-6"));

        vm.prank(signer);
        vm.expectRevert(bytes("insufficient"));
        escrow.withdraw(20_000);
    }

    /// @notice A re-entrant splitter calling back into charge() must be blocked.
    function testReentrancyGuard() public {
        ReentrantSplitter evil = new ReentrantSplitter();
        AgentEscrow evilEscrow = new AgentEscrow(address(usdc), backend, address(evil));

        // Fund and deposit into the escrow wired to the malicious splitter.
        bytes32 nonce = keccak256("nonce-7");
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
                signer,
                address(evilEscrow),
                100_000,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        vm.prank(relayer);
        evilEscrow.depositFor(signer, 100_000, validAfter, validBefore, nonce, v, r, s);

        // Arm the re-entry: distribute() will try to re-enter withdraw() while the
        // charge() reentrancy lock is held.
        evil.arm(evilEscrow, 10_000);

        // The outer charge must revert because the nested withdraw hits nonReentrant.
        vm.prank(backend);
        vm.expectRevert(bytes("reentrant"));
        evilEscrow.charge(signer, 50_000, creator);

        // State unchanged after the reverted tx.
        assertEq(evilEscrow.balanceOf(signer), 100_000, "balance untouched after revert");
    }
}
