const { chai, expect, should } = require("chai");
const { BigNumber, Contract } = require('ethers');
const { ethers } = require('hardhat');

let contractCreatorAccount
let rewardsContract
let collateralERC20Contract
let lpTokenContract
let minterContract
let ubeContract
let haloTokenContract
let haloChestContract
const DECIMALS = 10**18
const BPS = 10**4
const INITIAL_MINT = 10**6
let owner
let addr1
let addr2
let addrs

before(async() => {

    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const CollateralERC20 = await ethers.getContractFactory("CollateralERC20");
    collateralERC20Contract = await CollateralERC20.deploy("Dai", "DAI");
    await collateralERC20Contract.deployed();
    console.log("collateralERC20 deployed");

    await collateralERC20Contract.mint(owner.address, ethers.utils.parseEther(INITIAL_MINT.toString()));
    console.log(INITIAL_MINT.toString() + " DAI minted to " + owner.address);
    console.log();

    const LpToken = await ethers.getContractFactory("LpToken");
    lpTokenContract = await LpToken.deploy("LpToken", "LPT");
    await lpTokenContract.deployed();
    console.log("lptoken deployed");

    await lpTokenContract.mint(owner.address, ethers.utils.parseEther(INITIAL_MINT.toString()));
    console.log(INITIAL_MINT.toString() + " LPT minted to " + owner.address);
    console.log();

    const UBE = await ethers.getContractFactory("UBE");
    ubeContract = await UBE.deploy("UBE", "UBE");
    await ubeContract.deployed();
    console.log("ube deployed");

    await ubeContract.mint(owner.address, ethers.utils.parseEther(INITIAL_MINT.toString()));
    console.log(INITIAL_MINT.toString() + " UBE minted to " + owner.address);
    console.log();

    const HaloTokenContract = await ethers.getContractFactory("HaloToken");
    haloTokenContract = await HaloTokenContract.deploy("Halo", "HALO");
    await haloTokenContract.deployed();
    console.log("halo token deployed");

    await haloTokenContract.mint(owner.address, ethers.utils.parseEther((40*INITIAL_MINT).toString()));
    console.log((40*INITIAL_MINT).toString() + " HALO minted to " + owner.address);
    console.log();

    const HaloChestContract = await ethers.getContractFactory("HaloChest");
    haloChestContract = await HaloChestContract.deploy(haloTokenContract.address);
    await haloChestContract.deployed();
    console.log("halo chest deployed");

    const MinterContract = await ethers.getContractFactory("Minter");
    minterContract = await MinterContract.deploy();
    await minterContract.deployed();
    console.log("minter deployed");

    const RewardsContract = await ethers.getContractFactory("Rewards");
    const startingRewards = ethers.utils.parseEther('7500000');
    const decayBase = ethers.utils.parseEther('0.813');
    const epochLength = 60
    const minterLpRewardsRatio = 0.4*BPS
    const ammLpRewardsRatio = 0.4*BPS
    const vestingRewardsRatio = 0.2*BPS
    const genesisTs = Math.floor(Date.now() / 1000);
    const minterLpPools = [[collateralERC20Contract.address, 10]]
    const ammLpPools = [[lpTokenContract.address, 10]]

    rewardsContract = await RewardsContract.deploy(
        haloTokenContract.address,
        startingRewards,
        decayBase, //multiplied by 10^18
        epochLength,
        minterLpRewardsRatio, //in bps, multiplied by 10^4
        ammLpRewardsRatio, //in bps, multiplied by 10^4
        vestingRewardsRatio, //in bps, multiplied by 10^4
        minterContract.address,
        genesisTs,
        minterLpPools,
        ammLpPools
    )
    await rewardsContract.deployed();
    console.log("Rewards Contract deployed");
    console.log();

    await rewardsContract.setHaloChest(haloChestContract.address);
    console.log("Halo Chest set");
    console.log();

    await minterContract.setRewardsContract(rewardsContract.address);
    console.log("Rewards contract set on minter");
    console.log();

    await minterContract.setPhmContract(ubeContract.address);
    console.log("UBE contract set on minter");
    console.log();

    await lpTokenContract.approve(rewardsContract.address, ethers.utils.parseEther(INITIAL_MINT.toString()));
    console.log("Rewards contract approved to transfer "+DECIMALS.toString()+ " LPT of "+owner.address);
    console.log();

    await collateralERC20Contract.approve(minterContract.address, ethers.utils.parseEther(INITIAL_MINT.toString()));
    console.log("Minter contract approved to transfer "+DECIMALS.toString()+ " DAI of "+owner.address);
    console.log();

    await ubeContract.approve(minterContract.address, ethers.utils.parseEther(INITIAL_MINT.toString()));
    console.log("Minter contract approved to transfer "+DECIMALS.toString()+ " UBE of "+owner.address);
    console.log();

    const ownerHaloBalance = await haloTokenContract.balanceOf(owner.address);
    await haloTokenContract.transfer(rewardsContract.address, ownerHaloBalance);
    console.log(ownerHaloBalance.toString() + " HALO tokens transfered to Rewards contract");
    console.log();
})

