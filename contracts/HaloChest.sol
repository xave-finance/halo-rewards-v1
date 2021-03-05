// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;

import { ERC20 } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/math/SafeMath.sol";

contract HaloChest is ERC20("HaloChest", "xHALO"){
    using SafeMath for uint256;
    IERC20 public halo;

    // Define the Halo token contract
    constructor(IERC20 _halo) public {
        halo = _halo;
    }

    // Stake HALOs for xHALOs.
    // Locks Halo and mints xHalo
    function enter(uint256 _amount) public {
        // Gets the amount of Halo locked in the contract
        uint256 totalHalo = halo.balanceOf(address(this));
        // Gets the amount of xHalo in existence
        uint256 totalShares = totalSupply();
        // If no xHalo exists, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalHalo == 0) {
            _mint(msg.sender, _amount);
        }
        // Calculate and mint the amount of xHalo the Halo is worth. The ratio will change overtime, as xHalo is burned/minted and Halo deposited from LP rewards.
        else {
            uint256 xHaloAmount = _amount.mul(totalShares).div(totalHalo);
            _mint(msg.sender, xHaloAmount);
        }
        // Lock the Halo in the contract
        halo.transferFrom(msg.sender, address(this), _amount);
    }

    // Claim HALOs from xHALOs.
    // Unclocks the staked + gained Halo and burns xHalo
    function leave(uint256 _share) public {
        // Gets the amount of xHalo in existence
        uint256 totalShares = totalSupply();
        // Calculates the amount of Halo the xHalo is worth
        uint256 xHaloAmount = _share.mul(halo.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        halo.transfer(msg.sender, xHaloAmount);
    }
}
