// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './HaloHalo.sol';

contract RewardsManager is Ownable {
  IERC20 public halo;
  HaloHalo halohalo;
  // in percent
  uint256 private vestingRatio;
  address private rewardsContract;
  address private haloHaloContract;

  using SafeMath for uint256;
  uint256 public constant BPS = 10**4;

  constructor(
    uint256 _initialVestingRatio, //in bps, multiplied by 10^4
    address _rewardsContract,
    address _haloHaloContract,
    IERC20 _halo
  ) public {
    vestingRatio = _initialVestingRatio;
    rewardsContract = _rewardsContract;
    haloHaloContract = _haloHaloContract;
    halohalo = HaloHalo(haloHaloContract);
    halo = _halo;
  }

  event SentVestedRewardsEvent(uint256 currentVestedRewards);
  event ReleasedRewardsToRewardsContractEvent(uint256 currentReleasedRewards);

  function releaseEpochRewards(uint256 _amount) external onlyOwner {
    uint256 currentHaloHaloBalance = halo.balanceOf(address(this));
    require(
      _amount >= currentHaloHaloBalance,
      "amount is less than this contract's halohalo balance"
    );

    uint256 currentVestedRewards = _amount.mul(vestingRatio).div(BPS);
    uint256 currentRewardsReleased = _amount.sub(currentVestedRewards);

    // Transfer to rewards contract
    convertAndTransferToRewardsContract(currentRewardsReleased);
    // Transfer to halohalo contract
    transferToHaloHaloContract(currentVestedRewards);
  }

  /****************************************
   *            ADMIN FUNCTIONS           *
   ****************************************/
  function setVestingRatio(uint256 _newVestingRatio) external onlyOwner {
    vestingRatio = _newVestingRatio;
  }

  function setRewardsContract(address _rewardsContract) external onlyOwner {
    rewardsContract = _rewardsContract;
  }

  function setHaloHaloContract(address _haloHaloContract) external onlyOwner {
    haloHaloContract = _haloHaloContract;
    halohalo = HaloHalo(haloHaloContract);
  }

  /****************************************
   *            VIEW FUNCTIONS            *
   ****************************************/
  function getVestingRatio() external view returns (uint256) {
    return vestingRatio;
  }

  function getRewardsContract() external view returns (address) {
    return rewardsContract;
  }

  function getHaloHaloContract() external view returns (address) {
    return haloHaloContract;
  }

  /****************************************
   *            UTILITY FUNCTIONS          *
   ****************************************/

  function transferToHaloHaloContract(uint256 _amount) internal {
    halo.transfer(haloHaloContract, _amount);
    SentVestedRewardsEvent(_amount);
  }

  function convertAndTransferToRewardsContract(uint256 _amount) internal {
    halo.approve(haloHaloContract, _amount);
    halohalo.enter(_amount);
    uint256 currentHaloHaloBalance = halohalo.balanceOf(address(this));

    require(currentHaloHaloBalance > 0, 'No HALOHALO in contract');

    halohalo.transfer(rewardsContract, currentHaloHaloBalance);
    ReleasedRewardsToRewardsContractEvent(currentHaloHaloBalance);
  }
}
