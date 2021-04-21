import { parseEther, formatEther } from 'ethers/lib/utils'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'

import {
  time,
} from '@openzeppelin/test-helpers'

let contractCreatorAccount
let rewardsContract
let collateralERC20Contract
let lpTokenContract
let lpTokenContract2
let minterContract
let ubeContract
let haloTokenContract
let halohaloContract
let genesisBlock
let epochLength
const DECIMALS = 10 ** 18
const BPS = 10 ** 4
const INITIAL_MINT = 10 ** 6
const INITIAL_USER_HALO_MINT = '550000000000000002000000' // got from the previous contract
let owner
let addr1
let addr2
let addrs

let expectedPerSecondHALOReward
describe('HALOHALO Contract', async () => {
  before(async () => {
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

    await lpTokenContract.deployed()

    console.log('lptoken deployed')

    await lpTokenContract.mint(
      owner.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )

    console.log(INITIAL_MINT.toString() + ' LPT minted to ' + owner.address)
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

    epochLength = 30 * 24 * 60 * 5
    console.log('BPS = ', BPS)
    const minterLpRewardsRatio = 0.4 * BPS
    const ammLpRewardsRatio = 0.4 * BPS
    const vestingRewardsRatio = 0.2 * BPS

    console.log('expectedPerSecondHALOReward: ', expectedPerSecondHALOReward)
    genesisBlock = 0
    const minterLpPools = [[collateralERC20Contract.address, 10]]
    const ammLpPools = [[lpTokenContract.address, 10]]

    rewardsContract = await RewardsContract.deploy(
      haloTokenContract.address,
      startingRewards,
      epochLength,
      minterLpRewardsRatio, //in bps, multiplied by 10^4
      ammLpRewardsRatio, //in bps, multiplied by 10^4
      vestingRewardsRatio, //in bps, multiplied by 10^4
      minterContract.address,
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
      `Rewards contract approved to transfer ${Number(DECIMALS)} LPT of ${owner.address}`
    )
    console.log()

    await collateralERC20Contract.approve(
      minterContract.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )

    console.log(
      `Minter contract approved to transfer  ${Number(DECIMALS)} collateral ERC20 of ${owner.address}`
    )
    console.log()

    await ubeContract.approve(
      minterContract.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )

    console.log(
      `Minter contract approved to transfer ${Number(DECIMALS)} UBE of ${owner.address}`
    )
    console.log()

    const ownerHaloBalance = await haloTokenContract.balanceOf(owner.address)
    await haloTokenContract.transfer(rewardsContract.address, ownerHaloBalance)
    console.log(
      `${Number(ownerHaloBalance)}  HALO tokens transfered to rewards contract`
    )

    // Mint halo for owner
    await haloTokenContract.mint(owner.address, INITIAL_USER_HALO_MINT)

    console.log(
      `${INITIAL_USER_HALO_MINT} minted to user contract ${owner.address}`
    )
    const ownerUbeBalance = await ubeContract.balanceOf(owner.address)
    await ubeContract.transfer(minterContract.address, ownerUbeBalance)
    console.log(
      `${ownerUbeBalance} UBE tokens transfered to minter contract`
    )
    console.log(
      '==========================================================\n\n'
    )
  })

  describe('Check Contract Deployments', () => {
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
  })

  describe('Earn vesting rewards by staking HALO inside halohalo', () => {
    let ownerHaloBal

    it('Reverts if there is no HaloHalo supply', async () => {
      await expect(halohaloContract.updateHaloHaloPrice()).to.be.revertedWith(
        'No HALOHALO supply'
      )
    })

    it('Deposit HALO tokens to halohalo, receive xHALO', async () => {
      ownerHaloBal = await haloTokenContract.balanceOf(owner.address)
      await haloTokenContract.approve(halohaloContract.address, ownerHaloBal)
      await expect(halohaloContract.enter(ownerHaloBal)).to.not.be.reverted
    })

    it('Updates the current halohalo price in the contract', async () => {
      await expect(halohaloContract.updateHaloHaloPrice()).to.emit(
        halohaloContract,
        'HaloHaloPriceUpdated'
      ).to.be.not.reverted

      var { lastHaloHaloPrice } = await halohaloContract.latestHaloHaloPrice()

      // equal to 1 since there is one halohalo per one halo in the contract
      expect(formatEther(lastHaloHaloPrice)).to.equal('1.0')

      await expect(
        haloTokenContract.mint(
          halohaloContract.address,
          parseEther(`${60 * INITIAL_MINT}`)
        )
      ).to.not.be.reverted

      await expect(halohaloContract.updateHaloHaloPrice()).to.not.be.reverted
      var { lastHaloHaloPrice } = await halohaloContract.latestHaloHaloPrice()
      // minted additional tokens to the contract simulating release of 20% HALO from the rewards contract. the release from the previous tests is
      expect(formatEther(lastHaloHaloPrice)).to.equal('110.0')
    })

    it('Computes estimated APY in HaloHalo Contract', async () => {
      // minted additional tokens to the contract simulating release of 20% HALO from the rewards contract to establish an APY value
      await expect(
        haloTokenContract.mint(
          halohaloContract.address,
          parseEther(`${60000 * INITIAL_MINT}`)
        )
      ).to.not.be.reverted

      // sleep for 5 for updateIntervalDuration
      await time.advanceBlock()
      await halohaloContract.estimateHaloHaloAPY()

      // expect 2%++ APY
      expect(formatEther(await halohaloContract.APY())).to.equal(
        '0.00345922120742547'
      )
    })

    it('Send unclaimed vested rewards to Halohalo', async () => {
      const currVestedHalo = await rewardsContract.getUnclaimedVestingRewards()
      expect(currVestedHalo).to.not.equal(BigNumber.from(0))
      await expect(rewardsContract.releaseVestedRewards()).to.not.be.reverted
      // TODO: Check value vested
    })

    it('Claim staked HALO + bonus rewards from Halohalo and burn xHALO', async () => {
      const haloInHalohalo = await haloTokenContract.balanceOf(
        halohaloContract.address
      )

      const ownerXHalo = await halohaloContract.balanceOf(owner.address)
      await halohaloContract.leave(ownerXHalo)

      expect(await haloTokenContract.balanceOf(owner.address)).to.equal(
        haloInHalohalo
      )
    })

    it('HALO earned by User A > HALO earned by User B > HALO earned by User C', async () => {
      console.log(
        'Current HALO balance in Halohalo:' +
          ethers.utils.parseEther(
            (
              await haloTokenContract.balanceOf(halohaloContract.address)
            ).toString()
          )
      )
      console.log('Minting 100 HALO to User A...')
      await haloTokenContract.mint(
        addrs[0].address,
        ethers.utils.parseEther('100')
      )
      console.log('Minting 100 HALO to User B...')
      await haloTokenContract.mint(
        addrs[1].address,
        ethers.utils.parseEther('100')
      )
      console.log('Minting 100 HALO to User C...')
      await haloTokenContract.mint(
        addrs[2].address,
        ethers.utils.parseEther('100')
      )

      console.log('100 HALO deposited by User A to halohalo')
      await haloTokenContract
        .connect(addrs[0])
        .approve(halohaloContract.address, ethers.utils.parseEther('100'))
      await halohaloContract
        .connect(addrs[0])
        .enter(ethers.utils.parseEther('100'))

      //sleep(3)
      await time.advanceBlock()

      console.log(
        'Releasing vested bonus tokens to halohalo from Rewards contract'
      )
      const currVestedHalo = (
        await rewardsContract.getUnclaimedVestingRewards()
      ).toString()
      console.log(currVestedHalo)
      await rewardsContract.releaseVestedRewards()

      console.log('100 HALO deposited by User B to halohalo')
      await haloTokenContract
        .connect(addrs[1])
        .approve(halohaloContract.address, ethers.utils.parseEther('100'))
      await halohaloContract
        .connect(addrs[1])
        .enter(ethers.utils.parseEther('100'))

      //sleep(3)
      await time.advanceBlock()

      console.log(
        'Releasing vested bonus tokens to halohalo from Rewards contract'
      )
      await rewardsContract.releaseVestedRewards()

      console.log('100 HALO deposited by User C to halohalo')
      await haloTokenContract
        .connect(addrs[2])
        .approve(halohaloContract.address, ethers.utils.parseEther('100'))
      await halohaloContract
        .connect(addrs[2])
        .enter(ethers.utils.parseEther('100'))
      console.log('All users leave halohalo')

      await halohaloContract
        .connect(addrs[0])
        .leave(await halohaloContract.balanceOf(addrs[0].address))
      await halohaloContract
        .connect(addrs[1])
        .leave(await halohaloContract.balanceOf(addrs[1].address))
      await halohaloContract
        .connect(addrs[2])
        .leave(await halohaloContract.balanceOf(addrs[2].address))

      console.log('Final HALO balances:')
      console.log(
        'User A: ' +
          ethers.utils.formatEther(
            await haloTokenContract.balanceOf(addrs[0].address)
          )
      )
      console.log(
        'User B: ' +
          ethers.utils.formatEther(
            await haloTokenContract.balanceOf(addrs[1].address)
          )
      )
      console.log(
        'User C: ' +
          ethers.utils.formatEther(
            await haloTokenContract.balanceOf(addrs[2].address)
          )
      )
    })
  })
})
