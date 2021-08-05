import { expect } from 'chai'
import {
  prepare,
  deploy,
  getBigNumber,
  createSLP,
  prepareWithLib
} from './utils'
import { ethers } from 'hardhat'
import { formatUnits, parseUnits } from 'ethers/lib/utils'
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
import {
  formatCurrency,
  getFutureTime,
  parseCurrency,
  TOKEN_DECIMAL,
  TOKEN_NAME
} from './utils/utils'

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

    console.log(
      `Orchestrator: ${this.orchestratorLib.address},
       Curves: ${this.curvesLib.address}, 
       Proportional Liquidity: ${this.proportionalLiquidity.address},
       Swaps: ${this.swapsLib.address},
       ViewLiquidity: ${this.viewLiquidityLib.address},
       EURS-USDC Oracle: ${this.mockOracleEURSUSDC.address}
       USD-USDC Oracle:  ${this.mockOracleUSDUSDC.address}
       `
    )

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
    console.log(`Curve factory address: ${this.curveFactory.address}`)

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
        [this.mockOracleEURSUSDC.address, this.eurs.address, this.usdc.address]
      ],
      [
        'quoteAssimilatorMock',
        this.MockAssimilator,
        [this.mockOracleUSDUSDC.address, this.usdc.address, this.usdc.address]
      ]
    ])

    console.log(
      `Base assimilator: ${this.baseAssimilatorMock.address}, Quote assimilator: ${this.quoteAssimilatorMock.address}`
    )

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
    curve = (await ethers.getContractAt('Curve', curveAddress)) as Curve

    // turn off whitelisting
    await curve.turnOffWhitelisting()
    // set curve params
    console.log(await curve.setParams(ALPHA, BETA, MAX, EPSILON, LAMBDA))

    const tokensToMint = parseUnits('500', 8)
    const curveDeposit = await curve.viewDeposit(tokensToMint)

    console.log('Usdc', formatUnits(curveDeposit[1][0], 8))
    console.log('Eurs', formatUnits(curveDeposit[1][1], 2))

    await this.usdc.approve(curveAddress, ethers.constants.MaxUint256)
    await this.eurs.approve(curveAddress, ethers.constants.MaxUint256)

    const depositTxn = await curve.deposit(
      tokensToMint,
      await getFutureTime(this.alice.provider)
    )

    console.log(await depositTxn.wait())
    const beforeBalance = await this.usdc.balanceOf(this.alice.address)

    const swapTxn = await curve.originSwap(
      this.eurs.address,
      this.usdc.address,
      parseCurrency(TOKEN_NAME.EURS, TOKEN_DECIMAL.EURS, '10'),
      0,
      await getFutureTime(this.alice.provider)
    )

    console.log('Swap txn: ', await swapTxn.wait())

    const afterBalance = await this.usdc.balanceOf(this.alice.address)

    console.log(
      'Difference after swap:',
      formatCurrency(
        TOKEN_NAME.EURS,
        TOKEN_DECIMAL.EURS,
        afterBalance.sub(beforeBalance)
      )
    )
  })

  describe('sketch tests', function () {
    it('testing array thing', async function () {
      // Test if curve is valid
      await expect(
        this.potOfGold.convert(this.weth.address, this.strudel.address)
      ).to.be.revertedWith('PotOfGold: Invalid curve')
    })
  })

  describe.skip('convert', function () {
    it('should convert RNBW - ETH', async function () {
      await this.rnbwEth.transfer(this.potOfGold.address, getBigNumber(1))
      await this.potOfGold.convert(this.rnbw.address, this.weth.address)
      expect(await this.rnbw.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.rnbwEth.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(
        '1897569270781234370'
      )
    })

    it('should convert USDC - ETH', async function () {
      await this.usdcEth.transfer(this.potOfGold.address, getBigNumber(1))
      await this.potOfGold.convert(this.usdc.address, this.weth.address)
      expect(await this.rnbw.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.usdcEth.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(
        '1590898251382934275'
      )
    })

    it('should convert $TRDL - ETH', async function () {
      await this.strudelEth.transfer(this.potOfGold.address, getBigNumber(1))
      await this.potOfGold.convert(this.strudel.address, this.weth.address)
      expect(await this.rnbw.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.strudelEth.balanceOf(this.potOfGold.address)).to.equal(
        0
      )
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(
        '1590898251382934275'
      )
    })

    it('should convert USDC - RNBW', async function () {
      await this.rnbwUSDC.transfer(this.potOfGold.address, getBigNumber(1))
      await this.potOfGold.convert(this.usdc.address, this.rnbw.address)
      expect(await this.rnbw.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.rnbwUSDC.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(
        '1897569270781234370'
      )
    })

    it('should convert using standard ETH path', async function () {
      await this.daiEth.transfer(this.potOfGold.address, getBigNumber(1))
      await this.potOfGold.convert(this.dai.address, this.weth.address)
      expect(await this.rnbw.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.daiEth.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(
        '1590898251382934275'
      )
    })

    it('converts MIC/USDC using more complex path', async function () {
      await this.micUSDC.transfer(this.potOfGold.address, getBigNumber(1))
      await this.potOfGold.setBridge(this.usdc.address, this.rnbw.address)
      await this.potOfGold.setBridge(this.mic.address, this.usdc.address)
      await this.potOfGold.convert(this.mic.address, this.usdc.address)
      expect(await this.rnbw.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.micUSDC.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(
        '1590898251382934275'
      )
    })

    it('converts DAI/USDC using more complex path', async function () {
      await this.daiUSDC.transfer(this.potOfGold.address, getBigNumber(1))
      await this.potOfGold.setBridge(this.usdc.address, this.rnbw.address)
      await this.potOfGold.setBridge(this.dai.address, this.usdc.address)
      await this.potOfGold.convert(this.dai.address, this.usdc.address)
      expect(await this.rnbw.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.daiUSDC.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(
        '1590898251382934275'
      )
    })

    it('converts DAI/MIC using two step path', async function () {
      await this.daiMIC.transfer(this.potOfGold.address, getBigNumber(1))
      await this.potOfGold.setBridge(this.dai.address, this.usdc.address)
      await this.potOfGold.setBridge(this.mic.address, this.dai.address)
      await this.potOfGold.convert(this.dai.address, this.mic.address)
      expect(await this.rnbw.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.daiMIC.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(
        '1200963016721363748'
      )
    })

    it('reverts if it loops back', async function () {
      await this.daiMIC.transfer(this.potOfGold.address, getBigNumber(1))
      await this.potOfGold.setBridge(this.dai.address, this.mic.address)
      await this.potOfGold.setBridge(this.mic.address, this.dai.address)
      await expect(this.potOfGold.convert(this.dai.address, this.mic.address))
        .to.be.reverted
    })

    it('reverts if caller is not EOA', async function () {
      await this.rnbwEth.transfer(this.potOfGold.address, getBigNumber(1))

      await expect(
        this.exploiter.convert(this.rnbw.address, this.weth.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if pair does not exist', async function () {
      await expect(
        this.potOfGold.convert(this.mic.address, this.micUSDC.address)
      ).to.be.revertedWith('PotOfGold: Invalid pair')
    })

    it('reverts if no path is available', async function () {
      await this.micUSDC.transfer(this.potOfGold.address, getBigNumber(1))
      await expect(
        this.potOfGold.convert(this.mic.address, this.usdc.address)
      ).to.be.revertedWith('PotOfGold: Cannot convert')
      expect(await this.rnbw.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.micUSDC.balanceOf(this.potOfGold.address)).to.equal(
        getBigNumber(1)
      )
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(0)
    })
  })

  describe.skip('convertMultiple', function () {
    it('should allow to convert multiple', async function () {
      await this.daiEth.transfer(this.potOfGold.address, getBigNumber(1))
      await this.rnbwEth.transfer(this.potOfGold.address, getBigNumber(1))
      await this.potOfGold.convertMultiple(
        [this.dai.address, this.rnbw.address],
        [this.weth.address, this.weth.address]
      )
      expect(await this.rnbw.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.daiEth.balanceOf(this.potOfGold.address)).to.equal(0)
      expect(await this.rnbw.balanceOf(this.halohalo.address)).to.equal(
        '3186583558687783097'
      )
    })
  })
})
