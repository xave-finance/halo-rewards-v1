// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import { Ownable } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/access/Ownable.sol";
import { IERC20 } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "OpenZeppelin/openzeppelin-contracts@3.3.0/contracts/math/SafeMath.sol";

interface IMinter {

    function depositByCollateralAddress(
        uint256 _collateralAmount,
        uint256 _numTokens,
        address _collateralAddress
    ) external;

    function redeemByCollateralAddress(
        uint256 _tokenAmount,
        address _collateralAddress
    ) external;

    function getTotalCollateralByCollateralAddress(
        address _collateralAddress
    ) external view returns(uint256);

    function getUserCollateralByCollateralAddress(
        address _user,
        address _collateralAddress
    ) external view returns(uint256);
}
