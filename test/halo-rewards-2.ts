import { time } from '@openzeppelin/test-helpers'

import { expect } from 'chai'
import { ethers } from 'hardhat'

let contractCreatorAccount
let rewardsContract
let collateralERC20Contract
let lpTokenContract
let lpTokenContract2
let minterContract
let ubeContract
let haloTokenContract
let halohaloContract
const genesisBlock = 0
const DECIMALS = 10 ** 18
const BPS = 10 ** 4
const INITIAL_MINT = 10 ** 6
const minterLpRewardsRatio = 0.4 * BPS
let owner
let addr1
let addr2
let addrs

const expectedHALORewardPerBlock = ethers.BigNumber.from('29000000000000000000')

describe.only('Rewards Contract', async () => {
  beforeEach(async () => {
    ;[owner, addr1, addr2, ...addrs] = await ethers.getSigners()
    console.log('===================Deploying Contracts=====================')

    const CollateralERC20 = await ethers.getContractFactory('CollateralERC20')
    collateralERC20Contract = await CollateralERC20.deploy(
      'collateral ERC20',
      'collateral ERC20'
    )
    await collateralERC20Contract.deployed()
    console.log('collateralERC20 deployed')

    await collateralERC20Contract.mint(
      owner.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )
    console.log(`${INITIAL_MINT} collateral ERC20 minted to ${owner.address}`)
    console.log()

    const LpToken = await ethers.getContractFactory('LpToken')
    lpTokenContract = await LpToken.deploy('LpToken', 'LPT')
    lpTokenContract2 = await LpToken.deploy('LpToken 2', 'LPT')
    await lpTokenContract.deployed()
    await lpTokenContract2.deployed()
    console.log('lptoken deployed')

    await lpTokenContract.mint(
      owner.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )

    await lpTokenContract2.mint(
      owner.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )

    console.log(`${INITIAL_MINT} LPT minted to ${owner.address}`)
    console.log()

    const UBE = await ethers.getContractFactory('UBE')
    ubeContract = await UBE.deploy('UBE', 'UBE')
    await ubeContract.deployed()
    console.log('ube deployed')

    await ubeContract.mint(
      owner.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )
    console.log(INITIAL_MINT.toString() + ' UBE minted to ' + owner.address)
    console.log()

    const HaloTokenContract = await ethers.getContractFactory('HaloToken')
    haloTokenContract = await HaloTokenContract.deploy('Halo', 'HALO')
    await haloTokenContract.deployed()
    console.log('halo token deployed')

    await haloTokenContract.mint(
      owner.address,
      ethers.utils.parseEther((40 * INITIAL_MINT).toString())
    )
    console.log(
      (40 * INITIAL_MINT).toString() + ' HALO minted to ' + owner.address
    )
    console.log()

    const HalohaloContract = await ethers.getContractFactory('HaloHalo')
    halohaloContract = await HalohaloContract.deploy(haloTokenContract.address)
    await halohaloContract.deployed()
    console.log('halohalo deployed')

    const MinterContract = await ethers.getContractFactory('Minter')
    minterContract = await MinterContract.deploy()
    await minterContract.deployed()
    console.log('minter deployed')

    const RewardsContract = await ethers.getContractFactory('Rewards')
    const startingRewards = ethers.utils.parseEther('7500000')

    // Average block 12 seconds or 5 per minute
    console.log('BPS = ', BPS)

    const ammLpRewardsRatio = 0.4 * BPS
    const vestingRewardsRatio = 0.2 * BPS

    const minterLpPools = [[collateralERC20Contract.address, 10]]
    const ammLpPools = [[lpTokenContract.address, 10]]

    rewardsContract = await RewardsContract.deploy(
      haloTokenContract.address,
      startingRewards,
      ammLpRewardsRatio, //in bps, multiplied by 10^4
      vestingRewardsRatio, //in bps, multiplied by 10^4
      genesisBlock,
      minterLpPools,
      ammLpPools
    )

    await rewardsContract.deployed()
    console.log('Rewards Contract deployed')
    console.log()

    await rewardsContract.setHaloChest(halohaloContract.address)
    console.log('Halo Chest set')
    console.log()

    await minterContract.setRewardsContract(rewardsContract.address)
    console.log('Rewards contract set on minter')
    console.log()

    await minterContract.setPhmContract(ubeContract.address)
    console.log('UBE contract set on minter')
    console.log()

    await lpTokenContract.approve(
      rewardsContract.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )

    console.log(
      `Rewards contract approved to transfer ${Number(DECIMALS)} LPT of ${
        owner.address
      }`
    )
    console.log()

    await collateralERC20Contract.approve(
      minterContract.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )

    console.log(
      `Minter contract approved to transfer ${Number(
        DECIMALS
      )} collateral ERC20 of ${owner.address}`
    )
    console.log()

    await ubeContract.approve(
      minterContract.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )

    console.log(
      `Minter contract approved to transfer ${Number(DECIMALS)} UBE of ${
        owner.address
      }`
    )
    console.log()

    const ownerHaloBalance = await haloTokenContract.balanceOf(owner.address)
    await haloTokenContract.transfer(rewardsContract.address, ownerHaloBalance)
    console.log(
      `${Number(ownerHaloBalance)} HALO tokens transfered to rewards contract`
    )

    const ownerUbeBalance = await ubeContract.balanceOf(owner.address)
    await ubeContract.transfer(minterContract.address, ownerUbeBalance)
    console.log(
      `${Number(ownerUbeBalance)} UBE tokens transfered to minter contract`
    )
    console.log(
      '==========================================================\n\n'
    )
  })

  // describe('Check Contract Deployments', () => {
  it('Collateral ERC20 should be deployed and owner should have initial mint', async () => {
    expect(await collateralERC20Contract.symbol()).to.equal(
      'collateral ERC20'
    )
    expect(await collateralERC20Contract.name()).to.equal('collateral ERC20')
    expect(await collateralERC20Contract.balanceOf(owner.address)).to.equal(
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )
  })

  it('Lptoken should be deployed', async () => {
    expect(await lpTokenContract.symbol()).to.equal('LPT')
    expect(await lpTokenContract.name()).to.equal('LpToken')
  })

  it('Lptoken2 should be deployed', async () => {
    expect(await lpTokenContract2.symbol()).to.equal('LPT')
    expect(await lpTokenContract2.name()).to.equal('LpToken 2')
  })

  it('UBE should be deployed', async () => {
    expect(await ubeContract.symbol()).to.equal('UBE')
    expect(await ubeContract.name()).to.equal('UBE')
  })

  it('HaloToken should be deployed', async () => {
    expect(await haloTokenContract.symbol()).to.equal('HALO')
    expect(await haloTokenContract.name()).to.equal('Halo')
  })

  it('Halohalo should be deployed', async () => {
    expect(await halohaloContract.symbol()).to.equal('HALOHALO')
    expect(await halohaloContract.name()).to.equal('HaloHalo')
  })

  it('Rewards Contract should be deployed', async () => {
    expect(await rewardsContract.getTotalPoolAllocationPoints()).to.equal(10)
    expect(await rewardsContract.getTotalMinterLpAllocationPoints()).to.equal(
      10
    )
    expect(
      await rewardsContract.isValidAmmLp(lpTokenContract.address)
    ).to.equal(true)
    expect(
      await rewardsContract.isValidAmmLp(collateralERC20Contract.address)
    ).to.equal(false)
    expect(
      await rewardsContract.isValidMinterLp(collateralERC20Contract.address)
    ).to.equal(true)
    expect(
      await rewardsContract.isValidMinterLp(lpTokenContract.address)
    ).to.equal(false)
  })
  // })

  // describe('Rewards helper functions', () => {
  it('should calc rewards for one block', async () => {
    const currentBlock = await ethers.provider.getBlockNumber()
    console.log(`Current block ${currentBlock}`)

    const actual = await rewardsContract.calcReward(currentBlock - 1)
    const expected = ethers.BigNumber.from('290000000000000000000')

    expect(actual).to.equal(expected);
  })

  it.only('should calc rewards for two blocks', async () => {
    const currentBlock = await ethers.provider.getBlockNumber()
    console.log(`Current block ${currentBlock}`)

    const actual = await rewardsContract.calcReward(currentBlock - 2)
    const expected = ethers.BigNumber.from('58000000000000000000')

    expect(actual).to.equal(expected);
  })

  it.only('should get unclaimed rewards', async () => {
    const actual = await rewardsContract.unclaimed()
    const expected = ethers.BigNumber.from('72384000000000000000000000')

    expect(actual).to.equal(expected);
  })
})
//})
