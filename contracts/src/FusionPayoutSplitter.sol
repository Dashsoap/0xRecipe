// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

/// @title FusionPayoutSplitter
/// @notice Splits whatever USDC balance it currently holds 80/20 between a creator
///         and the platform, then pays both out in the same call.
/// @dev Called atomically from AgentEscrow.charge(): the escrow transfers `amount`
///      here, then immediately calls distribute(creator). Reading the live balance
///      (rather than trusting a passed-in amount) keeps the split self-contained and
///      sweeps any stray dust on each distribution.
///
///      Split math uses basis-points-of-a-million for 6-decimal-USDC precision:
///      creatorCut = bal * 800000 / 1000000 (floor), platformCut = bal - creatorCut.
///      A zero balance is a no-op (returns without reverting) so an empty distribute
///      never blocks the caller.
contract FusionPayoutSplitter is ReentrancyGuard {
    /// @notice Creator share in CREATOR_BPS/DENOM terms (800000/1000000 = 80%).
    uint256 public constant CREATOR_BPS = 800000;
    /// @notice Denominator for the split (1e6, matching USDC's 6 decimals granularity).
    uint256 public constant DENOM = 1000000;

    /// @notice The USDC (ERC-20) token this splitter pays out.
    IERC20 public immutable usdc;
    /// @notice The platform's payout address (receives the 20% remainder).
    address public immutable platform;

    /// @notice Emitted on every non-zero distribution.
    event Distributed(address indexed creator, uint256 creatorCut, uint256 platformCut);

    /// @notice Generic on-chain audit trail for off-chain accounting/dispute review.
    event AuditEvent(address indexed agent, uint256 amount, string reason);

    constructor(address _usdc, address _platform) {
        require(_usdc != address(0), "usdc=0");
        require(_platform != address(0), "platform=0");
        usdc = IERC20(_usdc);
        platform = _platform;
    }

    /// @notice Split this contract's current USDC balance 80/20 to creator/platform.
    /// @param creator The creator address receiving the 80% share.
    /// @dev Checks-effects-interactions: balance read first, no mutable state to set,
    ///      then external transfers last. Zero balance returns early (no revert).
    function distribute(address creator) external nonReentrant {
        require(creator != address(0), "creator=0");

        uint256 bal = usdc.balanceOf(address(this));
        if (bal == 0) {
            return;
        }

        uint256 creatorCut = (bal * CREATOR_BPS) / DENOM; // floor
        uint256 platformCut = bal - creatorCut;

        require(usdc.transfer(creator, creatorCut), "creator transfer failed");
        require(usdc.transfer(platform, platformCut), "platform transfer failed");

        emit Distributed(creator, creatorCut, platformCut);
    }

    /// @notice Emit an on-chain audit record. Does not move funds.
    /// @dev Restricted to the platform operator: an open emitter would let any
    ///      account forge entries and make the audit trail untrustworthy.
    /// @param agent The agent the record concerns.
    /// @param amount The amount the record concerns.
    /// @param reason A short machine/human-readable reason string.
    function emitAudit(address agent, uint256 amount, string calldata reason) external {
        require(msg.sender == platform, "only platform");
        emit AuditEvent(agent, amount, reason);
    }
}
