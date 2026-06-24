// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {IERC3009} from "./interfaces/IERC3009.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

/// @notice Minimal view of the splitter AgentEscrow.charge() drives.
interface ISplitter {
    function distribute(address creator) external;
}

/// @title AgentEscrow
/// @notice Prepaid on-chain escrow for the 0xRecipe model market.
///         An agent deposits USDC once (gaslessly, via EIP-3009); each call is charged
///         against that locked balance, and the charge atomically forwards the fee to
///         the splitter and triggers the 80/20 payout. Because funds are locked before
///         any model call runs, the platform never fronts unrecoverable upstream cost,
///         and a failed call simply never charges.
/// @dev See IMPLEMENTATION_PLAN §1.5. ReentrancyGuard + strict checks-effects-interactions
///      on every state-mutating, fund-moving path.
contract AgentEscrow is ReentrancyGuard {
    /// @notice The USDC (ERC-20 / EIP-3009) token held in escrow.
    IERC20 public immutable usdc;
    /// @notice The backend hot wallet authorized to charge agents (onlyBackend).
    address public immutable backend;
    /// @notice The payout splitter that performs the 80/20 distribution.
    address public immutable splitter;

    /// @notice Prepaid, currently-unspent balance per agent address.
    mapping(address => uint256) public balances;

    /// @notice Emitted when a deposit is credited to the signer `from`.
    event Deposited(address indexed from, uint256 value);
    /// @notice Emitted when the backend charges an agent for a call.
    event Charged(address indexed agent, uint256 amount, address indexed creator);
    /// @notice Emitted when an agent withdraws unspent balance.
    event Withdrawn(address indexed agent, uint256 amount);

    modifier onlyBackend() {
        require(msg.sender == backend, "only backend");
        _;
    }

    constructor(address _usdc, address _backend, address _splitter) {
        require(_usdc != address(0), "usdc=0");
        require(_backend != address(0), "backend=0");
        require(_splitter != address(0), "splitter=0");
        usdc = IERC20(_usdc);
        backend = _backend;
        splitter = _splitter;
    }

    /// @notice Deposit USDC into escrow on behalf of a signer, gaslessly.
    /// @dev The relayer (any caller, typically the backend) submits the agent's
    ///      EIP-3009 ReceiveWithAuthorization signature. Internally this calls
    ///      `usdc.receiveWithAuthorization(from, address(this), value, ...)`: at that
    ///      point THIS contract is `msg.sender`, so it is the `to`/payee and passes
    ///      EIP-3009's `require(msg.sender == to)` check. After the pull succeeds, the
    ///      value is credited to the SIGNER `from` (not the relayer / msg.sender).
    ///
    ///      MUST use `receiveWithAuthorization`, NOT `transferWithAuthorization`:
    ///      `transferWithAuthorization` to a contract would land the funds here but
    ///      WITHOUT routing through this accounting hook — the money would arrive
    ///      un-credited (IMPLEMENTATION_PLAN §1.5 C11 / R1). The receive variant is
    ///      what binds the credit to the signer.
    /// @param from The signer / agent whose balance is credited.
    /// @param value The USDC amount to pull and credit.
    /// @param validAfter EIP-3009 authorization not-valid-before timestamp.
    /// @param validBefore EIP-3009 authorization expiry timestamp.
    /// @param nonce EIP-3009 authorization nonce.
    /// @param v EIP-3009 signature component.
    /// @param r EIP-3009 signature component.
    /// @param s EIP-3009 signature component.
    function depositFor(
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        // Interaction first here is intentional and safe: the token is the trusted USDC
        // contract, and we credit the signer only after the authorized pull succeeds,
        // using the exact authorized `value`.
        IERC3009(address(usdc)).receiveWithAuthorization(
            from, address(this), value, validAfter, validBefore, nonce, v, r, s
        );

        // Effect: credit the SIGNER `from`, never the relayer.
        balances[from] += value;

        emit Deposited(from, value);
    }

    /// @notice Charge an agent for one call and atomically split the fee 80/20.
    /// @dev onlyBackend. Strict CEI: balance check, balance debit (effect), then the
    ///      external transfer + distribute (interactions). The whole charge — debit,
    ///      transfer to splitter, and 80/20 payout — settles in a single atomic tx.
    /// @param agent The agent being charged.
    /// @param amount The fee to charge (in USDC base units).
    /// @param creator The creator receiving the 80% share.
    function charge(address agent, uint256 amount, address creator) external onlyBackend nonReentrant {
        require(balances[agent] >= amount, "insufficient");

        // Effect before interaction.
        balances[agent] -= amount;

        // Interactions.
        require(usdc.transfer(splitter, amount), "transfer to splitter failed");
        ISplitter(splitter).distribute(creator);

        emit Charged(agent, amount, creator);
    }

    /// @notice Withdraw unspent escrow balance back to the caller.
    /// @dev Strict CEI: check, debit (effect), then transfer (interaction).
    /// @param amount The amount to withdraw.
    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "insufficient");

        balances[msg.sender] -= amount;

        require(usdc.transfer(msg.sender, amount), "withdraw transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Current unspent escrow balance for an account.
    /// @param account The account to query.
    /// @return The account's escrow balance.
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
}
