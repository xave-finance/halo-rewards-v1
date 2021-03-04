// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import { Ownable } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/access/Ownable.sol";
import { IERC20 } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/math/SafeMath.sol";
import { IMinter } from "../interfaces/IMinter.sol";

contract Rewards is Ownable {
    uint256 public constant DECIMALS = 10**18;
    uint256 public constant BPS = 10**4;

    using SafeMath for uint256;
    //using FixedPoint for FixedPoint.Unsigned;
    //using SafeERC20 for IERC20;
    //using SafeERC20 for ExpandedIERC20;
    event Log(uint256 loc, uint256 ts);
    event DepositLPTokens(address indexed user, address indexed lpAddress, uint256 amount);
    event WithdrawLPTokens(address indexed user, address indexed lpAddress, uint256 amount);
    event DepositMinter(address indexed user, address indexed collateralAddress, uint256 amount);
    event WithdrawMinter(address indexed user, address indexed collateralAddress, uint256 amount);
    event MinterRewardPoolUpdated(address collateralAddress, uint256 accHaloPerShare, uint256 lastRewardTs);
    event AmmRewardPoolUpdated(address lpAddress, uint256 accHaloPerShare, uint256 lastRewardTs);

    struct UserInfo {
        uint256 amount; // How many colalteral or LP tokens the user has provided.
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

    address public haloTokenAddress;
    uint256 public genesisTs;
    uint256 public startingRewards;
    uint256 public decayBase; //multiply fraction by 10^18, keeps decimals consistent and gives enough entropy for more precision
    uint256 public epochLength;
    uint256 public minterLpRewardsRatio; //in bps, multiply fraction by 10^4
    uint256 public ammLpRewardsRatio; //in bps, multiply fraction by 10^4
    uint256 public totalAmmLpAllocs; //total allocation points for all amm lps (the ratio defines percentage of rewards to a particular amm lp)
    uint256 public totalMinterLpAllocs; //total allocation points for all minter lps (the ratio defines percentage of rewards to a particular minter lp)

    uint256 public bonusVestPeriod;
    uint256 public vestReward;

    address public minterContract;

    mapping(address => PoolInfo) public ammLpPools;
    mapping(address => PoolInfo) public minterLpPools;
    mapping(address => mapping(address => UserInfo)) public ammLpUserInfo;
    mapping(address => mapping(address => UserInfo)) public minterLpUserInfo;
    mapping(address => uint256) public unclaimedRewards;

    //===========================================//
    //=================constructor===============//
    //===========================================//

    constructor(
        address _haloTokenAddress,
        uint256 _startingRewards,
        uint256 _decayBase, //multiplied by 10^18
        uint256 _epochLength,
        uint256 _minterLpRewardsRatio, //in bps, multiplied by 10^4
        uint256 _ammLpRewardsRatio, //in bps, multiplied by 10^4
        address _minter,
        uint256 _genesisTs,
        Pool[] memory _minterLpPools,
        Pool[] memory _ammLpPools
    ) public {
        haloTokenAddress = _haloTokenAddress;
        startingRewards = _startingRewards;
        decayBase = _decayBase;
        epochLength = _epochLength;
        minterLpRewardsRatio = _minterLpRewardsRatio;
        ammLpRewardsRatio = _ammLpRewardsRatio;
        minterContract = _minter;
        genesisTs = _genesisTs;
        for (uint8 i=0; i<_minterLpPools.length; i++) {
            addMinterCollateralType(_minterLpPools[i].poolAddress, _minterLpPools[i].allocPoint);
        }
        for (uint8 i=0; i<_ammLpPools.length; i++) {
            addAmmLp(_ammLpPools[i].poolAddress, _ammLpPools[i].allocPoint);
        }
    }


    //===========================================//
    //==============public functions=============//
    //===========================================//


    function updateAmmRewardPool(address _lpAddress) public {

        PoolInfo storage pool = ammLpPools[_lpAddress];
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
        uint256 haloReward = totalRewards.mul(ammLpRewardsRatio).mul(pool.allocPoint).div(totalAmmLpAllocs).div(BPS);

        //IERC20(haloTokenAddress).mint(address(this), haloReward);

        pool.accHaloPerShare = pool.accHaloPerShare.add(
            haloReward.mul(DECIMALS).div(lpSupply)
        );

        pool.lastRewardTs = block.timestamp;

        emit AmmRewardPoolUpdated(_lpAddress, pool.accHaloPerShare, pool.lastRewardTs);

    }

    function updateMinterRewardPool(address _collateralAddress) public {

        PoolInfo storage pool = minterLpPools[_collateralAddress];
        if (block.timestamp <= pool.lastRewardTs) {
            return;
        }
        //uint256 minterCollateralSupply = IERC20(_lpAddress).balanceOf(address(this));
        uint256 minterCollateralSupply = IMinter(minterContract).getTotalCollateralByCollateralAddress(_collateralAddress);
        if (minterCollateralSupply == 0) {
            pool.lastRewardTs = block.timestamp;
            return;
        }

        uint256 totalRewards = calcReward(pool.lastRewardTs);
        uint256 allocPoint = pool.allocPoint;
        uint256 haloReward = totalRewards.mul(minterLpRewardsRatio).mul(pool.allocPoint).div(totalMinterLpAllocs).div(BPS);

        pool.accHaloPerShare = pool.accHaloPerShare.add(
            haloReward.mul(DECIMALS).div(minterCollateralSupply)
        );

        pool.lastRewardTs = block.timestamp;

        emit MinterRewardPoolUpdated(_collateralAddress, pool.accHaloPerShare, pool.lastRewardTs);

    }

    // Deposit LP tokens to earn HALO Rewards.
    function depositAmmLpTokens(address _lpAddress, uint256 _amount) public {

        require(ammLpPools[_lpAddress].whitelisted == true, "Error: Amm Lp not allowed");
        PoolInfo storage pool = ammLpPools[_lpAddress];
        UserInfo storage user = ammLpUserInfo[_lpAddress][msg.sender];
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
        emit DepositLPTokens(msg.sender, _lpAddress, _amount);

    }

    function depositMinter(
        address _collateralAddress,
        address _account,
        uint256 _amount
    ) public onlyMinter {

        require(minterLpPools[_collateralAddress].whitelisted == true, "Error: Collateral type not allowed");
        PoolInfo storage pool = minterLpPools[_collateralAddress];
        UserInfo storage user = minterLpUserInfo[_collateralAddress][_account];
        updateMinterRewardPool(_collateralAddress);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(
                    user.rewardDebt
                );
            safeHaloTransfer(_account, pending);
        }
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);
        emit DepositMinter(_account, _collateralAddress, _amount);

    }

    // Withdraw LP tokens.
    function withdrawAmmLpTokens(address _lpAddress, uint256 _amount) public {

        //require(lpPools[_lpAddress].whitelisted == true, "Error: Amm Lp not allowed"); //#DISCUSS: Allow withdraw from later blacklisted lps
        PoolInfo storage pool = ammLpPools[_lpAddress];
        UserInfo storage user = ammLpUserInfo[_lpAddress][msg.sender];
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
        emit WithdrawLPTokens(msg.sender, _lpAddress, _amount);

    }

    function withdrawMinter(
        address _collateralAddress,
        address _account,
        uint256 _amount
    ) public onlyMinter {

        //require(lpPools[_lpAddress].whitelisted == true, "Error: Amm Lp not allowed"); //#DISCUSS: Allow withdraw from later blacklisted lps
        PoolInfo storage pool = minterLpPools[_collateralAddress];
        UserInfo storage user = minterLpUserInfo[_collateralAddress][_account];
        require(user.amount >= _amount, "Error: Not enough balance");
        updateMinterRewardPool(_collateralAddress);
        uint256 pending =
            user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(
                user.rewardDebt
            );
        safeHaloTransfer(_account, pending);
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);
        emit WithdrawMinter(_account, _collateralAddress, _amount);

    }

    function withdrawPendingAmmLpRewards(address _lpAddress) external {

        PoolInfo storage pool = ammLpPools[_lpAddress];
        UserInfo storage user = ammLpUserInfo[_lpAddress][msg.sender];

        updateAmmRewardPool(_lpAddress);

        uint256 pending = user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(user.rewardDebt);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);
        
        safeHaloTransfer(msg.sender, pending);

    }

    function withdrawPendingMinterLpRewards(address _collateralAddress, address _account) public onlyMinter {

        PoolInfo storage pool = minterLpPools[_collateralAddress];
        UserInfo storage user = minterLpUserInfo[_collateralAddress][_account];

        updateMinterRewardPool(_collateralAddress);

        uint256 pending = user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(user.rewardDebt);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);

        safeHaloTransfer(_account, pending);

    }

    //===========================================//
    //===============view functions==============//
    //===========================================//

    function totalAmmLpAllocationPoints() public view returns (uint256) {
        return totalAmmLpAllocs;
    }

    function totalMinterLpAllocationPoints() public view returns (uint256) {
        return totalMinterLpAllocs;
    }

    function pendingAmmLpUserRewards(
        address _lpAddress,
        address _account
    ) public view returns (uint256) {

        PoolInfo storage pool = ammLpPools[_lpAddress];
        UserInfo storage user = ammLpUserInfo[_lpAddress][_account];
        return (user.amount.mul(pool.accHaloPerShare).div(DECIMALS)).sub(user.rewardDebt);

    }

    function pendingMinterLpUserRewards(
        address _collateralAddress,
        address _account
    ) public view returns (uint256) {

        PoolInfo storage pool = minterLpPools[_collateralAddress];
        UserInfo storage user = minterLpUserInfo[_collateralAddress][_account];
        return (user.amount.mul(pool.accHaloPerShare).div(DECIMALS)).sub(user.rewardDebt);

    }

    //utility view functions
    function isValidAmmLp(address _lpAddress) public view returns (bool) {
        return ammLpPools[_lpAddress].whitelisted;
    }

    function isValidMinterLp(address _collateralAddress) public view returns (bool) {
        return minterLpPools[_collateralAddress].whitelisted;
    }

    function getAmmLpPoolInfo(address _lpAddress) public view returns (PoolInfo memory) {
        return ammLpPools[_lpAddress];
    }

    function getMinterLpPoolInfo(address _collateralAddress) public view returns (PoolInfo memory) {
        return minterLpPools[_collateralAddress];
    }

    //===========================================//
    //===============admin functions=============//
    //===========================================//

    // Update the given pool's HALO allocation point. Can only be called by the owner.
    function setAmmLpAlloc(
        address _lpAddress,
        uint256 _allocPoint
    ) public onlyOwner {

        require(ammLpPools[_lpAddress].whitelisted == true, "AMM LP Pool not whitelisted");
        totalAmmLpAllocs = totalAmmLpAllocs.sub(ammLpPools[_lpAddress].allocPoint).add(_allocPoint);
        ammLpPools[_lpAddress].allocPoint = _allocPoint;

    }

    function setMinterLpAlloc(
        address _collateralAddress,
        uint256 _allocPoint
    ) public onlyOwner {

        require(minterLpPools[_collateralAddress].whitelisted == true, "Collateral type not whitelisted");
        totalMinterLpAllocs = totalMinterLpAllocs.sub(minterLpPools[_collateralAddress].allocPoint).add(_allocPoint);
        minterLpPools[_collateralAddress].allocPoint = _allocPoint;

    }

    function addAmmLp(
        address _lpAddress,
        uint256 _allocPoint
    ) public onlyOwner {

        require(ammLpPools[_lpAddress].whitelisted == false, "AMM LP Pool already added");
        uint256 lastRewardTs = block.timestamp > genesisTs ? block.timestamp : genesisTs;
        totalAmmLpAllocs = totalAmmLpAllocs.add(_allocPoint);

        //add lp to ammLpPools
        ammLpPools[_lpAddress].whitelisted = true;
        ammLpPools[_lpAddress].allocPoint = _allocPoint;
        ammLpPools[_lpAddress].lastRewardTs = lastRewardTs;
        ammLpPools[_lpAddress].accHaloPerShare = 0;

    }

    function addMinterCollateralType(
        address _collateralAddress,
        uint256 _allocPoint
    ) public onlyOwner {

        require(minterLpPools[_collateralAddress].whitelisted == false, "Collateral type already added");
        uint256 lastRewardTs = block.timestamp > genesisTs ? block.timestamp : genesisTs;
        totalMinterLpAllocs = totalMinterLpAllocs.add(_allocPoint);

        //add lp to ammLpPools
        minterLpPools[_collateralAddress].whitelisted = true;
        minterLpPools[_collateralAddress].allocPoint = _allocPoint;
        minterLpPools[_collateralAddress].lastRewardTs = lastRewardTs;
        minterLpPools[_collateralAddress].accHaloPerShare = 0;

    }

    function removeAmmLp(address _lpAddress) public onlyOwner {

        require(ammLpPools[_lpAddress].whitelisted == true, "AMM LP Pool not whitelisted");
        updateAmmRewardPool(_lpAddress);
        totalAmmLpAllocs = totalAmmLpAllocs.sub(ammLpPools[_lpAddress].allocPoint);
        ammLpPools[_lpAddress].whitelisted = false;

    }

    function removeMinterCollateralType(address _collateralAddress) public onlyOwner {

        require(minterLpPools[_collateralAddress].whitelisted == true, "Collateral type not whitelisted");
        updateMinterRewardPool(_collateralAddress);
        totalMinterLpAllocs = totalMinterLpAllocs.sub(minterLpPools[_collateralAddress].allocPoint);
        minterLpPools[_collateralAddress].whitelisted = false;

    }

    function setMinter(address _minter) public onlyOwner {
        minterContract = _minter;
    }

    function initialize() public onlyOwner {
        require(block.timestamp < genesisTs, "Already initialized");
        genesisTs = block.timestamp;
    }

    function setGenesisTs(uint256 _genesisTs) public onlyOwner {
        require(block.timestamp < genesisTs, "Already initialized");
        genesisTs = _genesisTs;
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
        require(_from>=genesisTs, "from<genesisTs"); //TEMP
        uint256 nMonthsStart = (_from.sub(genesisTs)).div(epochLength);
        require(currentTs>=genesisTs, "currentTs<genesisTs"); //TEMP
        uint256 nMonthsEnd = (currentTs.sub(genesisTs)).div(epochLength);

        require(nMonthsEnd >= nMonthsStart, "Error: wrong timestamp");

        if (nMonthsEnd == nMonthsStart) {
            require(currentTs>=_from, "currentTs<from"); //TEMP
            uint256 diffTime = ((currentTs.sub(_from)).mul(DECIMALS)).div(epochLength);
            uint256 monthlyReward = startingRewards.mul(exp(decayBase, nMonthsStart));
            return diffTime.mul(monthlyReward).div(DECIMALS).div(DECIMALS);
        }

        else if (nMonthsEnd - nMonthsStart == 1) {
            uint256 monthlyReward1 = startingRewards.mul(exp(decayBase, nMonthsStart));
            uint256 monthlyReward2 = monthlyReward1.mul(decayBase).div(DECIMALS);
            uint256 month1EndTs = genesisTs.add(nMonthsEnd.mul(epochLength));
            require(month1EndTs>_from, "month1EndTs<_from"); //TEMP
            uint256 diffTime1 = ((month1EndTs.sub(_from)).mul(DECIMALS)).div(epochLength);
            require(currentTs>month1EndTs, "currentTs<month1EndTs"); //TEMP
            uint256 diffTime2 = ((currentTs.sub(month1EndTs)).mul(DECIMALS)).div(epochLength);
            return (diffTime1.mul(monthlyReward1).div(DECIMALS)).add(diffTime2.mul(monthlyReward2).div(DECIMALS)).div(DECIMALS);
        }

        else {
            uint256 monthlyRewardStart = startingRewards.mul(exp(decayBase, nMonthsStart));
            uint256 monthlyRewardEnd = startingRewards.mul(exp(decayBase, nMonthsEnd));
            uint256 aggMonthlyRewards = aggregatedMonthlyRewards(monthlyRewardStart, nMonthsStart, nMonthsEnd);
            uint256 month1EndTs = genesisTs.add((nMonthsStart+1).mul(epochLength));
            uint256 month2EndTs = genesisTs.add((nMonthsEnd).mul(epochLength));
            emit Log(0, _from);
            emit Log(1, genesisTs);
            emit Log(2, nMonthsStart);
            emit Log(3, nMonthsEnd);
            emit Log(4, epochLength);
            emit Log(5, month1EndTs);
            require(month1EndTs>_from, "month1EndTs<_from agg"); //TEMP
            uint256 diffTime1 = ((month1EndTs.sub(_from)).mul(DECIMALS)).div(epochLength);
            require(currentTs>month1EndTs, "currentTs<month1EndTs agg"); //TEMP
            uint256 diffTime2 = ((currentTs.sub(month2EndTs)).mul(DECIMALS)).div(epochLength);
            return ((diffTime1.mul(monthlyRewardStart).div(DECIMALS)).add(diffTime2.mul(monthlyRewardEnd).div(DECIMALS)).add(aggMonthlyRewards)).div(DECIMALS);
        }
        //uint256 diffMonths = (((currentTs.sub(genesisTs)).mul(DECIMALS)).div(epochLength)).sub(nMonths.mul(DECIMALS));

    }

    //broken to separate function to avoid stack too deep error
    function aggregatedMonthlyRewards(
        uint256 monthlyRewardStart,
        uint256 nMonthsStart,
        uint256 nMonthsEnd
    ) internal returns (uint256) {

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
