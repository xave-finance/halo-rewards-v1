import { expect } from 'chai'
import {
  prepare,
  deploy,
  getBigNumber,
  createSLP,
  prepareWithLib,
  createAndInitializeCurve
} from './utils'
import { ethers } from 'hardhat'
import { parseUnits } from 'ethers/lib/utils'
import { ORACLE_DATA } from './utils/constants'
import { getFutureTime } from './utils/utils'
import { BigNumber } from 'ethers'

const expectedRNBWValues = {
  afterSingleConvert: 99680059,
  afterMultipleConvert: 199360118
}

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
    // deploy dfx mock environment
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
          ORACLE_DATA.EURS_USDC_ORACLE.roundId_,
          ORACLE_DATA.EURS_USDC_ORACLE.answer_,
          ORACLE_DATA.EURS_USDC_ORACLE.startedAt_,
          ORACLE_DATA.EURS_USDC_ORACLE.updatedAt_,
          ORACLE_DATA.EURS_USDC_ORACLE.answeredInRound_
        ]
      ],
      [
        'mockOracleUSDUSDC',
        this.MockOracle,
        [
          ORACLE_DATA.USD_USDC_ORACLE.roundId_,
          ORACLE_DATA.USD_USDC_ORACLE.answer_,
          ORACLE_DATA.USD_USDC_ORACLE.startedAt_,
          ORACLE_DATA.USD_USDC_ORACLE.updatedAt_,
          ORACLE_DATA.USD_USDC_ORACLE.answeredInRound_
        ]
      ],
      [
        'mockOracleCADCUSDC',
        this.MockOracle,
        [
          ORACLE_DATA.CAD_USDC_ORACLE.roundId_,
          ORACLE_DATA.CAD_USDC_ORACLE.answer_,
          ORACLE_DATA.CAD_USDC_ORACLE.startedAt_,
          ORACLE_DATA.CAD_USDC_ORACLE.updatedAt_,
          ORACLE_DATA.CAD_USDC_ORACLE.answeredInRound_
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

    // deploy mock tokens
    await deploy(this, [
      ['rnbw', this.ERC20Mock, ['RNBW', 'RNBW', getBigNumber('10000000')]],
      ['usdc', this.ERC20Mock, ['USDC', 'USDC', getBigNumber('10000000')]],
      ['eurs', this.ERC20Mock, ['EURS', 'EURS', getBigNumber('10000000')]],
      ['cadc', this.ERC20Mock, ['CADC', 'CADC', getBigNumber('10000000')]],
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
        'baseAssimilatorMock2',
        this.MockAssimilator,
        [this.mockOracleCADCUSDC.address, this.usdc.address, this.cadc.address]
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

    // Create curves and setup
    createAndInitializeCurve(
      this,
      'eursUsdcCurve',
      'HALODAO-V1-EURS-USDC',
      'HALO-V1',
      this.eurs,
      this.usdc,
      parseUnits('0.5'),
      parseUnits('0.5'),
      this.baseAssimilatorMock,
      this.quoteAssimilatorMock,
      this.alice.provider
    )

    createAndInitializeCurve(
      this,
      'cadcUsdcCurve',
      'HALODAO-V1-CADC-USDC',
      'HALO-V1',
      this.cadc,
      this.usdc,
      parseUnits('0.5'),
      parseUnits('0.5'),
      this.baseAssimilatorMock2,
      this.quoteAssimilatorMock,
      this.alice.provider
    )

    await createSLP(this, 'rnbwEth', this.rnbw, this.weth, getBigNumber(10))
    await createSLP(this, 'rnbwUSDC', this.rnbw, this.usdc, getBigNumber(10))
  })

  describe('convert', function () {
    it('should convert minted Curve LP fees to RNBW ', async function () {
      // Transfer to pot of gold for processing
      await this.eursUsdcCurve.transfer(
        this.potOfGold.address,
        parseUnits('100')
      )
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(0)

      expect(
        await this.eursUsdcCurve.balanceOf(this.potOfGold.address)
      ).to.not.equal(0)

      // args are matched after this call
      await expect(
        this.potOfGold.convert(
          this.eurs.address,
          await getFutureTime(this.alice.provider)
        )
      ).to.emit(this.potOfGold, 'LogConvert')

      expect(
        await this.eursUsdcCurve.balanceOf(this.potOfGold.address),
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

      expect(
        BigNumber.from(await this.rnbw.balanceOf(this.halohalo.address)),
        'No RNBW is sent to the RNBW pool'
      ).to.equal(expectedRNBWValues.afterSingleConvert)
    })

    it('should allow to convert multiple Curves LP fees using convertMultiple', async function () {
      await this.eursUsdcCurve.transfer(
        this.potOfGold.address,
        parseUnits('100')
      )
      await this.cadcUsdcCurve.transfer(
        this.potOfGold.address,
        parseUnits('100')
      )

      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(0)
      expect(
        await this.eursUsdcCurve.balanceOf(this.potOfGold.address)
      ).to.not.equal(0)
      expect(
        await this.cadcUsdcCurve.balanceOf(this.potOfGold.address)
      ).to.not.equal(0)

      await expect(
        this.potOfGold.convertMultiple(
          [this.eurs.address, this.cadc.address],
          await getFutureTime(this.alice.provider)
        )
      ).to.not.be.reverted

      expect(
        await this.eursUsdcCurve.balanceOf(this.potOfGold.address),
        'Curves are not converted'
      ).to.equal(0)

      expect(
        await this.cadcUsdcCurve.balanceOf(this.potOfGold.address),
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

      expect(
        await this.cadc.balanceOf(this.potOfGold.address),
        'CADC is not converted or not fully converted to RNBW'
      ).to.equal(0)

      expect(
        BigNumber.from(await this.rnbw.balanceOf(this.halohalo.address)),
        'No RNBW is sent to the RNBW pool'
      ).to.equal(expectedRNBWValues.afterMultipleConvert)
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

    it('should revert if swap in our AMM failed', async function () {
      const testValue = parseUnits('9000000')
      await this.eursUsdcCurve.transfer(this.potOfGold.address, testValue)

      // Trigger Curve/upper-halt revert
      // Reference: https://github.com/HaloDAO/dfx-protocol-clone/blob/d52269d65585670df2aae1262e6fb47184d44c73/contracts/CurveMath.sol#L242
      await expect(
        this.potOfGold.convert(
          this.eurs.address,
          await getFutureTime(this.alice.provider)
        )
      ).to.be.reverted

      expect(
        await this.eursUsdcCurve.balanceOf(this.potOfGold.address),
        'Curves withdrawal was successful'
      ).to.equal(testValue)
    })
  })
})
