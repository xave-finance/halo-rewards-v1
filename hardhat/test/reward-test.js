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
let genesisTs
let epochLength
const DECIMALS = 10**18
const BPS = 10**4
const INITIAL_MINT = 10**6
let owner
let addr1
let addr2
let addrs
const sleep = (delay) => new Promise((resolve)=>{console.log("\tSleeping for "+delay + " secs...");setTimeout(resolve, delay*1000)});

const sumExp = (m, n) => {
    const x = DECIMALS;
    const s = 0;
    for (const i = 0; i < n; i++) {
        x = x * m / DECIMALS;
        s = s + x;
    }
    return s;
}

// const rewardCalc = (genesisTs, to) => {
//     const nMonths = (to - genesisTs)/epochLength;
//     const accMonthlyHalo = ( startingRewards * sumExp(decayBase, nMonths) ) / DECIMALS;
//     const diffTime = ( (to - genesisTs + (epochLength * nMonths)) * DECIMALS) / epochLength;
//     const thisMonthsReward = startingRewards.mul(exp(decayBase, nMonths)).div(DECIMALS);
//     uint256 tillFrom = (diffTime.mul(thisMonthsReward).div(DECIMALS)).add(accMonthlyHalo);
//
//     nMonths = (now.sub(genesisTs)).div(epochLength);
//     accMonthlyHalo = startingRewards.mul(sumExp(decayBase, nMonths)).div(DECIMALS);
//     diffTime = ((now.sub(genesisTs.add(epochLength.mul(nMonths)))).mul(DECIMALS)).div(epochLength);
//
//     thisMonthsReward = startingRewards.mul(exp(decayBase, nMonths)).div(DECIMALS);
//     uint256 tillNow = (diffTime.mul(thisMonthsReward).div(DECIMALS)).add(accMonthlyHalo);
//
//     return tillNow.sub(tillFrom);
// }
before(async() => {

    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    console.log("===================Deploying Contracts=====================");
    // console.log(addrs.map(addr=>addr.address));
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
    epochLength = 60
    const minterLpRewardsRatio = 0.4*BPS
    const ammLpRewardsRatio = 0.4*BPS
    const vestingRewardsRatio = 0.2*BPS
    genesisTs = Math.floor(Date.now() / 1000);
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
    console.log(ownerHaloBalance.toString() + " HALO tokens transfered to rewards contract");

    const ownerUbeBalance = await ubeContract.balanceOf(owner.address);
    await ubeContract.transfer(minterContract.address, ownerUbeBalance);
    console.log(ownerUbeBalance.toString() + " UBE tokens transfered to minter contract");
    console.log("==========================================================\n\n")
})

