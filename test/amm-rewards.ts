import { expect, assert } from "chai";
import { advanceTime, advanceTimeAndBlock, advanceBlockTo, advanceBlock, prepare, deploy, getBigNumber, ADDRESS_ZERO } from "./utils"
const { BigNumber } = require("ethers")
import {ethers} from "hardhat"

let initialVestingRatio = 0.2 * 10**4
let rewardTokenPerSecond = "2416666666666666666"
let changedRewardTokenPerSecond = "1964750000000000000"

describe("Amm Rewards", function () {
  before(async function () {
    await prepare(this, ['AmmRewards', 'HaloToken', 'HaloHalo', 'RewardsManager', 'CollateralERC20', 'LpToken'])
  })

  beforeEach(async function () {
    await deploy(this, [
      ["halo", this.HaloToken, ["Halo", "HALO"]],
    ])
    await deploy(this, [
      ["rnbw", this.HaloHalo, [this.halo.address]],
    ])
    await deploy(this, [
      ["ammRewards", this.AmmRewards, [this.halo.address]]
    ])
    await deploy(this,
      [
        ["rewardsManager", this.RewardsManager, [initialVestingRatio, this.ammRewards.address, this.rnbw.address, this.halo.address]],
        ["lpt", this.LpToken, ["LP Token", "LPT"]],
        ["col", this.CollateralERC20, ["CollateralERC20", "COL"]],
        ["dummy", this.CollateralERC20, ["Dummy", "DummyT"]]
      ])

    await this.halo.mint(this.ammRewards.address, getBigNumber(6000000))
    await this.lpt.mint(this.alice.address, getBigNumber(10000))
    await this.lpt.approve(this.ammRewards.address, getBigNumber(10000))
    await this.ammRewards.setRewardTokenPerSecond(rewardTokenPerSecond)
    await this.lpt.transfer(this.bob.address, getBigNumber(1))
  })

  describe("PoolLength", function () {
    it("PoolLength should execute", async function () {
      await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
      expect((await this.ammRewards.poolLength())).to.be.equal(1);
    })
  })

  describe("Set", function() {
    it("Should emit event LogSetPool", async function () {
      await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
      await expect(this.ammRewards.set(0, 10, this.dummy.address, false))
            .to.emit(this.ammRewards, "LogSetPool")
            .withArgs(0, 10, ADDRESS_ZERO, false)
      await expect(this.ammRewards.set(0, 10, this.dummy.address, true))
            .to.emit(this.ammRewards, "LogSetPool")
            .withArgs(0, 10, this.dummy.address, true)
      })

    it("Should revert if invalid pool", async function () {
      let err;
      try {
        await this.ammRewards.set(0, 10, ADDRESS_ZERO, false)
      } catch (e) {
        err = e;
      }
      assert.equal(err.toString(), "ProviderError: Error: VM Exception while processing transaction: invalid opcode")
      //await expect(this.ammRewards.set(0, 10, ADDRESS_ZERO, false)).to.be.reverted
    })
  })

  describe("Pending Reward Token", function() {
    it("Pending Reward Token should equal Expected Reward Token", async function () {
      await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
      await this.lpt.approve(this.ammRewards.address, getBigNumber(10))
      let log = await this.ammRewards.deposit(0, getBigNumber(1), this.alice.address)
      await advanceTime(86400)
      let log2 = await this.ammRewards.updatePool(0)
      let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp
      let timestamp = (await ethers.provider.getBlock(log.blockNumber)).timestamp
      let expectedRewardToken = BigNumber.from(rewardTokenPerSecond).mul(timestamp2 - timestamp)
      let pendingRewardToken = await this.ammRewards.pendingRewardToken(0, this.alice.address)
      expect(pendingRewardToken).to.be.equal(expectedRewardToken)
    })
    it("When time is lastRewardTime", async function () {
      await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
      await this.lpt.approve(this.ammRewards.address, getBigNumber(10))
      let log = await this.ammRewards.deposit(0, getBigNumber(1), this.alice.address)
      await advanceBlockTo(3)
      let log2 = await this.ammRewards.updatePool(0)
      let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp
      let timestamp = (await ethers.provider.getBlock(log.blockNumber)).timestamp
      let expectedRewardToken = BigNumber.from(rewardTokenPerSecond).mul(timestamp2 - timestamp)
      let pendingRewardToken = await this.ammRewards.pendingRewardToken(0, this.alice.address)
      expect(pendingRewardToken).to.be.equal(expectedRewardToken)
    })
  })

  describe("MassUpdatePools", function () {
    it("Should call updatePool", async function () {
      await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
      await advanceBlockTo(1)
      await this.ammRewards.massUpdatePools([0])
      //expect('updatePool').to.be.calledOnContract(); //not suported by hardhat
      //expect('updatePool').to.be.calledOnContractWith(0); //not suported by hardhat

    })

    it("Updating invalid pools should fail", async function () {
      let err;
      try {
        await this.ammRewards.massUpdatePools([0, 10000, 100000])
      } catch (e) {
        err = e;
      }

      assert.equal(err.toString(), "ProviderError: Error: VM Exception while processing transaction: invalid opcode")
      //await expect(this.ammRewards.massUpdatePools([0, 10000, 100000])).to.be.reverted
    })
})

  describe("Add", function () {
    it("Should add pool with reward token multiplier", async function () {
      await expect(this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO))
            .to.emit(this.ammRewards, "LogPoolAddition")
            .withArgs(0, 10, this.lpt.address, ADDRESS_ZERO)
      })
  })

  describe("UpdatePool", function () {
    it("Should emit event LogUpdatePool", async function () {
      await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
      let timeToAdvance = 600
      await advanceTime(timeToAdvance)
      let lastRewardTime = ((await this.ammRewards.poolInfo(0)).lastRewardTime).toNumber()
      await expect(this.ammRewards.updatePool(0))
            .to.emit(this.ammRewards, "LogUpdatePool")
            .withArgs(0, lastRewardTime+timeToAdvance,
              (await this.lpt.balanceOf(this.ammRewards.address)),
              (await this.ammRewards.poolInfo(0)).accRewardTokenPerShare)
    })

  })

  describe("Deposit", function () {
    it("Depositing 0 amount", async function () {
      await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
      await this.lpt.approve(this.ammRewards.address, getBigNumber(10))
      await expect(this.ammRewards.deposit(0, getBigNumber(0), this.alice.address))
            .to.emit(this.ammRewards, "Deposit")
            .withArgs(this.alice.address, 0, 0, this.alice.address)
    })

    it("Depositing into non-existent pool should fail", async function () {
      let err;
      try {
        await this.ammRewards.deposit(1001, getBigNumber(0), this.alice.address)
      } catch (e) {
        err = e;
      }
      assert.equal(err.toString(), "ProviderError: Error: VM Exception while processing transaction: invalid opcode")
      //await expect(this.ammRewards.deposit(1001, getBigNumber(0), this.alice.address)).to.be.reverted
    })
  })

  describe("Withdraw", function () {
    it("Withdraw 0 amount", async function () {
      await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
      await expect(this.ammRewards.withdraw(0, getBigNumber(0), this.alice.address))
            .to.emit(this.ammRewards, "Withdraw")
            .withArgs(this.alice.address, 0, 0, this.alice.address)
    })
  })

  describe("Harvest", function () {
    it("Should give back the correct amount of Reward Token", async function () {

        await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
        await this.lpt.approve(this.ammRewards.address, getBigNumber(10))
        expect(await this.ammRewards.lpToken(0)).to.be.equal(this.lpt.address)
        let log = await this.ammRewards.deposit(0, getBigNumber(1), this.alice.address)
        await advanceTime(86400)
        let log2 = await this.ammRewards.withdraw(0, getBigNumber(1), this.alice.address)
        let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp
        let timestamp = (await ethers.provider.getBlock(log.blockNumber)).timestamp
        let expectedRewardToken = BigNumber.from(rewardTokenPerSecond).mul(timestamp2 - timestamp)
        expect((await this.ammRewards.userInfo(0, this.alice.address)).rewardDebt).to.be.equal("-"+expectedRewardToken)
        await this.ammRewards.harvest(0, this.alice.address)
        expect(await this.halo.balanceOf(this.alice.address)).to.be.equal(expectedRewardToken)
    })
    it("Harvest with empty user balance", async function () {
      await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
      await this.ammRewards.harvest(0, this.alice.address)
    })
  })

  describe("EmergencyWithdraw", function() {
    it("Should emit event EmergencyWithdraw", async function () {

      await this.ammRewards.add(10, this.lpt.address, ADDRESS_ZERO)
      await this.lpt.approve(this.ammRewards.address, getBigNumber(10))
      await this.ammRewards.deposit(0, getBigNumber(1), this.bob.address)

      await expect(this.ammRewards.connect(this.bob).emergencyWithdraw(0, this.bob.address))
      .to.emit(this.ammRewards, "EmergencyWithdraw")
      .withArgs(this.bob.address, 0, getBigNumber(1), this.bob.address)
    })
  })

  describe("Admin functions", function () {
    it("Non-owner should not be able to add pool", async function () {
      await expect(this.ammRewards.connect(this.bob).add(10, this.lpt.address, ADDRESS_ZERO)).to.be.reverted
    })
    it("Owner should be able to add pool", async function () {
      await expect(this.ammRewards.connect(this.alice).add(10, this.lpt.address, ADDRESS_ZERO)).to.not.be.reverted
    })
    it("Non-owner should not be able to set pool allocs", async function () {
      await this.ammRewards.connect(this.alice).add(10, this.lpt.address, ADDRESS_ZERO)
      await expect(this.ammRewards.connect(this.bob).set(0, 5, ADDRESS_ZERO, false)).to.be.reverted
    })
    it("Owner should be able to set pool allocs", async function () {
      await this.ammRewards.connect(this.alice).add(10, this.lpt.address, ADDRESS_ZERO)
      await expect(this.ammRewards.connect(this.alice).set(0, 5, ADDRESS_ZERO, false)).to.not.be.reverted
    })
    it("Non-owner should not be able to set rewardTokenPerSecond", async function () {
      await expect(this.ammRewards.connect(this.bob).setRewardTokenPerSecond(changedRewardTokenPerSecond)).to.be.reverted
    })
    it("Owner should be able to set rewardTokenPerSecond", async function () {
      await expect(this.ammRewards.connect(this.alice).setRewardTokenPerSecond(changedRewardTokenPerSecond)).to.not.be.reverted
    })
  })
})
