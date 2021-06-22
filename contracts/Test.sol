// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
contract Test {
    using SafeMath for uint256;
    function get() public view returns (uint256) {
        return uint256(250000*10**18).mul(8000).div(10000).div(2592000);
    }
}
