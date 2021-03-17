// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import { Ownable } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/access/Ownable.sol";
import { IERC20 } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/math/SafeMath.sol";
import { IMinter } from "../interfaces/IMinter.sol";

/// @title Rewards
/// @notice
/// @dev
contract Rewards is Ownable {
    /// @notice
    uint256 public constant DECIMALS = 10**18;
    /// @notice
    uint256 public constant BPS = 10**4;

    using SafeMath for uint256;
    event Log(uint256 loc, uint256 ts);
    event DepositLPTokens(address indexed user, address indexed lpAddress, uint256 amount);
    event WithdrawLPTokens(address indexed user, address indexed lpAddress, uint256 amount);
    event DepositMinter(address indexed user, address indexed collateralAddress, uint256 amount);
    event WithdrawMinter(address indexed user, address indexed collateralAddress, uint256 amount);
    event MinterRewardPoolUpdated(address collateralAddress, uint256 accHaloPerShare, uint256 lastRewardTs);
    event AmmRewardPoolUpdated(address lpAddress, uint256 accHaloPerShare, uint256 lastRewardTs);
    event VestedRewardsReleased(uint256 amount, uint256 timestamp);

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

    /// @notice
    address public haloTokenAddress;
    /// @notice
    uint256 public genesisTs;
    /// @notice
    uint256 public startingRewards;
    /// @notice
    uint256 public decayBase; //multiply fraction by 10^18, keeps decimals consistent and gives enough entropy for more precision
    /// @notice
    uint256 public epochLength;
    /// @notice
    uint256 public minterLpRewardsRatio; //in bps, multiply fraction by 10^4
    /// @notice
    uint256 public ammLpRewardsRatio; //in bps, multiply fraction by 10^4
    /// @notice
    uint256 public vestingRewardsRatio; //in bps, multiply fraction by 10^4
    /// @notice
    uint256 public totalAmmLpAllocs; //total allocation points for all amm lps (the ratio defines percentage of rewards to a particular amm lp)
    /// @notice
    uint256 public totalMinterLpAllocs; //total allocation points for all minter lps (the ratio defines percentage of rewards to a particular minter lp)

    /// @notice
    uint256 public vestingRewardsDebt;

    /// @notice
    address public minterContract;

    /// @notice
    address public haloChestContract;

    uint256 public lastHaloVestRewardTs;

    /// @notice
    mapping(address => PoolInfo) public ammLpPools;
    /// @notice
    mapping(address => PoolInfo) public minterLpPools;
    /// @notice
    mapping(address => mapping(address => UserInfo)) public ammLpUserInfo;
    /// @notice
    mapping(address => mapping(address => UserInfo)) public minterLpUserInfo;

    /// @notice
    /// @dev
    /// @param _haloTokenAddress
    /// @param _startingRewards
    /// @param _decayBase
    /// @param _epochLength
    /// @param _minterLpRewardsRatio
    /// @param _ammLpRewardsRatio
    /// @param _vestingRewardsRatio
    /// @param _minter
    /// @param _haloChest
    /// @param _genesisTs
    /// @param _minterLpPools
    /// @param _ammLpPools
    /// @return
    constructor(
        address _haloTokenAddress,
        uint256 _startingRewards,
        uint256 _decayBase, //multiplied by 10^18
        uint256 _epochLength,
        uint256 _minterLpRewardsRatio, //in bps, multiplied by 10^4
        uint256 _ammLpRewardsRatio, //in bps, multiplied by 10^4
        uint256 _vestingRewardsRatio, //in bps, multiplied by 10^4
        address _minter,
        address _haloChest,
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
        vestingRewardsRatio = _vestingRewardsRatio;
        minterContract = _minter;
        haloChestContract = _haloChest;
        genesisTs = _genesisTs;
        lastHaloVestRewardTs = genesisTs;
        for (uint8 i=0; i<_minterLpPools.length; i++) {
            addMinterCollateralType(_minterLpPools[i].poolAddress, _minterLpPools[i].allocPoint);
        }
        for (uint8 i=0; i<_ammLpPools.length; i++) {
            addAmmLp(_ammLpPools[i].poolAddress, _ammLpPools[i].allocPoint);
        }
    }


    /// @notice
    /// @dev
    /// @param _lpAddress
    /// @return
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

    /// @notice
    /// @dev
    /// @param _collateralAddress
    /// @return
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

    /// @notice
    /// @dev
    /// @param _lpAddress
    /// @param _amount
    /// @return
    function depositPoolTokens(address _lpAddress, uint256 _amount) public {

        require(ammLpPools[_lpAddress].whitelisted == true, "Error: Amm Lp not allowed");
        PoolInfo storage pool = ammLpPools[_lpAddress];
        UserInfo storage user = ammLpUserInfo[_lpAddress][msg.sender];
        updateAmmRewardPool(_lpAddress);
        if (user.amount > 0) {
            uint256 unclaimed =
                user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(
                    user.rewardDebt
                );
            safeHaloTransfer(msg.sender, unclaimed);
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

    /// @notice
    /// @dev
    /// @param _collateralAddress
    /// @param _account
    /// @param _amount
    /// @return
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
            uint256 unclaimed =
                user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(
                    user.rewardDebt
                );
            safeHaloTransfer(_account, unclaimed);
        }
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);
        emit DepositMinter(_account, _collateralAddress, _amount);

    }

    /// @notice
    /// @dev
    /// @param _lpAddress
    /// @param _amount
    /// @return
    function withdrawPoolTokens(address _lpAddress, uint256 _amount) public {

        //require(lpPools[_lpAddress].whitelisted == true, "Error: Amm Lp not allowed"); //#DISCUSS: Allow withdraw from later blacklisted lps
        PoolInfo storage pool = ammLpPools[_lpAddress];
        UserInfo storage user = ammLpUserInfo[_lpAddress][msg.sender];
        require(user.amount >= _amount, "Error: Not enough balance");
        updateAmmRewardPool(_lpAddress);
        uint256 unclaimed =
            user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(
                user.rewardDebt
            );
        safeHaloTransfer(msg.sender, unclaimed);
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);
        IERC20(_lpAddress).transfer(address(msg.sender), _amount);
        emit WithdrawLPTokens(msg.sender, _lpAddress, _amount);

    }

    /// @notice
    /// @dev
    /// @param _collateralAddress
    /// @param _account
    /// @param _amount
    /// @return
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
        uint256 unclaimed =
            user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(
                user.rewardDebt
            );
        safeHaloTransfer(_account, unclaimed);
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);
        emit WithdrawMinter(_account, _collateralAddress, _amount);

    }

    /// @notice
    /// @dev
    /// @param _lpAddress
    /// @return
    function withdrawUnclaimedPoolRewards(address _lpAddress) external {

        PoolInfo storage pool = ammLpPools[_lpAddress];
        UserInfo storage user = ammLpUserInfo[_lpAddress][msg.sender];

        updateAmmRewardPool(_lpAddress);

        uint256 unclaimed = user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(user.rewardDebt);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);

        safeHaloTransfer(msg.sender, unclaimed);

    }

    /// @notice
    /// @dev
    /// @param _collateralAddress
    /// @param _account
    /// @return
    function withdrawUnclaimedMinterLpRewards(address _collateralAddress, address _account) public onlyMinter {

        PoolInfo storage pool = minterLpPools[_collateralAddress];
        UserInfo storage user = minterLpUserInfo[_collateralAddress][_account];

        updateMinterRewardPool(_collateralAddress);

        uint256 unclaimed = user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(user.rewardDebt);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);

        safeHaloTransfer(_account, unclaimed);

    }


    /// @notice
    /// @dev
    /// @return
    function totalAmmLpAllocationPoints() public view returns (uint256) {
        return totalAmmLpAllocs;
    }

    /// @notice
    /// @dev
    /// @return
    function totalMinterLpAllocationPoints() public view returns (uint256) {
        return totalMinterLpAllocs;
    }

    /// @notice
    /// @dev
    /// @param _lpAddress
    /// @param _account
    /// @return
    function getUnclaimedPoolRewardsByUserByPool(
        address _lpAddress,
        address _account
    ) public view returns (uint256) {

        PoolInfo storage pool = ammLpPools[_lpAddress];
        UserInfo storage user = ammLpUserInfo[_lpAddress][_account];
        return (user.amount.mul(pool.accHaloPerShare).div(DECIMALS)).sub(user.rewardDebt);

    }

    /// @notice
    /// @dev
    /// @param _collateralAddress
    /// @param _account
    /// @return
    function getUnclaimedMinterLpRewardsByUser(
        address _collateralAddress,
        address _account
    ) public view returns (uint256) {

        PoolInfo storage pool = minterLpPools[_collateralAddress];
        UserInfo storage user = minterLpUserInfo[_collateralAddress][_account];
        return (user.amount.mul(pool.accHaloPerShare).div(DECIMALS)).sub(user.rewardDebt);

    }

    /// @notice
    /// @dev
    /// @return
    function unclaimedVestingRewards() public view returns (uint256) {



    }

    /// @notice
    /// @dev
    /// @param _lpAddress
    /// @return
    function isValidAmmLp(address _lpAddress) public view returns (bool) {
        return ammLpPools[_lpAddress].whitelisted;
    }

    /// @notice
    /// @dev
    /// @param _collateralAddress
    /// @return
    function isValidMinterLp(address _collateralAddress) public view returns (bool) {
        return minterLpPools[_collateralAddress].whitelisted;
    }

    /// @notice
    /// @dev
    /// @param _lpAddress
    /// @return
    function getAmmLpPoolInfo(address _lpAddress) public view returns (PoolInfo memory) {
        return ammLpPools[_lpAddress];
    }

    /// @notice
    /// @dev
    /// @param _collateralAddress
    /// @return
    function getMinterLpPoolInfo(address _collateralAddress) public view returns (PoolInfo memory) {
        return minterLpPools[_collateralAddress];
    }

    /// @notice
    /// @dev
    /// @param _lpAddress
    /// @param _allocPoint
    /// @return
    function setAmmLpAlloc(
        address _lpAddress,
        uint256 _allocPoint
    ) public onlyOwner {

        require(ammLpPools[_lpAddress].whitelisted == true, "AMM LP Pool not whitelisted");
        totalAmmLpAllocs = totalAmmLpAllocs.sub(ammLpPools[_lpAddress].allocPoint).add(_allocPoint);
        ammLpPools[_lpAddress].allocPoint = _allocPoint;

    }

    /// @notice
    /// @dev
    /// @param _collateralAddress
    /// @param _allocPoint
    /// @return
    function setMinterLpAlloc(
        address _collateralAddress,
        uint256 _allocPoint
    ) public onlyOwner {

        require(minterLpPools[_collateralAddress].whitelisted == true, "Collateral type not whitelisted");
        totalMinterLpAllocs = totalMinterLpAllocs.sub(minterLpPools[_collateralAddress].allocPoint).add(_allocPoint);
        minterLpPools[_collateralAddress].allocPoint = _allocPoint;

    }

    /// @notice
    /// @dev
    /// @param _lpAddress
    /// @param _allocPoint
    /// @return
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

    /// @notice
    /// @dev
    /// @param _collateralAddress
    /// @param _allocPoint
    /// @return
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

    /// @notice
    /// @dev
    /// @param _lpAddress
    /// @return
    function removeAmmLp(address _lpAddress) public onlyOwner {

        require(ammLpPools[_lpAddress].whitelisted == true, "AMM LP Pool not whitelisted");
        updateAmmRewardPool(_lpAddress);
        totalAmmLpAllocs = totalAmmLpAllocs.sub(ammLpPools[_lpAddress].allocPoint);
        ammLpPools[_lpAddress].whitelisted = false;

    }

    /// @notice
    /// @dev
    /// @param _collateralAddress
    /// @return
    function removeMinterCollateralType(address _collateralAddress) public onlyOwner {

        require(minterLpPools[_collateralAddress].whitelisted == true, "Collateral type not whitelisted");
        updateMinterRewardPool(_collateralAddress);
        totalMinterLpAllocs = totalMinterLpAllocs.sub(minterLpPools[_collateralAddress].allocPoint);
        minterLpPools[_collateralAddress].whitelisted = false;

    }

    /// @notice
    /// @dev
    /// @return
    function releaseVestedRewards() public onlyOwner {
        require(block.timestamp > lastHaloVestRewardTs, "now<lastHaloVestRewardTs");
        uint256 nMonths = (now.sub(genesisTs)).div(epochLength);
        uint256 accMonthlyHalo = startingRewards.mul(sumExp(decayBase, nMonths)).div(DECIMALS);
        uint256 diffTime = ((now.sub(genesisTs.add(epochLength.mul(nMonths)))).mul(DECIMALS)).div(epochLength);

        uint256 thisMonthsReward = startingRewards.mul(exp(decayBase, nMonths)).div(DECIMALS);
        uint256 accHalo = (diffTime.mul(thisMonthsReward).div(DECIMALS)).add(accMonthlyHalo);
        uint256 unclaimed = (accHalo.sub(vestingRewardsDebt)).mul(vestingRewardsRatio).div(BPS);
        vestingRewardsDebt = accHalo.mul(vestingRewardsRatio).div(BPS);
        safeHaloTransfer(haloChestContract, unclaimed);
        emit VestedRewardsReleased(unclaimed, block.timestamp);
    }

    /// @notice
    /// @dev
    /// @param _minter
    /// @return
    function setMinter(address _minter) public onlyOwner {
        minterContract = _minter;
    }

    /// @notice
    /// @dev
    /// @param _minter
    /// @return
    function setHaloChest(address _haloChest) public onlyOwner {
        haloChestContract = _haloChest;
    }

    /// @notice
    /// @dev
    /// @return
    function initialize() public onlyOwner {
        require(block.timestamp < genesisTs, "Already initialized");
        genesisTs = block.timestamp;
    }

    /// @notice
    /// @dev
    /// @param _genesisTs
    /// @return
    function setGenesisTs(uint256 _genesisTs) public onlyOwner {
        require(block.timestamp < genesisTs, "Already initialized");
        genesisTs = _genesisTs;
    }

    /// @dev
    modifier onlyMinter() {
        require(msg.sender == minterContract, "Only minter contract can call this function");
        _;
    }

    /// @notice
    /// @dev
    /// @param _to
    /// @param _amount
    /// @return
    function safeHaloTransfer(address _to, uint256 _amount) internal {

        uint256 haloBal = IERC20(haloTokenAddress).balanceOf(address(this));
        if (_amount > haloBal) {
            IERC20(haloTokenAddress).transfer(_to, haloBal);
        } else {
            IERC20(haloTokenAddress).transfer(_to, _amount);
        }

    }

    /// @notice
    /// @dev
    /// @param _from
    /// @return
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
            require(month1EndTs>_from, "month1EndTs<_from agg"); //TEMP
            uint256 diffTime1 = ((month1EndTs.sub(_from)).mul(DECIMALS)).div(epochLength);
            require(currentTs>month1EndTs, "currentTs<month1EndTs agg"); //TEMP
            uint256 diffTime2 = ((currentTs.sub(month2EndTs)).mul(DECIMALS)).div(epochLength);
            return ((diffTime1.mul(monthlyRewardStart).div(DECIMALS)).add(diffTime2.mul(monthlyRewardEnd).div(DECIMALS)).add(aggMonthlyRewards)).div(DECIMALS);
        }

    }

    /// @notice
    /// @dev
    /// @param monthlyRewardStart
    /// @param nMonthsStart
    /// @param nMonthsEnd
    /// @return
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

    /// @notice
    /// @dev
    /// @param m
    /// @param n
    /// @return
    function exp(uint256 m, uint256 n) internal returns (uint256) {
        uint256 x = DECIMALS;
        for (uint256 i = 0; i < n; i++) {
            x = x.mul(m).div(DECIMALS);
        }
        return x;
    }

    /// @notice
    /// @dev
    /// @param m
    /// @param n
    /// @return
    function sumExp(uint256 m, uint256 n) internal returns (uint256) {
        uint256 x = DECIMALS;
        uint256 s;
        for (uint256 i = 0; i < n; i++) {
            x = x.mul(m).div(DECIMALS);
            s = s.add(x);
        }
        return s;
    }
}
