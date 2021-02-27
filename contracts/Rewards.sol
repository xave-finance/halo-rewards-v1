// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import { Ownable } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/access/Ownable.sol";
import { IERC20 } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/math/SafeMath.sol";

contract Rewards is Ownable {
    uint256 public constant DECIMALS = 10**18;
    uint256 public constant BPS = 10**4;

    using SafeMath for uint256;
    //using FixedPoint for FixedPoint.Unsigned;
    //using SafeERC20 for IERC20;
    //using SafeERC20 for ExpandedIERC20;

    event Deposit(address indexed user, address indexed lpAddress, uint256 amount);
    event Withdraw(address indexed user, address indexed lpAddress, uint256 amount);

    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    struct PoolInfo {
        bool whitelisted; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. Used to calculate ratio of rewards for this amm pool out of total
        uint256 lastRewardTs; // Last block number that HALO distribution occured.
        uint256 accHaloPerShare; // Accumulated HALO per share, times 1e18.
    }

    address public haloTokenAddress;
    uint256 public genesisTs;
    uint256 public startingRewards;
    uint256 public decayBase; //multiply fraction by 10^18, keeps decimals consistent and gives enough entropy for more precision
    uint256 public epochLength;
    uint256 public daiLpRewardsRatio; //in bps, multiply fraction by 10^4
    uint256 public ammLpRewardsRatio; //in bps, multiply fraction by 10^4
    uint256 public totalLpRewardAllocs; //total allocation points for all amm lps (the ratio defines percentage of rewards to a particular amm lp)

    address public minterContract;

    mapping(address => PoolInfo) public lpPools;
    mapping(address => mapping(address => UserInfo)) public userInfo;

    //===========================================//
    //=================constructor===============//
    //===========================================//

    constructor(
        address _haloTokenAddress,
        uint256 _startingRewards,
        uint256 _decayBase, //multiplied by 10^18
        uint256 _epochLength,
        uint256 _daiLpRewardsRatio, //in bps, multiplied by 10^4
        uint256 _ammLpRewardsRatio, //in bps, multiplied by 10^4
        address _minter,
        uint256 _genesisTs
    ) public {
        haloTokenAddress = _haloTokenAddress;
        startingRewards = _startingRewards;
        decayBase = _decayBase;
        epochLength = _epochLength;
        daiLpRewardsRatio = _daiLpRewardsRatio;
        ammLpRewardsRatio = _ammLpRewardsRatio;
        minterContract = _minter;
        genesisTs = _genesisTs;
    }


    //===========================================//
    //==============public functions=============//
    //===========================================//


    function updateAmmRewardPool(address _lpAddress) public {
        PoolInfo storage pool = lpPools[_lpAddress];
        if (block.timestamp <= pool.lastRewardTs) {
            return;
        }
        uint256 lpSupply = IERC20(_lpAddress).balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardTs = block.timestamp;
            return;
        }

        uint256 totalRewards = calcReward(pool.lastRewardTs);
        uint256 allocPoint = pool.allocPoint;
        uint256 haloReward = totalRewards.mul(ammLpRewardsRatio).mul(pool.allocPoint).div(totalLpRewardAllocs).div(BPS);

        //IERC20(haloTokenAddress).mint(address(this), haloReward);

        pool.accHaloPerShare = pool.accHaloPerShare.add(
            haloReward.mul(DECIMALS).div(lpSupply)
        );

        pool.lastRewardTs = block.timestamp;
    }

    // Deposit LP tokens to earn HALO Rewards.
    function deposit(address _lpAddress, uint256 _amount) public {
        require(lpPools[_lpAddress].whitelisted == true, "Error: Amm Lp not allowed");
        PoolInfo storage pool = lpPools[_lpAddress];
        UserInfo storage user = userInfo[_lpAddress][msg.sender];
        updateAmmRewardPool(_lpAddress);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(
                    user.rewardDebt
                );
            safeHaloTransfer(msg.sender, pending);
        }
        IERC20(_lpAddress).transferFrom(
            address(msg.sender),
            address(this),
            _amount
        );
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);
        emit Deposit(msg.sender, _lpAddress, _amount);
    }

    // Withdraw LP tokens.
    function withdraw(address _lpAddress, uint256 _amount) public {
        //require(lpPools[_lpAddress].whitelisted == true, "Error: Amm Lp not allowed"); //#DISCUSS: Allow withdraw from later blacklisted lps
        PoolInfo storage pool = lpPools[_lpAddress];
        UserInfo storage user = userInfo[_lpAddress][msg.sender];
        require(user.amount >= _amount, "Error: Not enough balance");
        updateAmmRewardPool(_lpAddress);
        uint256 pending =
            user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(
                user.rewardDebt
            );
        safeHaloTransfer(msg.sender, pending);
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);
        IERC20(_lpAddress).transfer(address(msg.sender), _amount);
        emit Withdraw(msg.sender, _lpAddress, _amount);
    }

    //===========================================//
    //===============view functions==============//
    //===========================================//

    function totalLpAllocs() public view returns (uint256) {
        return totalLpRewardAllocs;
    }

    //===========================================//
    //===============admin functions=============//
    //===========================================//

    function initialize() public onlyOwner {
        require(block.timestamp < genesisTs, "Already initialized");
        genesisTs = block.timestamp;
    }

    // Update the given pool's HALO allocation point. Can only be called by the owner.
    function setAlloc(
        address _lpAddress,
        uint256 _allocPoint
    ) public onlyOwner {
        require(lpPools[_lpAddress].whitelisted == true, "AMM LP Pool not whitelisted");
        totalLpRewardAllocs = totalLpRewardAllocs.sub(lpPools[_lpAddress].allocPoint).add(_allocPoint);
        lpPools[_lpAddress].allocPoint = _allocPoint;
    }

    function addLp(address _lpAddress, uint256 _allocPoint) public onlyOwner {
        require(lpPools[_lpAddress].whitelisted == false, "AMM LP Pool already added");
        uint256 lastRewardTs = block.timestamp > genesisTs ? block.timestamp : genesisTs;
        totalLpRewardAllocs = totalLpRewardAllocs.add(_allocPoint);

        //add lp to lpPools
        lpPools[_lpAddress].whitelisted = true;
        lpPools[_lpAddress].allocPoint = _allocPoint;
        lpPools[_lpAddress].lastRewardTs = lastRewardTs;
        lpPools[_lpAddress].accHaloPerShare = 0;
    }

    function removeLp(address _lpAddress) public onlyOwner {
        require(lpPools[_lpAddress].whitelisted == true, "AMM LP Pool not whitelisted");
        updateAmmRewardPool(_lpAddress);
        totalLpRewardAllocs = totalLpRewardAllocs.sub(lpPools[_lpAddress].allocPoint);
        lpPools[_lpAddress].whitelisted = false;
    }

    function setMinter(address _minter) public onlyOwner {
        minterContract = _minter;
    }

    //modifiers
    modifier onlyMinter() {
        require(msg.sender == minterContract, "Only minter contract can call this function");
        _;
    }

    //===========================================//
    //=============internal functions============//
    //===========================================//

    //Safe halo transfer function, just in case if rounding error causes pool to not have enough HALOs.
    function safeHaloTransfer(address _to, uint256 _amount) internal {
        uint256 haloBal = IERC20(haloTokenAddress).balanceOf(address(this));
        if (_amount > haloBal) {
            IERC20(haloTokenAddress).transfer(_to, haloBal);
        } else {
            IERC20(haloTokenAddress).transfer(_to, _amount);
        }
    }

    function calcReward(uint256 _from) internal returns (uint256){
        uint256 currentTs = block.timestamp;
        uint256 nMonthsStart = (_from.sub(genesisTs)).div(epochLength);
        uint256 nMonthsEnd = (currentTs.sub(genesisTs)).div(epochLength);
        require(nMonthsEnd >= nMonthsStart, "Error: wrong timestamp");
        if (nMonthsEnd == nMonthsStart) {
            uint256 diffTime = ((currentTs.sub(_from)).mul(DECIMALS)).div(epochLength);
            uint256 monthlyReward = startingRewards.mul(exp(decayBase, nMonthsStart));
            return diffTime.mul(monthlyReward).div(DECIMALS);
        }
        else if (nMonthsEnd - nMonthsStart == 1) {
            uint256 monthlyReward1 = startingRewards.mul(exp(decayBase, nMonthsStart));
            uint256 monthlyReward2 = monthlyReward1.mul(decayBase).div(DECIMALS);
            uint256 month1EndTs = genesisTs.add(nMonthsStart.mul(epochLength));
            uint256 diffTime1 = ((month1EndTs.sub(_from)).mul(DECIMALS)).div(epochLength);
            uint256 diffTime2 = ((currentTs.sub(month1EndTs)).mul(DECIMALS)).div(epochLength);
            return (diffTime1.mul(monthlyReward1).div(DECIMALS)).add(diffTime2.mul(monthlyReward2).div(DECIMALS));
        }
        else {
            uint256 monthlyRewardStart = startingRewards.mul(exp(decayBase, nMonthsStart));
            uint256 monthlyRewardEnd = startingRewards.mul(exp(decayBase, nMonthsEnd));
            uint256 aggMonthlyRewards = aggregatedMonthlyRewards(monthlyRewardStart, nMonthsStart, nMonthsEnd);
            uint256 month1EndTs = genesisTs.add(nMonthsStart.mul(epochLength));
            uint256 month2EndTs = genesisTs.add((nMonthsEnd-1).mul(epochLength));
            uint256 diffTime1 = ((month1EndTs.sub(_from)).mul(DECIMALS)).div(epochLength);
            uint256 diffTime2 = ((currentTs.sub(month2EndTs)).mul(DECIMALS)).div(epochLength);
            return (diffTime1.mul(monthlyRewardStart).div(DECIMALS)).add(diffTime2.mul(monthlyRewardEnd).div(DECIMALS)).add(aggMonthlyRewards);
        }
        //uint256 diffMonths = (((currentTs.sub(genesisTs)).mul(DECIMALS)).div(epochLength)).sub(nMonths.mul(DECIMALS));
    }

    //broken to separate function to avoid stack too deep error
    function aggregatedMonthlyRewards(uint256 monthlyRewardStart, uint256 nMonthsStart, uint256 nMonthsEnd) internal returns (uint256) {
        uint256 aggMonthlyRewards;
        uint256 monthlyReward = monthlyRewardStart;
        for (uint256 i = nMonthsStart+1; i < nMonthsEnd; i++) {
            monthlyReward = monthlyReward.mul(decayBase).div(DECIMALS);
            aggMonthlyRewards = aggMonthlyRewards.add(monthlyReward);
        }
        return aggMonthlyRewards;
    }

    function exp(uint256 m, uint256 n) internal returns (uint256) {
        uint256 x = DECIMALS;
        for (uint256 i = 0; i < n; i++) {
            x = x.mul(m).div(DECIMALS);
        }
        return x;
    }
}
