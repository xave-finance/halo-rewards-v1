import { expect } from 'chai'
import {
  prepare,
  deploy,
  getBigNumber,
  createSLP,
  prepareWithLib
} from './utils'
import { ethers } from 'hardhat'

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
      'ViewLiquidity'
    ])
  })

  beforeEach(async function () {
    // deploy dfx
    await deploy(this, [
      ['orchestratorLib', this.Orchestrator, []],
      ['curvesLib', this.Curves, []],
      ['proportionalLiquidity', this.ProportionalLiquidity, []],
      ['viewLiquidityLib', this.ViewLiquidity, []],
      ['swapsLib', this.Swaps, []]
    ])

    console.log(
      `Orchestrator: ${this.orchestratorLib.address},
       Curves: ${this.curvesLib.address}, 
       Proportional Liquidity: ${this.proportionalLiquidity.address},
       Swaps: ${this.swapsLib.address},
       ViewLiquidity: ${this.viewLiquidityLib.address}
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
      ['weth', this.ERC20Mock, ['WETH', 'ETH', getBigNumber('10000000')]],
      ['strudel', this.ERC20Mock, ['$TRDL', '$TRDL', getBigNumber('10000000')]],
      ['factory', this.UniswapV2Factory, [this.alice.address]]
    ])

    await deploy(this, [['halohalo', this.HaloHalo, [this.rnbw.address]]])

    await deploy(this, [
      [
        'potOfGold',
        this.PotOfGold,
        [
          this.factory.address,
          this.halohalo.address,
          this.rnbw.address,
          this.weth.address
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
  })

  describe('setBridge', function () {
    it('does not allow to set bridge for RNBW', async function () {
      await expect(
        this.potOfGold.setBridge(this.rnbw.address, this.weth.address)
      ).to.be.revertedWith('PotOfGold: Invalid bridge')
    })

    it('does not allow to set bridge for WETH', async function () {
      await expect(
        this.potOfGold.setBridge(this.weth.address, this.rnbw.address)
      ).to.be.revertedWith('PotOfGold: Invalid bridge')
    })

    it('does not allow to set bridge to itself', async function () {
      await expect(
        this.potOfGold.setBridge(this.dai.address, this.dai.address)
      ).to.be.revertedWith('PotOfGold: Invalid bridge')
    })

    it('emits correct event on bridge', async function () {
      await expect(
        this.potOfGold.setBridge(this.dai.address, this.rnbw.address)
      )
        .to.emit(this.potOfGold, 'LogBridgeSet')
        .withArgs(this.dai.address, this.rnbw.address)
    })
  })
  describe('convert', function () {
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

  describe('convertMultiple', function () {
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
