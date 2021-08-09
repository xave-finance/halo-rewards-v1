import { expect } from 'chai'
import {
  prepare,
  deploy,
  getBigNumber,
  createSLP,
  prepareWithLib
} from './utils'
import { ethers } from 'hardhat'
import { parseUnits } from 'ethers/lib/utils'
import { Curve } from '../typechain/Curve'
import {
  ALPHA,
  BETA,
  EPSILON,
  EURS_USDC_ORACLE,
  LAMBDA,
  MAX,
  USD_USDC_ORACLE
} from './utils/constants'
import { getFutureTime } from './utils/utils'
import { BigNumber } from 'ethers'

let curveAddress, curve: Curve

describe('PotOfGold', function () {
  before(async function () {
    await prepare(this, [
      'PotOfGold',
      'HaloHalo',
      'PotOfGoldExploitMock',
      'ERC20Mock',
      'UniswapV2Factory',
      'UniswapV2Pair',
      'Curves',
      'Orchestrator',
      'ProportionalLiquidity',
      'Swaps',
      'ViewLiquidity',
      'MockAssimilator',
      'MockUsdUsdcAssimilator',
      'MockOracle'
    ])
  })

  beforeEach(async function () {
    // deploy dfx
    await deploy(this, [
      ['orchestratorLib', this.Orchestrator, []],
      ['curvesLib', this.Curves, []],
      ['proportionalLiquidity', this.ProportionalLiquidity, []],
      ['viewLiquidityLib', this.ViewLiquidity, []],
      ['swapsLib', this.Swaps, []],
      [
        'mockOracleEURSUSDC',
        this.MockOracle,
        [
          EURS_USDC_ORACLE.roundId_,
          EURS_USDC_ORACLE.answer_,
          EURS_USDC_ORACLE.startedAt_,
          EURS_USDC_ORACLE.updatedAt_,
          EURS_USDC_ORACLE.answeredInRound_
        ]
      ],
      [
        'mockOracleUSDUSDC',
        this.MockOracle,
        [
          USD_USDC_ORACLE.roundId_,
          USD_USDC_ORACLE.answer_,
          USD_USDC_ORACLE.startedAt_,
          USD_USDC_ORACLE.updatedAt_,
          USD_USDC_ORACLE.answeredInRound_
        ]
      ]
    ])

    await prepareWithLib(this, 'CurveFactory', {
      libraries: {
        Curves: this.curvesLib.address,
        Orchestrator: this.orchestratorLib.address,
        ProportionalLiquidity: this.proportionalLiquidity.address,
        Swaps: this.swapsLib.address,
        ViewLiquidity: this.viewLiquidityLib.address
      }
    })

    await deploy(this, [['curveFactory', this.CurveFactory, []]])

    // deploy uniswap
    await deploy(this, [
      ['rnbw', this.ERC20Mock, ['RNBW', 'RNBW', getBigNumber('10000000')]],
      ['dai', this.ERC20Mock, ['DAI', 'DAI', getBigNumber('10000000')]],
      ['mic', this.ERC20Mock, ['MIC', 'MIC', getBigNumber('10000000')]],
      ['usdc', this.ERC20Mock, ['USDC', 'USDC', getBigNumber('10000000')]],
      ['eurs', this.ERC20Mock, ['EURS', 'EURS', getBigNumber('10000000')]],
      ['weth', this.ERC20Mock, ['WETH', 'ETH', getBigNumber('10000000')]],
      ['strudel', this.ERC20Mock, ['$TRDL', '$TRDL', getBigNumber('10000000')]],
      ['factory', this.UniswapV2Factory, [this.alice.address]]
    ])

    // deploy assimilator after deploying erc tokens and mock oracle
    await deploy(this, [
      [
        'baseAssimilatorMock',
        this.MockAssimilator,
        [this.mockOracleEURSUSDC.address, this.usdc.address, this.eurs.address]
      ],
      [
        'quoteAssimilatorMock',
        this.MockUsdUsdcAssimilator,
        [this.mockOracleUSDUSDC.address, this.usdc.address]
      ]
    ])

    await deploy(this, [['halohalo', this.HaloHalo, [this.rnbw.address]]])

    await deploy(this, [
      [
        'potOfGold',
        this.PotOfGold,
        [
          this.factory.address,
          this.curveFactory.address,
          this.halohalo.address,
          this.rnbw.address,
          this.usdc.address
        ]
      ]
    ])

    await deploy(this, [
      ['exploiter', this.PotOfGoldExploitMock, [this.potOfGold.address]]
    ])

    await createSLP(this, 'rnbwEth', this.rnbw, this.weth, getBigNumber(10))
    await createSLP(
      this,
      'strudelEth',
      this.strudel,
      this.weth,
      getBigNumber(10)
    )
    await createSLP(this, 'daiEth', this.dai, this.weth, getBigNumber(10))
    await createSLP(this, 'usdcEth', this.usdc, this.weth, getBigNumber(10))
    await createSLP(this, 'micUSDC', this.mic, this.usdc, getBigNumber(10))
    await createSLP(this, 'rnbwUSDC', this.rnbw, this.usdc, getBigNumber(10))
    await createSLP(this, 'daiUSDC', this.dai, this.usdc, getBigNumber(10))
    await createSLP(this, 'daiMIC', this.dai, this.mic, getBigNumber(10))

    await this.curveFactory.newCurve(
      'HALODAO V1',
      'HALO-V1',
      this.eurs.address,
      this.usdc.address,
      parseUnits('0.5'),
      parseUnits('0.5'),
      this.baseAssimilatorMock.address,
      this.quoteAssimilatorMock.address
    )

    curveAddress = await this.curveFactory.getCurve(
      this.eurs.address,
      this.usdc.address
    )

    // TODO: Convert to have uniform implementation with others
    curve = (await ethers.getContractAt('Curve', curveAddress)) as Curve

    // turn off whitelisting
    await curve.turnOffWhitelisting()
    // set curve params
    await curve.setParams(ALPHA, BETA, MAX, EPSILON, LAMBDA)

    const tokensToMint = parseUnits('10000000')
    await this.usdc.approve(curveAddress, ethers.constants.MaxUint256)
    await this.eurs.approve(curveAddress, ethers.constants.MaxUint256)

    const depositTxn = await curve.deposit(
      tokensToMint,
      await getFutureTime(this.alice.provider)
    )

    await depositTxn.wait()

    // swapping for initial balance
    await curve.originSwap(
      this.eurs.address,
      this.usdc.address,
      parseUnits('10000'),
      0,
      await getFutureTime(this.alice.provider)
    )
  })

  describe('convert', function () {
    it('should convert Curve to RNBW ', async function () {
      // Transfer to pot of gold for processing
      await curve.transfer(this.potOfGold.address, parseUnits('100'))

      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(0)
      expect(await curve.balanceOf(this.potOfGold.address)).to.not.equal(0)

      // args are matched after this call
      await expect(
        this.potOfGold.convert(
          this.eurs.address,
          await getFutureTime(this.alice.provider)
        )
      ).to.emit(this.potOfGold, 'LogConvert')

      expect(
        await curve.balanceOf(this.potOfGold.address),
        'Curves are not converted'
      ).to.equal(0)

      expect(
        await this.usdc.balanceOf(this.potOfGold.address),
        'USDC is not converted or not fully converted to RNBW'
      ).to.equal(0)

      expect(
        await this.eurs.balanceOf(this.potOfGold.address),
        'EURS is not converted or not fully converted to RNBW'
      ).to.equal(0)

      // TODO: Change?
      expect(
        BigNumber.from(await this.rnbw.balanceOf(this.halohalo.address)),
        'No RNBW is sent to the RNBW pool'
      ).to.not.equal(0)
    })

    it('should revert if swap in our AMM failed', async function () {
      // TODO: Check for possible exploit?
      // Transfer to pot of gold for processing
      await curve.transfer(this.potOfGold.address, parseUnits('9000000'))

      // args are matched after this call
      await expect(
        this.potOfGold.convert(
          this.eurs.address,
          await getFutureTime(this.alice.provider)
        )
      ).to.be.reverted // revert message depends on the Curve contracts
    })

    it('reverts if caller is not owner', async function () {
      await this.rnbwEth.transfer(this.potOfGold.address, getBigNumber(1))

      await expect(
        this.exploiter.convert(
          this.rnbw.address,
          await getFutureTime(this.alice.provider)
        )
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('should revert when there are no curve on the given tokens', async function () {
      // Test if curve is valid
      await expect(
        this.potOfGold.convert(
          this.strudel.address,
          await getFutureTime(this.alice.provider)
        )
      ).to.be.revertedWith('PotOfGold: Invalid curve')
    })
  })

  describe.skip('convertMultiple', function () {
    it('should allow to convert multiple', async function () {})
  })
})
