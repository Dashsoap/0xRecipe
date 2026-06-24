// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {FusionPayoutSplitter} from "../src/FusionPayoutSplitter.sol";
import {AgentEscrow} from "../src/AgentEscrow.sol";

/// @title Deploy
/// @notice Deploys FusionPayoutSplitter then AgentEscrow, wiring the escrow to the
///         splitter. All addresses come from environment variables — nothing is
///         hardcoded. Run with:
///           forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
///         providing PRIVATE_KEY, USDC_ADDRESS, BACKEND, PLATFORM in the environment.
/// @dev Not executed at this stage. Target chain: Injective EVM testnet (chainId 1439).
///      Known testnet USDC for reference (set via USDC_ADDRESS, do not hardcode):
///        0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d
contract Deploy is Script {
    function run() external {
        // Deployer key from env. Fail fast if missing.
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        // Required addresses from env. vm.envAddress reverts if unset (fail fast).
        address usdc = vm.envAddress("USDC_ADDRESS");
        address backend = vm.envAddress("BACKEND");
        address platform = vm.envAddress("PLATFORM");

        vm.startBroadcast(deployerKey);

        FusionPayoutSplitter splitter = new FusionPayoutSplitter(usdc, platform);
        AgentEscrow escrow = new AgentEscrow(usdc, backend, address(splitter));

        vm.stopBroadcast();

        console.log("FusionPayoutSplitter:", address(splitter));
        console.log("AgentEscrow:", address(escrow));
        console.log("USDC:", usdc);
        console.log("backend:", backend);
        console.log("platform:", platform);
    }
}
