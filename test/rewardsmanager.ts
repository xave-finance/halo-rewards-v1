import { formatEther, parseEther } from 'ethers/lib/utils'
import { expect } from 'chai'
import { ethers } from 'hardhat'

let haloTokenContract
let halohaloContract
let changedHaloHaloContract
let rewardsContract
let changedRewardsContract
let rewardsManagerContract
let addrs
let collateralERC20Contract
let lpTokenContract

// Number constants
const genesisBlock = 0

let epochLength
const BASIS_POINTS = 10 ** 4
epochLength = 30 * 24 * 60 * 5
console.log('BASIS_POINTS = ', BASIS_POINTS)

const ammLpRewardsRatio = 0.4 * BASIS_POINTS
const vestingRewardsRatio = 0.2 * BASIS_POINTS
const changedVestingRewardsRatio = 0.33 * BASIS_POINTS
const releasedRewardsRatio = 0.8 * BASIS_POINTS // 80% of the released rewards
const expectedHaloHaloPrice = parseEther('1.25')
const RELEASED_HALO_REWARDS = parseEther('10000') // got from the previous contract

describe('HALOHALO Contract', async () => {
  before(async () => {
    ;[...addrs] = await ethers.getSigners()
    console.log('===================Deploying Contracts=====================')

    const CollateralERC20 = await ethers.getContractFactory('CollateralERC20')
    collateralERC20Contract = await CollateralERC20.deploy(
      'collateral ERC20',
      'collateral ERC20'
    )
    await collateralERC20Contract.deployed()
    console.log('collateralERC20 deployed')

    const LpToken = await ethers.getContractFactory('LpToken')
    lpTokenContract = await LpToken.deploy('LpToken', 'LPT')

    await lpTokenContract.deployed()

    const HaloTokenContract = await ethers.getContractFactory('HaloToken')
    haloTokenContract = await HaloTokenContract.deploy('Halo', 'HALO')
    await haloTokenContract.deployed()
    console.log('halo token deployed')

    const HalohaloContract = await ethers.getContractFactory('HaloHalo')
    halohaloContract = await HalohaloContract.deploy(haloTokenContract.address)
    await halohaloContract.deployed()
    console.log('halohalo deployed')

    changedHaloHaloContract = await HalohaloContract.deploy(
      haloTokenContract.address
    )
    await changedHaloHaloContract.deployed()
    console.log('changedHaloHaloContract deployed')

    const minterLpPools = [[collateralERC20Contract.address, 10]]
    const ammLpPools = [[lpTokenContract.address, 10]]
    const RewardsContract = await ethers.getContractFactory('Rewards')
    const startingRewards = ethers.utils.parseEther('7500000')

    rewardsContract = await RewardsContract.deploy(
      haloTokenContract.address,
      startingRewards,
      epochLength,
      ammLpRewardsRatio, //in BASIS_POINTS, multiplied by 10^4
      vestingRewardsRatio, //in BASIS_POINTS, multiplied by 10^4
      genesisBlock,
      minterLpPools,
      ammLpPools
    )

    changedRewardsContract = await RewardsContract.deploy(
      haloTokenContract.address,
      startingRewards,
      epochLength,
      ammLpRewardsRatio, //in BASIS_POINTS, multiplied by 10^4
      vestingRewardsRatio, //in BASIS_POINTS, multiplied by 10^4
      genesisBlock,
      minterLpPools,
      ammLpPools
    )

    const RewardsManagerContract = await ethers.getContractFactory(
      'RewardsManager'
    )
    rewardsManagerContract = await RewardsManagerContract.deploy(
      vestingRewardsRatio,
      rewardsContract.address,
      halohaloContract.address,
      haloTokenContract.address
    )
    console.log(
      '==========================================================\n\n'
    )
  })

  describe('Check Contract Deployments', () => {
    it('HaloToken should be deployed', async () => {
      expect(await haloTokenContract.symbol()).to.equal('HALO')
      expect(await haloTokenContract.name()).to.equal('Halo')
    })

    it('Halohalo should be deployed', async () => {
      expect(await halohaloContract.symbol()).to.equal('HALOHALO')
      expect(await halohaloContract.name()).to.equal('HaloHalo')
    })

    it('Lptoken should be deployed', async () => {
      expect(await lpTokenContract.symbol()).to.equal('LPT')
      expect(await lpTokenContract.name()).to.equal('LpToken')
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

    it('Rewards Management Contract should be deployed', async () => {
      expect(await rewardsManagerContract.getRewardsContract()).to.equal(
        rewardsContract.address
      )

      expect(await rewardsManagerContract.getHaloHaloContract()).to.equal(
        halohaloContract.address
      )
      expect(await rewardsManagerContract.getVestingRatio()).to.equal(
        vestingRewardsRatio
      )
    })
  })

  describe('Admin functions can be set by the owner', async () => {
    afterEach(async () => {
      // reset to state after deployment
      await rewardsManagerContract.setVestingRatio(vestingRewardsRatio)
      await rewardsManagerContract.setRewardsContract(rewardsContract.address)
      await rewardsManagerContract.setHaloHaloContract(halohaloContract.address)
    })
    it('can set the vestingRatio if the caller is the owner', async () => {
      expect(await rewardsManagerContract.getVestingRatio()).to.equal(
        vestingRewardsRatio
      )

      await expect(
        rewardsManagerContract.setVestingRatio(changedVestingRewardsRatio),
        'Vesting Ratio not changed'
      ).to.not.be.reverted

      expect(await rewardsManagerContract.getVestingRatio()).to.equal(
        changedVestingRewardsRatio
      )
    })

    it('can not set the vestingRatio if the caller is not the owner', async () => {
      expect(await rewardsManagerContract.getVestingRatio()).to.equal(
        vestingRewardsRatio
      )

      await expect(
        rewardsManagerContract
          .connect(addrs[1])
          .setVestingRatio(changedVestingRewardsRatio),
        'Function called even if the caller is not the owner'
      ).to.be.reverted
    })

    it('can set the rewards contract if the caller is the owner', async () => {
      expect(await rewardsManagerContract.getRewardsContract()).to.equal(
        rewardsContract.address
      )
      await expect(
        rewardsManagerContract.setRewardsContract(
          changedRewardsContract.address
        ),
        'Rewards contract not changed'
      ).to.not.be.reverted

      expect(await rewardsManagerContract.getRewardsContract()).to.equal(
        changedRewardsContract.address
      )
    })

    it('can not set the rewards contract if the caller is not the owner', async () => {
      expect(await rewardsManagerContract.getRewardsContract()).to.equal(
        rewardsContract.address
      )

      await expect(
        rewardsManagerContract
          .connect(addrs[1])
          .setRewardsContract(changedRewardsContract.address),
        'Function called even if the caller is not the owner'
      ).to.be.reverted
    })

    it('can set the halohalo contract if the caller is the owner', async () => {
      expect(await rewardsManagerContract.getHaloHaloContract()).to.equal(
        halohaloContract.address
      )

      await expect(
        rewardsManagerContract.setHaloHaloContract(
          changedHaloHaloContract.address
        ),
        'Halohalo contract not changed'
      ).to.not.be.reverted

      expect(await rewardsManagerContract.getHaloHaloContract()).to.equal(
        changedHaloHaloContract.address
      )
    })

    it('can not set the halohalo contract if the caller is not the owner', async () => {
      expect(await rewardsManagerContract.getHaloHaloContract()).to.equal(
        halohaloContract.address
      )

      await expect(
        rewardsManagerContract
          .connect(addrs[1])
          .setHaloHaloContract(changedHaloHaloContract.address),
        'Function called even if the caller is not the owner'
      ).to.be.reverted
    })
  })

  describe('Released HALO will be distributed 80% to the rewards contract converted to DESRT and 20% will be vested to the halohalo contract', async () => {
    it('Release rewards to be distributed when 1 HALOHALO = 1 HALO', async () => {
      const expectedVestedRewards = RELEASED_HALO_REWARDS.mul(
        vestingRewardsRatio
      ).div(BASIS_POINTS)

      const expectedHaloHalo = RELEASED_HALO_REWARDS.mul(
        releasedRewardsRatio
      ).div(BASIS_POINTS)

      await haloTokenContract.mint(
        rewardsManagerContract.address,
        RELEASED_HALO_REWARDS
      )

      expect(
        await haloTokenContract.balanceOf(rewardsManagerContract.address),
        'HALO was not sent to the Rewards Manager Contract'
      ).to.equal(RELEASED_HALO_REWARDS)

      await haloTokenContract.approve(
        rewardsManagerContract.address,
        RELEASED_HALO_REWARDS
      )

      // Release rewards and check events and their args
      await expect(
        rewardsManagerContract.releaseEpochRewards(RELEASED_HALO_REWARDS),
        'Rewards was not distributed'
      )
        .to.emit(rewardsManagerContract, 'SentVestedRewardsEvent')
        .withArgs(expectedVestedRewards)
        .to.emit(
          rewardsManagerContract,
          'ReleasedRewardsToRewardsContractEvent'
        )
        .withArgs(RELEASED_HALO_REWARDS.sub(expectedVestedRewards)).to.not.be
        .reverted

      expect(
        await halohaloContract.balanceOf(rewardsContract.address),
        `Current HaloHalo is not equal to ${formatEther(expectedHaloHalo)}`
      ).to.equal(expectedHaloHalo)

      // it is equal to RELEASED_HALO_REWARDS since 80% in HALO is entered in the halohalo contract and 20% is vested in the halohalo contract
      expect(
        await haloTokenContract.balanceOf(halohaloContract.address),
        `Total HALO (vested + entered) is not equal to ${RELEASED_HALO_REWARDS}`
      ).to.equal(RELEASED_HALO_REWARDS)
    })

    it(`Release rewards to be distributed when 1 HALOHALO =  ${formatEther(
      expectedHaloHaloPrice
    )} HALO`, async () => {
      expect(await halohaloContract.getCurrentHaloHaloPrice()).to.equal(
        expectedHaloHaloPrice
      )

      const expectedVestedRewards = RELEASED_HALO_REWARDS.mul(
        vestingRewardsRatio
      ).div(BASIS_POINTS)

      const expectedHaloHalo = RELEASED_HALO_REWARDS.mul(releasedRewardsRatio)
        .div(BASIS_POINTS)
        .mul(await halohaloContract.totalSupply())
        .div(await haloTokenContract.balanceOf(halohaloContract.address))

      console.log('Total: ', Number(await halohaloContract.totalSupply()))
      console.log(
        'Total Halo: ',
        Number(await haloTokenContract.balanceOf(halohaloContract.address))
      )
      console.log(
        'Halo Price: ',
        Number(await halohaloContract.getCurrentHaloHaloPrice())
      )

      await haloTokenContract.mint(
        rewardsManagerContract.address,
        RELEASED_HALO_REWARDS
      )

      expect(
        await haloTokenContract.balanceOf(rewardsManagerContract.address),
        'HALO was not sent to the Rewards Manager Contract'
      ).to.equal(RELEASED_HALO_REWARDS)

      // Release rewards and check events and their args
      await expect(
        rewardsManagerContract.releaseEpochRewards(RELEASED_HALO_REWARDS),
        'Rewards was not distributed'
      )
        .to.emit(rewardsManagerContract, 'SentVestedRewardsEvent')
        .withArgs(expectedVestedRewards)
        .to.emit(
          rewardsManagerContract,
          'ReleasedRewardsToRewardsContractEvent'
        )
        .withArgs(expectedHaloHalo).to.not.be.reverted
    })

    it('fails if the caller is not the owner', async () => {
      await expect(
        rewardsManagerContract
          .connect(addrs[1])
          .releaseEpochRewards(RELEASED_HALO_REWARDS)
      ).to.be.reverted
    })
  })
})
