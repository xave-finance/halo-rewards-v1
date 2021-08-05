// SPDX-License-Identifier: MIT

// P1 - P3: OK
pragma solidity 0.6.12;
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

import {Curve} from './dfx/Curve.sol';
import {CurveFactory} from './dfx/CurveFactory.sol';
import {IUniswapV2ERC20} from './uniswapv2/interfaces/IUniswapV2ERC20.sol';
import {IUniswapV2Pair} from './uniswapv2/interfaces/IUniswapV2Pair.sol';
import {IUniswapV2Factory} from './uniswapv2/interfaces/IUniswapV2Factory.sol';

// There's a pot of gold at the end of the RNBW

// T1 - T4: OK
contract PotOfGold is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 private constant DEADLINE = 600;

  IUniswapV2Factory public immutable factory;
  CurveFactory public immutable curveFactory;

  address public immutable rainbowPool;
  address private immutable rnbw;
  address private immutable usdc;

  // address private immutable usdc;
  // TODO: same format?
  //IERC20 private constant USDC =
  //  IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

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
    address _curveFactory,
    address _rainbowPool,
    address _rnbw,
    //address _weth
    address _usdc
  ) public {
    factory = IUniswapV2Factory(_factory);
    curveFactory = CurveFactory(_curveFactory);
    rainbowPool = _rainbowPool;
    rnbw = _rnbw;
    usdc = _usdc;
  }

  function convert(address token0, address token1) external onlyOwner {
    _convert(token0, token1);
  }

  // F1 - F10: OK, see convert
  // C1 - C24: OK
  // C3: Loop is under control of the caller
  function convertMultiple(address[] calldata token0, address[] calldata token1)
    external
    onlyOwner
  {
    // TODO: This can be optimized a fair bit, but this is safer and simpler for now
    uint256 len = token0.length;
    for (uint256 i = 0; i < len; i++) {
      _convert(token0[i], token1[i]);
    }
  }

  function _convert(address token0, address token1) internal {
    //IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(token0, token1));
    // 1 - Check if curve exists, else revert
    // get curve returns address
    Curve curve = Curve(curveFactory.getCurve(token0, token1));
    require(address(curve) != address(0), 'PotOfGold: Invalid curve');

    // 2 - transfer curves to -- why do i need to transfer?
    // TODO: Safe transfer in lib?
    //curve.transfer(address(curve), curve.balanceOf(address(this)));

    // 3 - withdraw curves to get token0 and token 1
    // deadline in unix?
    curve.withdraw((curve.balanceOf(address(this))), DEADLINE);

    // 4 - proceed to convert step to deal with the tokens after withdrawal
    // note: withdrawals returns uint256[]
    // TODO

    // 5 - assign returned variables as amount variables
    /*
    (uint256 amount0, uint256 amount1) = curve.withdraw(
      curve.balanceOf(address(this)),
      _deadline
    );
    */
    // TODO: Change to dfx

    // if (token0 != pair.token0()) {
    //   (amount0, amount1) = (amount1, amount0);
    // }

    /*
    emit LogConvert(
      msg.sender,
      token0,
      token1,
      amount0,
      amount1,
      _convertStep(token0, token1, amount0, amount1)
    );
    */
  }

  // All safeTransfer, _swap, _toRNBW, _convertStep: X1 - X5: OK
  function _convertStep(
    address token0,
    address token1,
    uint256 amount0,
    uint256 amount1
  ) internal returns (uint256 rnbwOut) {
    // 1 - If not usdc, then _toUSDC
    // 2 - If USDC, then _toRNBW
    // 3 - Send RNBW to rainbowpool
  }

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
