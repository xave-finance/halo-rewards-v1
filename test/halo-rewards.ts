import {
  time,
} from '@openzeppelin/test-helpers'

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
let epochLength
const DECIMALS = 10 ** 18
const BPS = 10 ** 4
const INITIAL_MINT = 10 ** 6
let owner
let addr1
let addr2
let addrs

const sleepTime = 5000
const expectedHALORewardPerBlock = 290000

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
    epochLength = 30 * 24 * 60 * 5
    console.log('BPS = ', BPS)
    
    const minterLpRewardsRatio = 0.4 * BPS
    const ammLpRewardsRatio = 0.4 * BPS
    const vestingRewardsRatio = 0.2 * BPS
    
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

    const ownerUbeBalance = await ubeContract.balanceOf(owner.address)
    await ubeContract.transfer(minterContract.address, ownerUbeBalance)
    console.log(`${Number(ownerUbeBalance)} UBE tokens transfered to minter contract`
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

  describe('When I deposit collateral ERC20 on the Minter dApp, I start to earn HALO rewards.\n\tWhen I withdraw collateral ERC20, I stop earning HALO rewards', () => {
    it('I earn the correct number of HALO tokens per time interval on depositing collateral ERC20', async () => {

      const startBlock = await ethers.provider.getBlockNumber()
      console.log(`Start block ${startBlock}`);

      const depositMinterTxn = await minterContract.depositByCollateralAddress(
        ethers.utils.parseEther('100'),
        ethers.utils.parseEther('100'),
        collateralERC20Contract.address
      )

      let pool = await rewardsContract.minterLpPools(collateralERC20Contract.address)
      console.log(`Last reward block for minter pool ${Number(pool.lastRewardBlock)}`)

      // Should be mined in the first block
      expect(Number(startBlock) + 1).to.equal(Number(pool.lastRewardBlock))

      // compare both
      const currentBlock = await ethers.provider.getBlockNumber()
      console.log(`Current block ${currentBlock}`)

      await time.advanceBlock()
      console.log('\t Done sleeping. Updating Minter Rewards')

      const nextBlock = await ethers.provider.getBlockNumber()
      console.log(`Next block ${nextBlock}`)

      // Should have advanced 1 block
      expect(Number(nextBlock)).to.be.greaterThan(Number(currentBlock))

      const reward = await rewardsContract.calcReward(pool.lastRewardBlock)
      console.log(`Current reward per block ${Number(reward)}`)
      expect(Number(reward)).to.equal(expectedHALORewardPerBlock)

      // this function needs to be called so that rewards state is updated and then becomes claimable
      const updateMinterTxn = await rewardsContract.updateMinterRewardPool(
        collateralERC20Contract.address
      )

      pool = await rewardsContract.minterLpPools(collateralERC20Contract.address)
      console.log(`Last reward block for minter pool ${Number(pool.lastRewardBlock)}`)
      console.log(`Halo per share on minter pool ${Number(pool.accHaloPerShare)}`)

      expect(Number(pool.accHaloPerShare)).to.equal(Number(12760))

      await time.advanceBlock()

      const actualUnclaimedHaloRewardBal = await rewardsContract.getUnclaimedMinterLpRewardsByUser(
        collateralERC20Contract.address,
        owner.address
      )

      // calculate expected HALO rewards balance
      const expectedUnclaimedHaloRewardsBal = Number(232000) 

      expect(Number(actualUnclaimedHaloRewardBal)).to.equal(
        expectedUnclaimedHaloRewardsBal
      )
    })

    it('I stop earning HALO tokens on withdrawing collateral ERC20', async () => {
      // withdraw all collateral from Minter
      const withdrawlMinterTxn = await minterContract.redeemByCollateralAddress(
        ethers.utils.parseEther('100'),
        ethers.utils.parseEther('100'),
        collateralERC20Contract.address
      )

      await time.advanceBlock()

      // await time.increase(sleepTime)
      console.log('\t Done sleeping. Updating Minter Rewards')

      await rewardsContract.updateMinterRewardPool(
        collateralERC20Contract.address
      )

      // now check unclaimed HALO reward balance after 1 block
      console.log(
        '\tUnclaimed rewards for user after withdrawing collateral should be 0'
      )

      // get unclaimed rewards
      await rewardsContract.getUnclaimedMinterLpRewardsByUser(
        collateralERC20Contract.address,
        owner.address
      )

      // get unclaimed rewards again
      const unclaimedMinterLpRewards2ndAttempt = await rewardsContract.getUnclaimedMinterLpRewardsByUser(
        collateralERC20Contract.address,
        owner.address
      )

      // calculate actual HALO rewards balance
      const actualUnclaimedHaloRewardBal = Math.round(
        parseFloat(ethers.utils.formatEther(unclaimedMinterLpRewards2ndAttempt))
      )

      // calculate expected HALO rewards balance
      const expectedUnclaimedHaloRewardsBal = Number(0)

      // assert that expected and actual are equal
      expect(actualUnclaimedHaloRewardBal).to.equal(
        expectedUnclaimedHaloRewardsBal
      )
    })

    it('Should have correct amount of HALO token balance', async () => {
      const actualHaloBal = await haloTokenContract.balanceOf(owner.address)
      const expectedHaloBal = Number(232000)
      expect(Number(actualHaloBal)).to.equal(expectedHaloBal)
    })
  })

  describe('When I supply liquidity to an AMM, I am able to receive my proportion of HALO rewards. When I remove my AMM stake token from the Rewards contract, I stop earning HALO', () => {

    it('I earn the correct number of HALO tokens per time interval on depositing LPT', async () => {

      // deposit LP tokens to Rewards contract
      const depositPoolTxn = await rewardsContract.depositPoolTokens(
        lpTokenContract.address,
        ethers.utils.parseEther('100')
      )

      expect(depositPoolTxn).to.not.be.null

      await time.increase(sleepTime)
      console.log('\t Done sleeping. Updating AMM LP pool Rewards')

      const updateAmmPoolOnPoolTokenDepositTxn = await rewardsContract.updateAmmRewardPool(
        lpTokenContract.address
      )

      const updateTxTs = (
        await ethers.provider.getBlock(
          updateAmmPoolOnPoolTokenDepositTxn.blockHash
        )
      ).timestamp

      expect(updateTxTs).to.not.be.null

      const actualUnclaimedHaloPoolRewards = Math.round(
        +ethers.utils.formatEther(
          await rewardsContract.getUnclaimedPoolRewardsByUserByPool(
            lpTokenContract.address,
            owner.address
          )
        )
      )

      const expectedUnclaimedHaloPoolRewards = Number(0)

      expect(actualUnclaimedHaloPoolRewards).to.equal(
        expectedUnclaimedHaloPoolRewards
      )
    })

    it('I stop earning HALO tokens on withdrawing LPT', async () => {
      const withdrawPoolTxn = await rewardsContract.withdrawPoolTokens(
        lpTokenContract.address,
        ethers.utils.parseEther('100')
      )

      console.log('\tUpdate Amm Lp pool Rewards')

      await rewardsContract.updateAmmRewardPool(lpTokenContract.address)

      console.log(
        '\tUnclaimed rewards for user after withdrawing LPT should be 0'
      )

      const actualUnclaimedHaloPoolRewards = Math.round(
        +ethers.utils.formatEther(
          await rewardsContract.getUnclaimedPoolRewardsByUserByPool(
            lpTokenContract.address,
            owner.address
          )
        )
      )

      const expectedUnclaimedHaloPoolRewards = Number(0)

      expect(actualUnclaimedHaloPoolRewards).to.equal(
        expectedUnclaimedHaloPoolRewards
      )
    })

    it('Should have correct amount of HALO token balance', async () => {
      const actualHaloBal = await haloTokenContract.balanceOf(owner.address)
      const expectedBal = Number(580000)
      expect(Number(actualHaloBal)).to.equal(expectedBal)
    })
  })

  describe.skip('Earn vesting rewards by staking HALO inside halohalo', () => {
    it('Send unclaimed vested rewards to Halohalo', async () => {
      const currVestedHalo = await rewardsContract.getUnclaimedVestingRewards()
      await expect(rewardsContract.releaseVestedRewards()).to.not.be.reverted
    })
  })

  describe('As an Admin, I can update AMM LP pool’s allocation points', () => {
    const maxAllocationPoints = Number(10)

    it('AMM LP allocation points before', async () => {
      expect(
        (
          await rewardsContract.getAmmLpPoolInfo(lpTokenContract.address)
        ).allocPoint.toString()
      ).to.equal('10')
    })

    it('Total LP allocation points before', async () => {
      expect(await rewardsContract.getTotalPoolAllocationPoints()).to.equal(
        maxAllocationPoints
      )
    })

    it('If caller is not contract owner, it should fail', async () => {
      await expect(
        rewardsContract
          .connect(addr1)
          .setAmmLpAllocationPoints(lpTokenContract.address, 5)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('If caller is contract owner, it should not fail; If AMM LP pool is whitelisted it should not fail; Set Amm LP pool allocs', async () => {
      await expect(
        rewardsContract
          .connect(owner)
          .setAmmLpAllocationPoints(lpTokenContract.address, 5)
      ).to.not.be.reverted
    })
    
    it('AMM LP allocation points before', async () => {
      expect(
        (
          await rewardsContract.getAmmLpPoolInfo(lpTokenContract.address)
        ).allocPoint.toString()
      ).to.equal('5')
    })
    it('expectedAllocPoints = (totalAllocPoints - currentAllocPoints) + newAllocPoints = 10 - 10 + 5', async () => {
      expect(await rewardsContract.getTotalPoolAllocationPoints()).to.equal(5)
    })
  })

  describe('As an Admin, I can update minter lp collateral allocation points', () => {
    it('collateral ERC20 allocation points before', async () => {
      const actual = await rewardsContract.getMinterLpPoolInfo(collateralERC20Contract.address)
      expect(Number(actual.allocPoint)).to.equal(Number(10))
    })

    it('Total Minter LP allocation points before', async () => {
      const actual = await rewardsContract.getTotalMinterLpAllocationPoints()
      expect(Number(actual)).to.equal(Number(10))
    })

    it('If caller is not contract owner, it should fail', async () => {
      await expect(
        rewardsContract
          .connect(addr1)
          .setMinterLpAllocationPoints(collateralERC20Contract.address, 5)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('If caller is contract owner, it should not fail; If collateral type is whitelisted it should not fail; Set Minter Lp pool allocs', async () => {
      await expect(
        rewardsContract
          .connect(owner)
          .setMinterLpAllocationPoints(collateralERC20Contract.address, 5)
      ).to.not.be.reverted
    })

    it('collateral ERC20 LP allocation points before', async () => {
      const actual = await rewardsContract.getMinterLpPoolInfo(
        collateralERC20Contract.address
      )

      expect(Number(actual.allocPoint)).to.equal(Number(5))
    })

    it('expectedAllocPoints = (totalAllocPoints - currentAllocPoints) + newAllocPoints = 10 - 10 + 5', async () => {
      const actual = await rewardsContract.getTotalMinterLpAllocationPoints()
      expect(Number(actual)).to.equal(Number(5))
    })
  })

  describe('As an Admin, I can remove whitelisted AMM LP pool', () => {
    it('Should be valid amm lp', async () => {
      expect(
        await rewardsContract.isValidAmmLp(lpTokenContract.address)
      ).to.be.true
    })

    it('If caller is not contract owner, it should fail', async () => {
      await expect(
        rewardsContract.connect(addr1).removeAmmLp(lpTokenContract.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('If caller is contract owner, it should not fail; If AMM LP pool is whitelisted it should not fail; Remove AMM LP pool from ammLpPools', async () => {
      await expect(
        rewardsContract.connect(owner).removeAmmLp(lpTokenContract.address)
      ).to.not.be.reverted
    })

    it('If AMM LP pool is not whitelisted is should fail', async () => {
      await expect(
        rewardsContract.connect(owner).removeAmmLp(lpTokenContract.address)
      ).to.be.revertedWith('AMM LP Pool not whitelisted')
    })

    it('Should not be valid amm lp', async () => {
      expect(
        await rewardsContract.isValidAmmLp(lpTokenContract.address)
      ).to.be.false
    })
  })

  describe('As an Admin, I can remove whitelisted collateral type', () => {
    it('Should be valid collateral type', async () => {
      expect(
        await rewardsContract.isValidMinterLp(collateralERC20Contract.address)
      ).to.be.true
    })

    it('If caller is not contract owner, it should fail', async () => {
      await expect(
        rewardsContract
          .connect(addr1)
          .removeMinterCollateralType(collateralERC20Contract.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('If caller is contract owner, it should not fail; If Minter collateral type is whitelisted it should not fail; Remove Minter collateral type from minterLpPools', async () => {
      await expect(
        rewardsContract
          .connect(owner)
          .removeMinterCollateralType(collateralERC20Contract.address)
      ).to.not.be.reverted
    })

    it('If collateral type is not whitelisted is should fail', async () => {
      await expect(
        rewardsContract
          .connect(owner)
          .removeMinterCollateralType(collateralERC20Contract.address)
      ).to.be.revertedWith('Collateral type not whitelisted')
    })

    it('Should not be valid collateral type', async () => {
      expect(
        await rewardsContract.isValidMinterLp(collateralERC20Contract.address)
      ).to.be.false
    })
  })

  describe('AMM dApp should be able to query some info from the Rewards contract', () => {
    it('getWhitelistedAMMPoolAddresses() should return all AMM LP addresses', async () => {
      const addresses = await rewardsContract.getWhitelistedAMMPoolAddresses()
      const expectedAddresses = [] // we removed all addreses in line 473 so this is blank initially
      expect(addresses).to.have.all.members(expectedAddresses)
    })

    it('getWhitelistedAMMPoolAddresses() should return updated AMM LP addresses after adding a new address', async () => {
      await rewardsContract.addAmmLp(lpTokenContract.address, 10)
      await rewardsContract.addAmmLp(lpTokenContract2.address, 10)

      const addresses = await rewardsContract.getWhitelistedAMMPoolAddresses()
      const expectedAddresses = [
        lpTokenContract.address,
        lpTokenContract2.address
      ]
      expect(addresses).to.have.all.members(expectedAddresses)
    })

    it('getWhitelistedAMMPoolAddresses() should return updated AMM LP addresses after removing an address', async () => {
      await rewardsContract.removeAmmLp(lpTokenContract.address)

      const addresses = await rewardsContract.getWhitelistedAMMPoolAddresses()
      const expectedAddresses = [lpTokenContract2.address]
      expect(addresses).to.have.all.members(expectedAddresses)
    })
  })

  describe('Rewards helper functions', () => {
    it('should calc rewards', async () => {
      const currentBlock = await ethers.provider.getBlockNumber();
      console.log(`Current block ${currentBlock}`);

      const actual = await rewardsContract.calcReward(currentBlock - 1)
      const expected = Number(290000)

      expect(Number(actual)).to.equal(expected)
    })

    it('should get monthly halo', async () => {
      const actual = await rewardsContract.monthlyHalo()
      const expected = Number(7500000)

      expect(Number(actual)).to.equal(expected)
    })
  })
})
