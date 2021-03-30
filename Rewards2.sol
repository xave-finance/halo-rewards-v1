// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IMinter} from "./interfaces/IMinter.sol";

contract Rewards is Ownable {
    /****************************************
     *                VARIABLES              *
     ****************************************/

    uint256 decayBase;

    struct UserInfo {
        uint256 amount; // How many collateral or LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    struct Pool {
        address poolAddress;
        uint256 allocPoint;
    }

    struct PoolInfo {
        bool whitelisted; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. Used to calculate ratio of rewards for this amm pool out of total
        uint256 lastRewardTs; // Last block number that HALO distribution occured.
        uint256 accHaloPerShare; // Accumulated HALO per share, times 10^18.
    }

    constructor(
        address _haloTokenAddress,
        uint256 _startingRewards,
        uint256 _decayBase, //multiplied by 10^18
        uint256 _epochLength,
        uint256 _minterCollateralRewardsRatio, //in bps, multiplied by 10^4
        uint256 _ammPoolRewardsRatio, //in bps, multiplied by 10^4
        uint256 _vestingRewardsRatio, //in bps, multiplied by 10^4
        address _minter
    ) public {}

    // epoch = 30 days = 2629800 s
    function calcRewardForEpoch(
        uint256 _startingRewards,
        uint256 _decayBase,
        uint256 epochNum
    ) internal pure returns (uint256) {
        return _startingRewards * _decayBase**epochNum;
    }
}
