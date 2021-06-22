import { time } from '@openzeppelin/test-helpers'

import { parseEther } from 'ethers/lib/utils'
import { expect } from 'chai'
import { ethers } from 'hardhat'
const { BigNumber } = require("ethers")

let contractCreatorAccount
let ammRewardsContract
let collateralERC20Contract
let collateralERC20Contract2
let lpTokenContract
let lpTokenContract2
let minterContract
let ubeContract
let haloTokenContract
let halohaloContract
let rewardsManager
let recalculateRewardPerBlockTestContract
let genesisBlock = 0
const zeroAddress = '0x0000000000000000000000000000000000000000'
const DECIMALS = 10 ** 18
const BASIS_POINTS = 10 ** 4
const INITIAL_MINT = 10 ** 6
let owner
let addr1
let addr2
let addrs
let lpTokenPid
const sleepTime = 5000
//const rewardTokenPerSecond = ethers.BigNumber.from('2416666666666666666')
const rewardTokenPerSecond = ethers.BigNumber.from('77160493827160500')

const EPOCH_REWARD_AMOUNT = parseEther('6264000')
const RELEASED_HALO_REWARDS = parseEther('250000')

describe('Rewards Contract', async () => {
  before(async () => {
    ;[owner, addr1, addr2, ...addrs] = await ethers.getSigners()
    console.log('===================Deploying Contracts=====================')

    const CollateralERC20 = await ethers.getContractFactory('CollateralERC20')
    collateralERC20Contract = await CollateralERC20.deploy(
      'collateral ERC20',
      'collateral ERC20'
    )
    await collateralERC20Contract.deployed()
    console.log(
      `collateralERC20 deployed at ${collateralERC20Contract.address}`
    )

    await collateralERC20Contract.mint(
      owner.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )
    console.log(`${INITIAL_MINT} collateral ERC20 minted to ${owner.address}`)

    collateralERC20Contract2 = await CollateralERC20.deploy(
      'collateral ERC20 2',
      'collateral ERC20 2'
    )
    await collateralERC20Contract2.deployed()
    console.log(
      `collateralERC20 2 deployed at ${collateralERC20Contract2.address}`
    )

    await collateralERC20Contract2.mint(
      owner.address,
      ethers.utils.parseEther(INITIAL_MINT.toString())
    )
    console.log(`${INITIAL_MINT} collateral ERC20 2 minted to ${owner.address}`)
    console.log()

    const LpToken = await ethers.getContractFactory('LpToken')
    lpTokenContract = await LpToken.deploy('LpToken', 'LPT')
    lpTokenContract2 = await LpToken.deploy('LpToken 2', 'LPT')
    await lpTokenContract.deployed()
    await lpTokenContract2.deployed()
    console.log(`lptoken deployed at ${lpTokenContract.address}`)
    console.log(`lptoken 2 deployed at ${lpTokenContract2.address}`)

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


    const AmmRewardsContract = await ethers.getContractFactory('AmmRewards')
    ammRewardsContract = await AmmRewardsContract.deploy(halohaloContract.address);

    const vestingRewardsRatio = 0.2 * BASIS_POINTS

    const RewardsManager = await ethers.getContractFactory('RewardsManager')
    rewardsManager = await RewardsManager.deploy(
      vestingRewardsRatio,
      ammRewardsContract.address,
      halohaloContract.address,
      haloTokenContract.address
    )

    await ammRewardsContract.setRewardsManager(rewardsManager.address)
    //await ammRewardsContract.setRewardTokenPerSecond(rewardTokenPerSecond)
    await ammRewardsContract.deployed()
    console.log(`AmmRewardsContract deployed at ${ammRewardsContract.address}`)

    console.log()

    await lpTokenContract.approve(
      ammRewardsContract.address,
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
      `Minter contract approved to transfer  ${Number(
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
    await haloTokenContract.transfer(ammRewardsContract.address, ownerHaloBalance)
    console.log(
      `${Number(ownerHaloBalance)}  HALO tokens transfered to rewards contract`
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
      expect(await halohaloContract.symbol()).to.equal('RNBW')
      expect(await halohaloContract.name()).to.equal('Rainbow')
    })

    it('AmmRewards Contract should be deployed', async () => {

    })
  })

  describe('As an admin, I allocate the monthly epoch reward then epochRewardAmount is set', async () => {

    it('Calling RewardsManager.releaseEpochRewards function by non-admin will fail', async () => {
      await expect(rewardsManager.connect(addr1).releaseEpochRewards(RELEASED_HALO_REWARDS))
        .to.be.reverted
    })

    it('Admin can call RewardsManager.releaseEpochRewards function and will distribute the HALOHALO from Rewards Manager to Rewards contract', async () => {
      /** Mint HALO to deployer */
      await haloTokenContract.mint(owner.address, RELEASED_HALO_REWARDS)
      console.log(`
        Minted ${RELEASED_HALO_REWARDS} HALO Tokens to deployer
      `)

      await haloTokenContract.approve(
        rewardsManager.address,
        RELEASED_HALO_REWARDS
      )

      const vestingRewardsRatio = 0.2 * BASIS_POINTS
      const currentVestedRewards = (Number(RELEASED_HALO_REWARDS) * vestingRewardsRatio) / BASIS_POINTS
      const currentRewardsReleased = Number(RELEASED_HALO_REWARDS) - currentVestedRewards
      const currentRewardsReleasedInEther = parseEther(`${currentRewardsReleased / 10 ** 18}`)

      await expect(rewardsManager.releaseEpochRewards(RELEASED_HALO_REWARDS))
        .to.emit(
          rewardsManager,
          'ReleasedRewardsToRewardsContractEvent'
        )
        .withArgs(currentRewardsReleasedInEther)
        .to.be.not.reverted
      //console.log(`Halohalo balance: ${Number(await halohaloContract.balanceOf(ammRewardsContract.address))}`)
      expect(await halohaloContract.balanceOf(rewardsManager.address))
        .to.be.equal(0, 'All HaloHalo tokens in Rewards manager should be tranferred to Rewards Contract.')

      const haloHaloBalance = Number(await halohaloContract.balanceOf(ammRewardsContract.address))
      expect(haloHaloBalance).to.be.equal(currentRewardsReleased,
        '80% of the rewards amount released during first month epoch should be equal to the HaloHalo balance of Rewards contract')
    })

    /**
     * This flow needs to be followed first:
     * https://app.diagrams.net/#G1bbH7UmfMyCAqtfniTJXGMItGWS-AaOOR
     * Specifically Rewards Manager uses Rewards.depositEpochRewardAmount()
     */
    // it('Epoch Reward Amount is set to the value provided if sender is Rewards Manager contract', async () => {
    //   /** Stimulate allocating HALO tokens for Epoch Reward Amount */
    //   await haloTokenContract.mint(owner.address, EPOCH_REWARD_AMOUNT)
    //   await haloTokenContract.approve(
    //     halohaloContract.address,
    //     EPOCH_REWARD_AMOUNT
    //   )
    //   await halohaloContract.enter(EPOCH_REWARD_AMOUNT)
    //   await halohaloContract.approve(
    //     ammRewardsContract.address,
    //     EPOCH_REWARD_AMOUNT
    //   )
    //   await halohaloContract.transfer(ammRewardsContract.address, EPOCH_REWARD_AMOUNT)
    //
    // })
  })

  describe('When I supply liquidity to an AMM, I am able to receive my proportion of HALO rewards. When I remove my AMM stake token from the Rewards contract, I stop earning HALO', () => {
    it('Non-admin cannot add LP pool', async() => {
        await expect(ammRewardsContract.connect(addr1).add(10, lpTokenContract.address, zeroAddress))
          .to.be.reverted
      })
    //})
    it('Admin cannot add LP pool', async() => {
        await expect(ammRewardsContract.add(10, lpTokenContract.address, zeroAddress))
          .to.not.be.reverted
      })
    //})
    it('I earn the correct number of HALO tokens per time interval on depositing LPT', async () => {
      lpTokenPid = 0
      // deposit LP tokens to Rewards contract
      const depositPoolTxn = await ammRewardsContract.deposit(
        lpTokenPid,
        ethers.utils.parseEther('100'),
        owner.address
      )

      const depositPoolTxTs = (
        await ethers.provider.getBlock(
          depositPoolTxn.blockHash
        )
      ).timestamp

      expect(depositPoolTxn).to.not.be.null

      await time.increase(sleepTime)
      console.log('\t Done sleeping. Updating AMM LP pool Rewards')

      const updateAmmPoolOnPoolTokenDepositTxn = await ammRewardsContract.updatePool(
        lpTokenPid
      )

      const updateTxTs = (
        await ethers.provider.getBlock(
          updateAmmPoolOnPoolTokenDepositTxn.blockHash
        )
      ).timestamp

      expect(updateTxTs).to.not.be.null
      const actualUnclaimedHaloPoolRewards = await ammRewardsContract.pendingRewardToken(
        lpTokenPid,
        owner.address
      )
      const expectedUnclaimedHaloPoolRewards = BigNumber.from(rewardTokenPerSecond).mul(updateTxTs - depositPoolTxTs)
      expect(actualUnclaimedHaloPoolRewards).to.be.within(
        BigNumber.from(expectedUnclaimedHaloPoolRewards.toString()).sub(BigNumber.from("10000000")),
        BigNumber.from(expectedUnclaimedHaloPoolRewards.toString()).add(BigNumber.from("10000000"))
      )
    })

    it('I stop earning HALO tokens on withdrawing LPT', async () => {
      const withdrawPoolTxn = await ammRewardsContract.withdrawAndHarvest(
        lpTokenPid,
        ethers.utils.parseEther('100'),
        owner.address
      )

      console.log('\tUpdate Amm Lp pool Rewards')

      await ammRewardsContract.updatePool(lpTokenPid)

      console.log(
        '\tUnclaimed rewards for user after withdrawing LPT should be 0'
      )

      const actualUnclaimedHaloPoolRewards = Math.round(
        +ethers.utils.formatEther(
          await ammRewardsContract.pendingRewardToken(
            lpTokenPid,
            owner.address
          )
        )
      )

      const expectedUnclaimedHaloPoolRewards = ethers.BigNumber.from(0)
      expect(actualUnclaimedHaloPoolRewards).to.equal(
        expectedUnclaimedHaloPoolRewards
      )
    })
  })
  describe('As an Admin, I can update AMM LP pool’s allocation points', async() => {
    const maxAllocationPoints = Number(10)

    console.log(`lpPoolInfo: ${await ammRewardsContract.poolInfo(lpTokenPid)}`);
    // it('AMM LP allocation points before', async () => {
    //   expect(
    //     (
    //       await ammRewardsContract.poolInfo(lpTokenPid)
    //     ).allocPoint.toString()
    //   ).to.equal('10')
    // })

    // it('Total LP allocation points before', async () => {
    //   expect(await rewardsContract.getTotalPoolAllocationPoints()).to.equal(
    //     maxAllocationPoints
    //   )
    // })

    it('If caller is not contract owner, it should fail', async () => {
      await expect(
        ammRewardsContract
          .connect(addr1)
          .set(lpTokenPid, 5, zeroAddress, false)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('If caller is contract owner, it should not fail; If AMM LP pool is whitelisted it should not fail; Set Amm LP pool allocs', async () => {
      await expect(
        ammRewardsContract
          .connect(owner)
          .set(lpTokenPid, 5, zeroAddress, false)
      ).to.not.be.reverted
    })

    // it('AMM LP allocation points before', async () => {
    //   expect(
    //     (
    //       await rewardsContract.getAmmLpPoolInfo(lpTokenContract.address)
    //     ).allocPoint.toString()
    //   ).to.equal('5')
    // })
    // it('expectedAllocPoints = (totalAllocPoints - currentAllocPoints) + newAllocPoints = 10 - 10 + 5', async () => {
    //   expect(await rewardsContract.getTotalPoolAllocationPoints()).to.equal(5)
    // })
  })
})
