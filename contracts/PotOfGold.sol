// SPDX-License-Identifier: MIT

// P1 - P3: OK
pragma solidity 0.6.12;
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

import {IUniswapV2ERC20} from './uniswapv2/interfaces/IUniswapV2ERC20.sol';
import {IUniswapV2Pair} from './uniswapv2/interfaces/IUniswapV2Pair.sol';
import {IUniswapV2Factory} from './uniswapv2/interfaces/IUniswapV2Factory.sol';

// There's a pot of gold at the end of the RNBW

// T1 - T4: OK
contract PotOfGold is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  // V1 - V5: OK
  IUniswapV2Factory public immutable factory;
  //0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac
  // V1 - V5: OK
  address public immutable rainbowPool;
  //0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272
  // V1 - V5: OK
  address private immutable rnbw;
  //0x6B3595068778DD592e39A122f4f5a5cF09C90fE2
  // V1 - V5: OK
  address private immutable weth;
  //0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

  // V1 - V5: OK
  mapping(address => address) internal _bridges;

  // E1: OK
  event LogBridgeSet(address indexed token, address indexed bridge);
  // E1: OK
  event LogConvert(
    address indexed server,
    address indexed token0,
    address indexed token1,
    uint256 amount0,
    uint256 amount1,
    uint256 amountRNBW
  );

  constructor(
    address _factory,
    address _rainbowPool,
    address _rnbw,
    address _weth
  ) public {
    factory = IUniswapV2Factory(_factory);
    rainbowPool = _rainbowPool;
    rnbw = _rnbw;
    weth = _weth;
  }

  // F1 - F10: OK
  // C1 - C24: OK
  function bridgeFor(address token) public view returns (address bridge) {
    bridge = _bridges[token];
    if (bridge == address(0)) {
      bridge = weth;
    }
  }

  // F1 - F10: OK
  // C1 - C24: OK
  function setBridge(address token, address bridge) external onlyOwner {
    // Checks
    require(
      token != rnbw && token != weth && token != bridge,
      'PotOfGold: Invalid bridge'
    );

    // Effects
    _bridges[token] = bridge;
    emit LogBridgeSet(token, bridge);
  }

  // F1 - F10: OK
  // F3: _convert is separate to save gas by only checking the 'onlyEOA' modifier once in case of convertMultiple
  // F6: There is an exploit to add lots of SUSHI to the bar, run convert, then remove the SUSHI again.
  //     As the size of the SushiBar has grown, this requires large amounts of funds and isn't super profitable anymore
  //     The onlyEOA modifier prevents this being done with a flash loan.
  // C1 - C24: OK
  function convert(address token0, address token1) external onlyOwner() {
    _convert(token0, token1);
  }

  // F1 - F10: OK, see convert
  // C1 - C24: OK
  // C3: Loop is under control of the caller
  function convertMultiple(address[] calldata token0, address[] calldata token1)
    external
    onlyOwner()
  {
    // TODO: This can be optimized a fair bit, but this is safer and simpler for now
    uint256 len = token0.length;
    for (uint256 i = 0; i < len; i++) {
      _convert(token0[i], token1[i]);
    }
  }

  // F1 - F10: OK
  // C1- C24: OK
  function _convert(address token0, address token1) internal {
    // Interactions
    // S1 - S4: OK

    // TODO: Change to dfx
    IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(token0, token1));
    require(address(pair) != address(0), 'PotOfGold: Invalid pair');
    // balanceOf: S1 - S4: OK
    // transfer: X1 - X5: OK
    // TODO: Change to dfx
    IERC20(address(pair)).safeTransfer(
      address(pair),
      // TODO: Change to dfx
      pair.balanceOf(address(this))
    );
    // X1 - X5: OK
    // TODO: Change to dfx
    (uint256 amount0, uint256 amount1) = pair.burn(address(this));
    // TODO: Change to dfx
    if (token0 != pair.token0()) {
      (amount0, amount1) = (amount1, amount0);
    }
    emit LogConvert(
      msg.sender,
      token0,
      token1,
      amount0,
      amount1,
      _convertStep(token0, token1, amount0, amount1)
    );
  }

  // F1 - F10: OK
  // C1 - C24: OK
  // All safeTransfer, _swap, _toSUSHI, _convertStep: X1 - X5: OK
  function _convertStep(
    address token0,
    address token1,
    uint256 amount0,
    uint256 amount1
  ) internal returns (uint256 rnbwOut) {
    // Interactions
    if (token0 == token1) {
      uint256 amount = amount0.add(amount1);
      if (token0 == rnbw) {
        IERC20(rnbw).safeTransfer(rainbowPool, amount);
        rnbwOut = amount;
      } else if (token0 == weth) {
        rnbwOut = _toRNBW(weth, amount);
      } else {
        address bridge = bridgeFor(token0);
        amount = _swap(token0, bridge, amount, address(this));
        rnbwOut = _convertStep(bridge, bridge, amount, 0);
      }
    } else if (token0 == rnbw) {
      // eg. RNBW - ETH
      IERC20(rnbw).safeTransfer(rainbowPool, amount0);
      rnbwOut = _toRNBW(token1, amount1).add(amount0);
    } else if (token1 == rnbw) {
      // eg. USDT - RNBW
      IERC20(rnbw).safeTransfer(rainbowPool, amount1);
      rnbwOut = _toRNBW(token0, amount0).add(amount1);
    } else if (token0 == weth) {
      // eg. ETH - USDC
      rnbwOut = _toRNBW(
        weth,
        _swap(token1, weth, amount1, address(this)).add(amount0)
      );
    } else if (token1 == weth) {
      // eg. USDT - ETH
      rnbwOut = _toRNBW(
        weth,
        _swap(token0, weth, amount0, address(this)).add(amount1)
      );
    } else {
      // eg. MIC - USDT
      address bridge0 = bridgeFor(token0);
      address bridge1 = bridgeFor(token1);
      if (bridge0 == token1) {
        // eg. MIC - USDT - and bridgeFor(MIC) = USDT
        rnbwOut = _convertStep(
          bridge0,
          token1,
          _swap(token0, bridge0, amount0, address(this)),
          amount1
        );
      } else if (bridge1 == token0) {
        // eg. WBTC - DSD - and bridgeFor(DSD) = WBTC
        rnbwOut = _convertStep(
          token0,
          bridge1,
          amount0,
          _swap(token1, bridge1, amount1, address(this))
        );
      } else {
        rnbwOut = _convertStep(
          bridge0,
          bridge1, // eg. USDT - DSD - and bridgeFor(DSD) = WBTC
          _swap(token0, bridge0, amount0, address(this)),
          _swap(token1, bridge1, amount1, address(this))
        );
      }
    }
  }

  // F1 - F10: OK
  // C1 - C24: OK
  // All safeTransfer, swap: X1 - X5: OK
  function _swap(
    address fromToken,
    address toToken,
    uint256 amountIn,
    address to
  ) internal returns (uint256 amountOut) {
    // Checks
    // X1 - X5: OK
    // TODO: Change to dfx
    IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(fromToken, toToken));
    // TODO: Change to dfx
    require(address(pair) != address(0), 'PotOfGold: Cannot convert');

    // Interactions
    // X1 - X5: OK
    // TODO: Change to dfx
    (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
    uint256 amountInWithFee = amountIn.mul(997);
    // TODO: Change to dfx
    if (fromToken == pair.token0()) {
      amountOut =
        amountInWithFee.mul(reserve1) /
        reserve0.mul(1000).add(amountInWithFee);
      // TODO: Change to dfx
      IERC20(fromToken).safeTransfer(address(pair), amountIn);
      // TODO: Change to dfx
      pair.swap(0, amountOut, to, new bytes(0));
      // TODO: Add maximum slippage?
    } else {
      // TODO: Change to dfx
      amountOut =
        amountInWithFee.mul(reserve0) /
        reserve1.mul(1000).add(amountInWithFee);
      // TODO: Change to dfx
      IERC20(fromToken).safeTransfer(address(pair), amountIn);
      // TODO: Change to dfx
      pair.swap(amountOut, 0, to, new bytes(0));
      // TODO: Add maximum slippage?
    }
  }

  // F1 - F10: OK
  // C1 - C24: OK
  function _toRNBW(address token, uint256 amountIn)
    internal
    returns (uint256 amountOut)
  {
    // X1 - X5: OK
    amountOut = _swap(token, rnbw, amountIn, rainbowPool);
  }
}