describe("1. Contract Deployments", function() {
    it("Collateral ERC20 should be deployed and owner should have initial mint", async() => {
        expect(await collateralERC20Contract.symbol()).to.equal("DAI");
        expect(await collateralERC20Contract.name()).to.equal("Dai");
        expect(await collateralERC20Contract.balanceOf(owner.address)).to.equal(ethers.utils.parseEther(INITIAL_MINT.toString()));
    })
    it("Lptoken should be deployed", async() => {
        expect(await lpTokenContract.symbol()).to.equal("LPT");
        expect(await lpTokenContract.name()).to.equal("LpToken");
    })
    it("UBE should be deployed", async() => {
        expect(await ubeContract.symbol()).to.equal("UBE");
        expect(await ubeContract.name()).to.equal("UBE");
    })
    it("HaloToken should be deployed", async() => {
        expect(await haloTokenContract.symbol()).to.equal("HALO");
        expect(await haloTokenContract.name()).to.equal("Halo");
    })
    it("HaloChest should be deployed", async() => {
        expect(await haloChestContract.symbol()).to.equal("xHALO");
        expect(await haloChestContract.name()).to.equal("HaloChest");
    })
    it("Rewards Contract should be deployed", async() => {
        expect(await rewardsContract.totalAmmLpAllocationPoints()).to.equal(10);
        expect(await rewardsContract.totalMinterLpAllocationPoints()).to.equal(10);
        expect(await rewardsContract.isValidAmmLp(lpTokenContract.address)).to.equal(true);
        expect(await rewardsContract.isValidAmmLp(collateralERC20Contract.address)).to.equal(false);
        expect(await rewardsContract.isValidMinterLp(collateralERC20Contract.address)).to.equal(true);
        expect(await rewardsContract.isValidMinterLp(lpTokenContract.address)).to.equal(false);
    })

})

describe("2. When I deposit collateral tokens (DAI) on the Minter dApp, I start to earn HALO per block", function() {
    it("I can deposit my collateral", async() => {
        // expect(await minterContract.depositByCollateralAddress())
    })
    // it("can redeem my collateral", async() => {
    //
    // })
    // it("can redeem my collateral", async() => {
    //
    // })

})

describe("3. When I withdraw collateral tokens (DAI) on the Minter dApp, i stop earning HALO tokens", function() {
    // it("I can deposit my collateral", async() => {
    //     expect(await minterContract.depositByCollateralAddress())
    // })
    // it("can redeem my collateral", async() => {
    //
    // })
    // it("can redeem my collateral", async() => {
    //
    // })

})

describe("4. When I supply liquidity to an AMM, I am able to receive my proportion of HALO rewards per block", function() {
    // it("I can deposit my collateral", async() => {
    //     expect(await minterContract.depositByCollateralAddress())
    // })
    // it("can redeem my collateral", async() => {
    //
    // })
    // it("can redeem my collateral", async() => {
    //
    // })

})

describe("5. I can claim my unclaimed HALO tokens at any time on the Minter dApp", function() {
    // it("I can deposit my collateral", async() => {
    //     expect(await minterContract.depositByCollateralAddress())
    // })
    // it("can redeem my collateral", async() => {
    //
    // })
    // it("can redeem my collateral", async() => {
    //
    // })

})
