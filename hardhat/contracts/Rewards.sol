// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeMath } from '@openzeppelin/contracts/math/SafeMath.sol';
import { IMinter } from "./interfaces/IMinter.sol";

/// @title Rewards
/// @notice Rewards for participation in the halo ecosystem.
/// @dev Rewards for participation in the halo ecosystem.
contract Rewards is Ownable {
    /// @notice utility constant
    uint256 public constant DECIMALS = 10**18;
    /// @notice utility constant
    uint256 public constant BPS = 10**4;

    using SafeMath for uint256;

    /****************************************
   *                EVENTS                *
   ****************************************/

    event Log(uint256 loc, uint256 ts);
    event DepositLPTokens(address indexed user, address indexed lpAddress, uint256 amount);
    event WithdrawLPTokens(address indexed user, address indexed lpAddress, uint256 amount);
    event DepositMinter(address indexed user, address indexed collateralAddress, uint256 amount);
    event WithdrawMinter(address indexed user, address indexed collateralAddress, uint256 amount);
    event MinterRewardPoolUpdated(address collateralAddress, uint256 accHaloPerShare, uint256 lastRewardTs);
    event AmmRewardPoolUpdated(address lpAddress, uint256 accHaloPerShare, uint256 lastRewardTs);
    event VestedRewardsReleased(uint256 amount, uint256 timestamp);


    /****************************************
    *                VARIABLES              *
    ****************************************/


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

    /// @notice address of the halo erc20 token
    address public haloTokenAddress;
    /// @notice timestamp of rewards genesis
    uint256 public genesisTs;
    /// @notice rewards allocated for the first month
    uint256 public startingRewards;
    /// @notice decay base
    uint256 public decayBase; //multiply fraction by 10^18, keeps decimals consistent and gives enough entropy for more precision
    /// @notice length of a month = 30*24*60*60
    uint256 public epochLength;
    /// @notice percentage of rewards allocated to minter Lps
    uint256 public minterLpRewardsRatio; //in bps, multiply fraction by 10^4
    /// @notice percentage of rewards allocated to minter Amm Lps
    uint256 public ammLpRewardsRatio; //in bps, multiply fraction by 10^4
    /// @notice percentage of rewards allocated to stakers
    uint256 public vestingRewardsRatio; //in bps, multiply fraction by 10^4
    /// @notice total alloc points for amm lps
    uint256 public totalAmmLpAllocs; //total allocation points for all amm lps (the ratio defines percentage of rewards to a particular amm lp)
    /// @notice total alloc points for minter lps
    uint256 public totalMinterLpAllocs; //total allocation points for all minter lps (the ratio defines percentage of rewards to a particular minter lp)

    /// @notice reward for stakers already paid
    uint256 public vestingRewardsDebt;

    /// @notice address of the minter contract
    address public minterContract;

    /// @notice address of the staking contract
    address public haloChestContract;

    /// @notice timestamp of last allocation of rewards to stakers
    uint256 public lastHaloVestRewardTs;

    /// @notice info of whitelisted AMM Lp pools
    mapping(address => PoolInfo) public ammLpPools;
    /// @notice info of whitelisted minter Lp pools
    mapping(address => PoolInfo) public minterLpPools;
    /// @notice info of amm Lps
    mapping(address => mapping(address => UserInfo)) public ammLpUserInfo;
    /// @notice info of minter Lps
    mapping(address => mapping(address => UserInfo)) public minterLpUserInfo;


    /****************************************
    *           PUBLIC FUNCTIONS           *
    ****************************************/


    /// @notice initiates the contract with predefined params
    /// @dev initiates the contract with predefined params
    /// @param _haloTokenAddress address of the halo erc20 token
    /// @param _startingRewards rewards allocated for the first month
    /// @param _decayBase decay base
    /// @param _epochLength length of a month = 30*24*60*60
    /// @param _minterLpRewardsRatio percentage of rewards allocated to minter Lps in bps
    /// @param _ammLpRewardsRatio percentage of rewards allocated to minter Amm Lps in bps
    /// @param _vestingRewardsRatio percentage of rewards allocated to stakers in bps
    /// @param _minter address of the minter contract
    /// @param _genesisTs timestamp of rewards genesis
    /// @param _minterLpPools info of whitelisted minter Lp pools at genesis
    /// @param _ammLpPools info of whitelisted amm Lp pools at genesis
    constructor(
        address _haloTokenAddress,
        uint256 _startingRewards,
        uint256 _decayBase, //multiplied by 10^18
        uint256 _epochLength,
        uint256 _minterLpRewardsRatio, //in bps, multiplied by 10^4
        uint256 _ammLpRewardsRatio, //in bps, multiplied by 10^4
        uint256 _vestingRewardsRatio, //in bps, multiplied by 10^4
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
        vestingRewardsRatio = _vestingRewardsRatio;
        minterContract = _minter;
        genesisTs = _genesisTs;
        lastHaloVestRewardTs = genesisTs;
        for (uint8 i=0; i<_minterLpPools.length; i++) {
            addMinterCollateralType(_minterLpPools[i].poolAddress, _minterLpPools[i].allocPoint);
        }
        for (uint8 i=0; i<_ammLpPools.length; i++) {
            addAmmLp(_ammLpPools[i].poolAddress, _ammLpPools[i].allocPoint);
        }
    }

    /// @notice updates amm reward pool state
    /// @dev keeps track of accHaloPerShare as the number of stakers change
    /// @param _lpAddress address of the amm lp token
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
        uint256 haloReward = totalRewards.mul(ammLpRewardsRatio).mul(pool.allocPoint).div(totalAmmLpAllocs).div(BPS);

        pool.accHaloPerShare = pool.accHaloPerShare.add(
            haloReward.mul(DECIMALS).div(lpSupply)
        );

        pool.lastRewardTs = block.timestamp;

        emit AmmRewardPoolUpdated(_lpAddress, pool.accHaloPerShare, pool.lastRewardTs);

    }

    /// @notice updates minter reward pool state
    /// @dev keeps track of accHaloPerShare as the number of stakers change
    /// @param _collateralAddress address of the minter lp token
    function updateMinterRewardPool(address _collateralAddress) public {

        PoolInfo storage pool = minterLpPools[_collateralAddress];
        if (block.timestamp <= pool.lastRewardTs) {
            return;
        }

        uint256 minterCollateralSupply = IMinter(minterContract).getTotalCollateralByCollateralAddress(_collateralAddress);
        if (minterCollateralSupply == 0) {
            pool.lastRewardTs = block.timestamp;
            return;
        }

        uint256 totalRewards = calcReward(pool.lastRewardTs);
        uint256 haloReward = totalRewards.mul(minterLpRewardsRatio).mul(pool.allocPoint).div(totalMinterLpAllocs).div(BPS);

        pool.accHaloPerShare = pool.accHaloPerShare.add(
            haloReward.mul(DECIMALS).div(minterCollateralSupply)
        );

        pool.lastRewardTs = block.timestamp;

        emit MinterRewardPoolUpdated(_collateralAddress, pool.accHaloPerShare, pool.lastRewardTs);

    }

    /// @notice deposit amm lp tokens to earn rewards
    /// @dev deposit amm lp tokens to earn rewards
    /// @param _lpAddress address of the amm lp token
    /// @param _amount amount of lp tokens
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

    /// @notice deposit collateral to minter to earn rewards, called by minter contract
    /// @dev deposit collateral to minter to earn rewards, called by minter contract
    /// @param _collateralAddress address of the minter collateral token
    /// @param _account address of the user
    /// @param _amount amount of collateral tokens
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

    /// @notice withdraw amm lp tokens to earn rewards
    /// @dev withdraw amm lp tokens to earn rewards
    /// @param _lpAddress address of the amm lp token
    /// @param _amount amount of lp tokens
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

    /// @notice withdraw collateral from minter, called by minter contract
    /// @dev withdraw collateral from minter, called by minter contract
    /// @param _collateralAddress address of the minter collateral token
    /// @param _account address of the user
    /// @param _amount amount of collateral tokens
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

    /// @notice withdraw pending amm lp rewards
    /// @dev withdraw pending amm lp rewards, checks pending rewards, updates rewardDebt
    /// @param _lpAddress address of the amm lp token
    function withdrawPendingAmmLpRewards(address _lpAddress) external {

        PoolInfo storage pool = ammLpPools[_lpAddress];
        UserInfo storage user = ammLpUserInfo[_lpAddress][msg.sender];

        updateAmmRewardPool(_lpAddress);

        uint256 pending = user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(user.rewardDebt);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);

        safeHaloTransfer(msg.sender, pending);

    }

    /// @notice withdraw pending minter lp rewards
    /// @dev withdraw pending minter lp rewards, checks pending rewards, updates rewardDebt
    /// @param _collateralAddress address of the collateral token
    /// @param _account address of the user
    function withdrawPendingMinterLpRewards(address _collateralAddress, address _account) public onlyMinter {

        PoolInfo storage pool = minterLpPools[_collateralAddress];
        UserInfo storage user = minterLpUserInfo[_collateralAddress][_account];

        updateMinterRewardPool(_collateralAddress);

        uint256 pending = user.amount.mul(pool.accHaloPerShare).div(DECIMALS).sub(user.rewardDebt);
        user.rewardDebt = user.amount.mul(pool.accHaloPerShare).div(DECIMALS);

        safeHaloTransfer(_account, pending);

    }


    /****************************************
    *             VIEW FUNCTIONS            *
    ****************************************/

    /// @notice total amm lp alloc points
    /// @dev total amm lp alloc points
    /// @return total amm lp alloc points
    function totalAmmLpAllocationPoints() public view returns (uint256) {
        return totalAmmLpAllocs;
    }

    /// @notice total minter lp alloc points
    /// @dev total minter lp alloc points
    /// @return total minter lp alloc points
    function totalMinterLpAllocationPoints() public view returns (uint256) {
        return totalMinterLpAllocs;
    }

    /// @notice pending amm lp rewards
    /// @dev view function to check pending amm lp rewards for an account
    /// @param _lpAddress address of the amm lp token
    /// @param _account address of the user
    /// @return pending amm lp rewards for the user
    function pendingAmmLpUserRewards(
        address _lpAddress,
        address _account
    ) public view returns (uint256) {

        PoolInfo storage pool = ammLpPools[_lpAddress];
        UserInfo storage user = ammLpUserInfo[_lpAddress][_account];
        return (user.amount.mul(pool.accHaloPerShare).div(DECIMALS)).sub(user.rewardDebt);

    }

    /// @notice pending minter lp rewards
    /// @dev view function to check pending minter lp rewards for an account
    /// @param _collateralAddress address of the collateral token
    /// @param _account address of the user
    /// @return pending minter lp rewards for the user
    function pendingMinterLpUserRewards(
        address _collateralAddress,
        address _account
    ) public view returns (uint256) {

        PoolInfo storage pool = minterLpPools[_collateralAddress];
        UserInfo storage user = minterLpUserInfo[_collateralAddress][_account];
        return (user.amount.mul(pool.accHaloPerShare).div(DECIMALS)).sub(user.rewardDebt);

    }

    /// @notice pending rewards for stakers
    /// @dev view function to check pending rewards for stakers since last withdrawal to vesting contract
    /// @return pending rewards for stakers
    function pendingVestingRewards() public view returns (uint256) {

        uint256 nMonths = (now.sub(genesisTs)).div(epochLength);
        uint256 accMonthlyHalo = startingRewards.mul(sumExp(decayBase, nMonths)).div(DECIMALS);
        uint256 diffTime = ((now.sub(genesisTs.add(epochLength.mul(nMonths)))).mul(DECIMALS)).div(epochLength);

        uint256 thisMonthsReward = startingRewards.mul(exp(decayBase, nMonths)).div(DECIMALS);
        uint256 accHalo = (diffTime.mul(thisMonthsReward).div(DECIMALS)).add(accMonthlyHalo);
        uint256 pending = (accHalo.sub(vestingRewardsDebt)).mul(vestingRewardsRatio).div(BPS);

        return pending;

    }

    /// @notice checks if an amm lp address is whitelisted
    /// @dev checks if an amm lp address is whitelisted
    /// @param _lpAddress address of the lp token
    /// @return true if valid amm lp
    function isValidAmmLp(address _lpAddress) public view returns (bool) {
        return ammLpPools[_lpAddress].whitelisted;
    }

    /// @notice checks if a collateral address is whitelisted
    /// @dev checks if a collateral address is whitelisted
    /// @param _collateralAddress address of the collateral
    /// @return true if valid minter lp
    function isValidMinterLp(address _collateralAddress) public view returns (bool) {
        return minterLpPools[_collateralAddress].whitelisted;
    }

    /// @notice view amm lp pool info
    /// @dev view amm lp pool info
    /// @param _lpAddress address of the lp token
    /// @return poolinfo
    function getAmmLpPoolInfo(address _lpAddress) public view returns (PoolInfo memory) {
        return ammLpPools[_lpAddress];
    }

    /// @notice view minter lp pool info
    /// @dev view minter lp pool info
    /// @param _collateralAddress address of the collateral
    /// @return view minter lp pool info
    function getMinterLpPoolInfo(address _collateralAddress) public view returns (PoolInfo memory) {
        return minterLpPools[_collateralAddress];
    }


    /****************************************
    *            ADMIN FUNCTIONS            *
    ****************************************/


    /// @notice set alloc points for amm lp
    /// @dev set alloc points for amm lp
    /// @param _lpAddress address of the lp token
    /// @param _allocPoint alloc points
    function setAmmLpAlloc(
        address _lpAddress,
        uint256 _allocPoint
    ) public onlyOwner {

        require(ammLpPools[_lpAddress].whitelisted == true, "AMM LP Pool not whitelisted");
        totalAmmLpAllocs = totalAmmLpAllocs.sub(ammLpPools[_lpAddress].allocPoint).add(_allocPoint);
        ammLpPools[_lpAddress].allocPoint = _allocPoint;

    }

    /// @notice set alloc points for minter lp
    /// @dev set alloc points for minter lp
    /// @param _collateralAddress address of the collateral
    /// @param _allocPoint alloc points
    function setMinterLpAlloc(
        address _collateralAddress,
        uint256 _allocPoint
    ) public onlyOwner {

        require(minterLpPools[_collateralAddress].whitelisted == true, "Collateral type not whitelisted");
        totalMinterLpAllocs = totalMinterLpAllocs.sub(minterLpPools[_collateralAddress].allocPoint).add(_allocPoint);
        minterLpPools[_collateralAddress].allocPoint = _allocPoint;

    }

    /// @notice add an amm lp pool
    /// @dev add an amm lp pool
    /// @param _lpAddress address of the amm lp token
    /// @param _allocPoint alloc points
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

    /// @notice add a minter lp pool
    /// @dev add a minter lp pool
    /// @param _collateralAddress address of the collateral
    /// @param _allocPoint alloc points
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

    /// @notice remove an amm lp pool
    /// @dev remove an amm lp pool
    /// @param _lpAddress address of the amm lp token
    function removeAmmLp(address _lpAddress) public onlyOwner {

        require(ammLpPools[_lpAddress].whitelisted == true, "AMM LP Pool not whitelisted");
        totalAmmLpAllocs = totalAmmLpAllocs.sub(ammLpPools[_lpAddress].allocPoint);
        ammLpPools[_lpAddress].whitelisted = false;

    }

    /// @notice remove a minter lp pool
    /// @dev remove a minter lp pool
    /// @param _collateralAddress address of the collateral
    function removeMinterCollateralType(address _collateralAddress) public onlyOwner {

        require(minterLpPools[_collateralAddress].whitelisted == true, "Collateral type not whitelisted");
        updateMinterRewardPool(_collateralAddress);
        totalMinterLpAllocs = totalMinterLpAllocs.sub(minterLpPools[_collateralAddress].allocPoint);
        minterLpPools[_collateralAddress].whitelisted = false;

    }

    /// @notice releases pending vested rewards for stakers for extra bonus
    /// @dev releases pending vested rewards for stakers for extra bonus
    function releaseVestedRewards() public onlyOwner {
        require(block.timestamp > lastHaloVestRewardTs, "now<lastHaloVestRewardTs");
        uint256 nMonths = (now.sub(genesisTs)).div(epochLength);
        uint256 accMonthlyHalo = startingRewards.mul(sumExp(decayBase, nMonths)).div(DECIMALS);
        uint256 diffTime = ((now.sub(genesisTs.add(epochLength.mul(nMonths)))).mul(DECIMALS)).div(epochLength);

        uint256 thisMonthsReward = startingRewards.mul(exp(decayBase, nMonths)).div(DECIMALS);
        uint256 accHalo = (diffTime.mul(thisMonthsReward).div(DECIMALS)).add(accMonthlyHalo);
        uint256 pending = (accHalo.sub(vestingRewardsDebt)).mul(vestingRewardsRatio).div(BPS);
        vestingRewardsDebt = accHalo.mul(vestingRewardsRatio).div(BPS);
        safeHaloTransfer(haloChestContract, pending);
        emit VestedRewardsReleased(pending, block.timestamp);
    }

    /// @notice sets the address of the minter contract
    /// @dev set the address of the minter contract
    /// @param _minter address of the minter contract
    function setMinter(address _minter) public onlyOwner {
        minterContract = _minter;
    }

    /// @notice sets the address of the halochest contract
    /// @dev set the address of the halochest contract
    /// @param _haloChest address of the halochest contract
    function setHaloChest(address _haloChest) public onlyOwner {
        require(_haloChest != address(0), "Set to valid address");
        haloChestContract = _haloChest;
    }

    /// @notice set genesis timestamp
    /// @dev set genesis timestamp
    /// @param _genesisTs genesis timestamp
    function setGenesisTs(uint256 _genesisTs) public onlyOwner {
        require(block.timestamp < genesisTs, "Already initialized");
        genesisTs = _genesisTs;
    }

    /****************************************
    *               MODIFIERS              *
    ****************************************/

    /// @dev only minter contract can call function
    modifier onlyMinter() {
        require(msg.sender == minterContract, "Only minter contract can call this function");
        _;
    }


    /****************************************
    *          INTERNAL FUNCTIONS          *
    ****************************************/

    /// @notice transfer halo to users
    /// @dev transfer halo to users
    /// @param _to address of the recipient
    /// @param _amount amount of halo tokens
    function safeHaloTransfer(address _to, uint256 _amount) internal {

        uint256 haloBal = IERC20(haloTokenAddress).balanceOf(address(this));
        if (_amount > haloBal) {
            IERC20(haloTokenAddress).transfer(_to, haloBal);
        } else {
            IERC20(haloTokenAddress).transfer(_to, _amount);
        }

    }

    /// @notice calculates the pending rewards for last timestamp
    /// @dev calculates the pending rewards for last timestamp
    /// @param _from last timestamp when rewards were updated
    /// @return pending rewards since last update
    /* function calcReward(uint256 _from) internal returns (uint256){
        uint256 currentTs = block.timestamp;
        //require(_from>=genesisTs, "from<genesisTs"); //TEMP
        uint256 nMonthsStart = (_from.sub(genesisTs)).div(epochLength);
        //require(currentTs>=genesisTs, "currentTs<genesisTs"); //TEMP
        uint256 nMonthsEnd = (currentTs.sub(genesisTs)).div(epochLength);

        //require(nMonthsEnd >= nMonthsStart, "Error: wrong timestamp");

        if (nMonthsEnd == nMonthsStart) {
            //require(currentTs>=_from, "currentTs<from"); //TEMP
            uint256 diffTime = ((currentTs.sub(_from)).mul(DECIMALS)).div(epochLength);
            uint256 monthlyReward = startingRewards.mul(exp(decayBase, nMonthsStart));
            return diffTime.mul(monthlyReward).div(DECIMALS).div(DECIMALS);
        }

        else if (nMonthsEnd - nMonthsStart == 1) {
            uint256 monthlyReward1 = startingRewards.mul(exp(decayBase, nMonthsStart));
            uint256 monthlyReward2 = monthlyReward1.mul(decayBase).div(DECIMALS);
            uint256 month1EndTs = genesisTs.add(nMonthsEnd.mul(epochLength));
            //require(month1EndTs>_from, "month1EndTs<_from"); //TEMP
            uint256 diffTime1 = ((month1EndTs.sub(_from)).mul(DECIMALS)).div(epochLength);
            //require(currentTs>month1EndTs, "currentTs<month1EndTs"); //TEMP
            uint256 diffTime2 = ((currentTs.sub(month1EndTs)).mul(DECIMALS)).div(epochLength);
            return (diffTime1.mul(monthlyReward1).div(DECIMALS)).add(diffTime2.mul(monthlyReward2).div(DECIMALS)).div(DECIMALS);
        }

        else {
            uint256 monthlyRewardStart = startingRewards.mul(exp(decayBase, nMonthsStart));
            uint256 monthlyRewardEnd = startingRewards.mul(exp(decayBase, nMonthsEnd));
            uint256 aggMonthlyRewards = aggregatedMonthlyRewards(monthlyRewardStart, nMonthsStart, nMonthsEnd);
            uint256 month1EndTs = genesisTs.add((nMonthsStart+1).mul(epochLength));
            uint256 month2EndTs = genesisTs.add((nMonthsEnd).mul(epochLength));
            //require(month1EndTs>_from, "month1EndTs<_from agg"); //TEMP
            uint256 diffTime1 = ((month1EndTs.sub(_from)).mul(DECIMALS)).div(epochLength);
            //require(currentTs>month1EndTs, "currentTs<month1EndTs agg"); //TEMP
            uint256 diffTime2 = ((currentTs.sub(month2EndTs)).mul(DECIMALS)).div(epochLength);
            return ((diffTime1.mul(monthlyRewardStart).div(DECIMALS)).add(diffTime2.mul(monthlyRewardEnd).div(DECIMALS)).add(aggMonthlyRewards)).div(DECIMALS);
        }

    } */


    function calcReward(uint256 _from) internal view returns (uint256){

        uint256 nMonths = (_from.sub(genesisTs)).div(epochLength);
        uint256 accMonthlyHalo = startingRewards.mul(sumExp(decayBase, nMonths)).div(DECIMALS);
        uint256 diffTime = ((_from.sub(genesisTs.add(epochLength.mul(nMonths)))).mul(DECIMALS)).div(epochLength);

        uint256 thisMonthsReward = startingRewards.mul(exp(decayBase, nMonths)).div(DECIMALS);
        uint256 tillFrom = (diffTime.mul(thisMonthsReward).div(DECIMALS)).add(accMonthlyHalo);

        nMonths = (now.sub(genesisTs)).div(epochLength);
        accMonthlyHalo = startingRewards.mul(sumExp(decayBase, nMonths)).div(DECIMALS);
        diffTime = ((now.sub(genesisTs.add(epochLength.mul(nMonths)))).mul(DECIMALS)).div(epochLength);

        thisMonthsReward = startingRewards.mul(exp(decayBase, nMonths)).div(DECIMALS);
        uint256 tillNow = (diffTime.mul(thisMonthsReward).div(DECIMALS)).add(accMonthlyHalo);

        return tillNow.sub(tillFrom);

    }

    function aggregatedMonthlyRewards(
        uint256 monthlyRewardStart,
        uint256 nMonthsStart,
        uint256 nMonthsEnd
    ) internal view returns (uint256) {

        uint256 aggMonthlyRewards;
        uint256 monthlyReward = monthlyRewardStart;
        for (uint256 i = nMonthsStart+1; i < nMonthsEnd; i++) {
            monthlyReward = monthlyReward.mul(decayBase).div(DECIMALS);
            aggMonthlyRewards = aggMonthlyRewards.add(monthlyReward);
        }
        return aggMonthlyRewards;

    }

    function exp(uint256 m, uint256 n) internal pure returns (uint256) {
        uint256 x = DECIMALS;
        for (uint256 i = 0; i < n; i++) {
            x = x.mul(m).div(DECIMALS);
        }
        return x;
    }

    function sumExp(uint256 m, uint256 n) internal pure returns (uint256) {
        uint256 x = DECIMALS;
        uint256 s;
        for (uint256 i = 0; i < n; i++) {
            x = x.mul(m).div(DECIMALS);
            s = s.add(x);
        }
        return s;
    }
}