describe("Check Contract Deployments", function() {
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

describe("When I deposit collateral tokens (DAI) on the Minter dApp, I start to earn HALO rewards.\n\tWhen I withdraw DAI, I stop earning HALO rewards", function() {
    var depositTxTs;
    var withdrawalTxTs;
    it("I earn the correct number of HALO tokens per time interval on depositing DAI", async() => {

        await expect(minterContract.depositByCollateralAddress(
            ethers.utils.parseEther('100'),
            ethers.utils.parseEther('100'),
            collateralERC20Contract.address
        )).to.not.be.reverted;

        depositTxTs = (await ethers.provider.getBlock()).timestamp;

        await sleep(5);
        console.log("\tUpdate Minter Rewards")

        await rewardsContract.updateMinterRewardPool(collateralERC20Contract.address);
        var updateTxTs = (await ethers.provider.getBlock()).timestamp;

        const getUnclaimedMinterLpRewardsByUser = await rewardsContract.getUnclaimedMinterLpRewardsByUser(collateralERC20Contract.address, owner.address);
        //console.log(ethers.utils.formatEther(unclaimedMinterLpUserRewards));

        expect(Math.round(parseFloat(ethers.utils.formatEther(await rewardsContract.getUnclaimedMinterLpRewardsByUser(collateralERC20Contract.address, owner.address))))).to.equal((updateTxTs-depositTxTs)*50000);
    })

    it("I stop earning HALO tokens on withdrawing DAI", async() => {

        await expect(minterContract.redeemByCollateralAddress(
            ethers.utils.parseEther('100'),
            ethers.utils.parseEther('100'),
            collateralERC20Contract.address
        )).to.not.be.reverted;

        withdrawalTxTs = (await ethers.provider.getBlock()).timestamp;

        await sleep(5);
        console.log("\tUpdate Minter Rewards")

        await rewardsContract.updateMinterRewardPool(collateralERC20Contract.address);
        var updateTxTs = (await ethers.provider.getBlock()).timestamp;

        //const unclaimedMinterLpUserRewards = await rewardsContract.unclaimedMinterLpUserRewards(collateralERC20Contract.address, owner.address);
        //console.log(ethers.utils.formatEther(unclaimedMinterLpUserRewards));
        console.log("\tUnclaimed rewards for user after withdrawing DAI should be 0");
        expect(Math.round(parseFloat(ethers.utils.formatEther(await rewardsContract.getUnclaimedMinterLpRewardsByUser(collateralERC20Contract.address, owner.address))))).to.equal(0);

    })

    it("Should have correct amount of HALO token balance", async() => {
        expect(Math.round(parseFloat(ethers.utils.formatEther(await haloTokenContract.balanceOf(owner.address))))).to.equal((withdrawalTxTs-depositTxTs-1)*50000);
    })

})

describe("When I supply liquidity to an AMM, I am able to receive my proportion of HALO rewards.\n\
        When I remove my AMM stake token from the Rewards contract, I stop earning HALO", function() {
    var depositTxTs;
    var withdrawalTxTs;
    var haloBal;
    it("I earn the correct number of HALO tokens per time interval on depositing LPT", async() => {
        //const haloBal = Math.round(ethers.utils.formatEther(await haloTokenContract.balanceOf(owner.address));
        haloBal = Math.round(parseFloat(ethers.utils.formatEther(await haloTokenContract.balanceOf(owner.address))));
        await expect(rewardsContract.depositPoolTokens(
            lpTokenContract.address,
            ethers.utils.parseEther('100')
        )).to.not.be.reverted;

        depositTxTs = (await ethers.provider.getBlock()).timestamp;

        await sleep(5);
        console.log("\tUpdate Amm LP pool Rewards")

        await rewardsContract.updateAmmRewardPool(lpTokenContract.address);
        var updateTxTs = (await ethers.provider.getBlock()).timestamp;

        const getUnclaimedPoolRewardsByUserByPool = await rewardsContract.getUnclaimedPoolRewardsByUserByPool(lpTokenContract.address, owner.address);
        //console.log(ethers.utils.formatEther(unclaimedMinterLpUserRewards));

        expect(Math.round(parseFloat(ethers.utils.formatEther(await rewardsContract.getUnclaimedPoolRewardsByUserByPool(lpTokenContract.address, owner.address))))).to.equal((updateTxTs-depositTxTs)*50000);
    })

    it("I stop earning HALO tokens on withdrawing LPT", async() => {

        await expect(rewardsContract.withdrawPoolTokens(
            lpTokenContract.address,
            ethers.utils.parseEther('100')
        )).to.not.be.reverted;

        withdrawalTxTs = (await ethers.provider.getBlock()).timestamp;

        await sleep(5);
        console.log("\tUpdate Amm Lp pool Rewards")

        await rewardsContract.updateAmmRewardPool(lpTokenContract.address);
        var updateTxTs = (await ethers.provider.getBlock()).timestamp;

        //const unclaimedMinterLpUserRewards = await rewardsContract.unclaimedMinterLpUserRewards(collateralERC20Contract.address, owner.address);
        //console.log(ethers.utils.formatEther(unclaimedMinterLpUserRewards));
        console.log("\tUnclaimed rewards for user after withdrawing LPT should be 0");
        expect(Math.round(parseFloat(ethers.utils.formatEther(await rewardsContract.getUnclaimedPoolRewardsByUserByPool(lpTokenContract.address, owner.address))))).to.equal(0);

    })

    it("Should have correct amount of HALO token balance", async() => {
        expect(Math.round(parseFloat(ethers.utils.formatEther(await haloTokenContract.balanceOf(owner.address))))).to.equal((withdrawalTxTs-depositTxTs)*50000 + haloBal);
    })

})

describe("I can view my unclaimed HALO tokens on the Minter dApp", function() {
    it("If UBE tokens were minted, display the correct number of HALO tokens rewards", async() => {
        //console.log("\tIf UBE tokens were minted, return the total number of HALO tokens from the minter pool");
        await expect(minterContract.depositByCollateralAddress(
            ethers.utils.parseEther('100'),
            ethers.utils.parseEther('100'),
            collateralERC20Contract.address
        )).to.not.be.reverted;

        var depositTxTs = (await ethers.provider.getBlock()).timestamp;

        await sleep(5);
        console.log("\tUpdate Minter Rewards...")

        await rewardsContract.updateMinterRewardPool(collateralERC20Contract.address);
        var updateTxTs = (await ethers.provider.getBlock()).timestamp;

        const getUnclaimedMinterLpRewardsByUser = await rewardsContract.getUnclaimedMinterLpRewardsByUser(collateralERC20Contract.address, owner.address);
        //console.log(ethers.utils.formatEther(unclaimedMinterLpUserRewards));

        expect(Math.round(parseFloat(ethers.utils.formatEther(await rewardsContract.getUnclaimedMinterLpRewardsByUser(collateralERC20Contract.address, owner.address))))).to.equal((updateTxTs-depositTxTs)*50000);

    })

    it("If LP tokens were deposited, display the correct number of HALO tokens rewards", async() => {
        await expect(rewardsContract.depositPoolTokens(
            lpTokenContract.address,
            ethers.utils.parseEther('100'),
        )).to.not.be.reverted;
        depositTxTs = (await ethers.provider.getBlock()).timestamp;
        await sleep(5);
        console.log("\tUpdate Amm Rewards...")

        await rewardsContract.updateAmmRewardPool(lpTokenContract.address);
        updateTxTs = (await ethers.provider.getBlock()).timestamp;

        const getUnclaimedPoolRewardsByUserByPool = await rewardsContract.getUnclaimedPoolRewardsByUserByPool(lpTokenContract.address, owner.address);
        //console.log(ethers.utils.formatEther(getUnclaimedPoolRewardsByUserByPool));

        expect(Math.round(parseFloat(ethers.utils.formatEther(await rewardsContract.getUnclaimedPoolRewardsByUserByPool(lpTokenContract.address, owner.address))))).to.equal((updateTxTs-depositTxTs)*50000);

        //console.log(ethers.utils.formatEther(await haloTokenContract.balanceOf(owner.address)));
    })
})

describe("Earn vesting rewards by staking HALO inside HaloChest", function() {
    var ownerHaloBal
    it("Deposit HALO tokens to HaloChest, receive xHALO", async() => {
        //console.log("\tIf UBE tokens were minted, return the total number of HALO tokens from the minter pool");
        ownerHaloBal = await haloTokenContract.balanceOf(owner.address);
        await haloTokenContract.approve(haloChestContract.address, ownerHaloBal);
        await expect(haloChestContract.enter(
            ownerHaloBal
        )).to.not.be.reverted;
    })

    it("Send unclaimed vested rewards to HaloChest", async() => {
        const currVestedHalo = await rewardsContract.getUnclaimedVestingRewards();
        await expect(rewardsContract.releaseVestedRewards()).to.not.be.reverted;
    })

    it("Claim staked HALO + bonus rewards from HaloChest and burn xHALO", async() => {
        const haloInHaloChest = await haloTokenContract.balanceOf(haloChestContract.address);

        const ownerXHalo = await haloChestContract.balanceOf(owner.address);
        await haloChestContract.leave(ownerXHalo);

        expect(await haloTokenContract.balanceOf(owner.address)).to.equal(haloInHaloChest);
        //console.log(ethers.utils.formatEther(await haloTokenContract.balanceOf(owner.address)));
    })

    it("HALO earned by User A > HALO earned by User B > HALO earned by User C", async() => {
        console.log("Current HALO balance in HaloChest:" +
        ethers.utils.parseEther((await haloTokenContract.balanceOf(haloChestContract.address)).toString()));
        console.log("Minting 100 HALO to User A...");
        await haloTokenContract.mint(addrs[0].address, ethers.utils.parseEther('100'));
        console.log("Minting 100 HALO to User B...");
        await haloTokenContract.mint(addrs[1].address, ethers.utils.parseEther('100'));
        console.log("Minting 100 HALO to User C...");
        await haloTokenContract.mint(addrs[2].address, ethers.utils.parseEther('100'));

        console.log("100 HALO deposited by User A to HaloChest");
        await haloTokenContract.connect(addrs[0]).approve(haloChestContract.address, ethers.utils.parseEther('100'));
        await haloChestContract.connect(addrs[0]).enter(ethers.utils.parseEther('100'));

        sleep(3);

        console.log("Releasing vested bonus tokens to HaloChest from Rewards contract");
        const currVestedHalo = (await rewardsContract.getUnclaimedVestingRewards()).toString();
        console.log(currVestedHalo);
        await rewardsContract.releaseVestedRewards();

        console.log("100 HALO deposited by User B to HaloChest");
        await haloTokenContract.connect(addrs[1]).approve(haloChestContract.address, ethers.utils.parseEther('100'));
        await haloChestContract.connect(addrs[1]).enter(ethers.utils.parseEther('100'));

        sleep(3);

        console.log("Releasing vested bonus tokens to HaloChest from Rewards contract");
        await rewardsContract.releaseVestedRewards();

        console.log("100 HALO deposited by User C to HaloChest");
        await haloTokenContract.connect(addrs[2]).approve(haloChestContract.address, ethers.utils.parseEther('100'));
        await haloChestContract.connect(addrs[2]).enter(ethers.utils.parseEther('100'));
        console.log("All users leave HaloChest");

        await haloChestContract.connect(addrs[0]).leave(await haloChestContract.balanceOf(addrs[0].address));
        await haloChestContract.connect(addrs[1]).leave(await haloChestContract.balanceOf(addrs[1].address));
        await haloChestContract.connect(addrs[2]).leave(await haloChestContract.balanceOf(addrs[2].address));

        console.log("Final HALO balances:")
        console.log("User A: " + ethers.utils.formatEther(await haloTokenContract.balanceOf(addrs[0].address)));
        console.log("User B: " + ethers.utils.formatEther(await haloTokenContract.balanceOf(addrs[1].address)));
        console.log("User C: " + ethers.utils.formatEther(await haloTokenContract.balanceOf(addrs[2].address)));

    })
})

describe("As an Admin, I can update AMM LP pool’s allocation points", function() {
    it("AMM LP allocation points before", async() => {
        expect((await rewardsContract.getAmmLpPoolInfo(lpTokenContract.address)).allocPoint.toString()).to.equal('10');
    })
    it("Total LP allocation points before", async() => {
        expect(await rewardsContract.totalAmmLpAllocationPoints()).to.equal(10);
    })
    it("If caller is not contract owner, it should fail", async() => {
        await expect(rewardsContract.connect(addr1).setAmmLpAlloc(lpTokenContract.address, 5)).to.be.revertedWith('Ownable: caller is not the owner');
    })
    it("If caller is contract owner, it should not fail; If AMM LP pool is whitelisted it should not fail; Set Amm LP pool allocs", async() => {
        await expect(rewardsContract.connect(owner).setAmmLpAlloc(lpTokenContract.address, 5)).to.not.be.reverted;
    })
    it("AMM LP allocation points before", async() => {
        expect((await rewardsContract.getAmmLpPoolInfo(lpTokenContract.address)).allocPoint.toString()).to.equal('5');
    })
    it("expectedAllocPoints = (totalAllocPoints - currentAllocPoints) + newAllocPoints = 10 - 10 + 5", async() => {
        expect(await rewardsContract.totalAmmLpAllocationPoints()).to.equal(5);
    })
})

describe("As an Admin, I can update minter lp collateral allocation points", function() {
    it("DAI allocation points before", async() => {
        expect((await rewardsContract.getMinterLpPoolInfo(collateralERC20Contract.address)).allocPoint.toString()).to.equal('10');
    })
    it("Total Minter LP allocation points before", async() => {
        expect(await rewardsContract.totalMinterLpAllocationPoints()).to.equal(10);
    })
    it("If caller is not contract owner, it should fail", async() => {
        await expect(rewardsContract.connect(addr1).setMinterLpAlloc(collateralERC20Contract.address, 5)).to.be.revertedWith('Ownable: caller is not the owner');
    })
    it("If caller is contract owner, it should not fail; If collateral type is whitelisted it should not fail; Set Minter Lp pool allocs", async() => {
        await expect(rewardsContract.connect(owner).setMinterLpAlloc(collateralERC20Contract.address, 5)).to.not.be.reverted;
    })
    it("DAI LP allocation points before", async() => {
        expect((await rewardsContract.getMinterLpPoolInfo(collateralERC20Contract.address)).allocPoint.toString()).to.equal('5');
    })
    it("expectedAllocPoints = (totalAllocPoints - currentAllocPoints) + newAllocPoints = 10 - 10 + 5", async() => {
        expect(await rewardsContract.totalMinterLpAllocationPoints()).to.equal(5);
    })
})

describe("As an Admin, I can remove whitelisted AMM LP pool", function() {
    it("Should be valid amm lp", async() => {
        expect(await rewardsContract.isValidAmmLp(lpTokenContract.address)).to.equal(true);
    })
    it("If caller is not contract owner, it should fail", async() => {
        await expect(rewardsContract.connect(addr1).removeAmmLp(lpTokenContract.address)).to.be.revertedWith('Ownable: caller is not the owner');
    })
    it("If caller is contract owner, it should not fail; If AMM LP pool is whitelisted it should not fail; Remove AMM LP pool from ammLpPools", async() => {
        await expect(rewardsContract.connect(owner).removeAmmLp(lpTokenContract.address)).to.not.be.reverted;
    })
    it("If AMM LP pool is not whitelisted is should fail", async() => {
        await expect(rewardsContract.connect(owner).removeAmmLp(lpTokenContract.address)).to.be.revertedWith('AMM LP Pool not whitelisted');
    })
    it("Should not be valid amm lp", async() => {
        expect(await rewardsContract.isValidAmmLp(lpTokenContract.address)).to.equal(false);
    })
})

describe("As an Admin, I can remove whitelisted collateral type", function() {
    it("Should be valid collateral type", async() => {
        expect(await rewardsContract.isValidMinterLp(collateralERC20Contract.address)).to.equal(true);
    })
    it("If caller is not contract owner, it should fail", async() => {
        await expect(rewardsContract.connect(addr1).removeMinterCollateralType(collateralERC20Contract.address)).to.be.revertedWith('Ownable: caller is not the owner');
    })
    it("If caller is contract owner, it should not fail; If Minter collateral type is whitelisted it should not fail; Remove Minter collateral type from minterLpPools", async() => {
        await expect(rewardsContract.connect(owner).removeMinterCollateralType(collateralERC20Contract.address)).to.not.be.reverted;
    })
    it("If collateral type is not whitelisted is should fail", async() => {
        await expect(rewardsContract.connect(owner).removeMinterCollateralType(collateralERC20Contract.address)).to.be.revertedWith('Collateral type not whitelisted');
    })
    it("Should not be valid collateral type", async() => {
        expect(await rewardsContract.isValidMinterLp(collateralERC20Contract.address)).to.equal(false);
    })
})
