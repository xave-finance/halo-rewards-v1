// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const formatEther = require("ethers/lib/utils");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const [deployer, testUser] = await hre.ethers.getSigners();

  console.log("Deployer Address:", deployer.address);
  console.log(
    "Deployer balance:",
    hre.ethers.utils.formatEther(await deployer.getBalance())
  );

  const BPS = 10 ** 4;
  const INITIAL_MINT = 10 ** 6;
  const RewardsContract = await hre.ethers.getContractFactory("Rewards");
  const BPTAddress = "0x37f80ac90235ce0d3911952d0ce49071a0ffdb1e";
  const startingRewards = hre.ethers.utils.parseEther("7500000");
  const decayBase = hre.ethers.utils.parseEther("0.813");
  const epochLength = 60;
  const minterLpRewardsRatio = 0.4 * BPS;
  const ammLpRewardsRatio = 0.4 * BPS;
  const vestingRewardsRatio = 0.2 * BPS;
  const genesisTs = Math.floor(Date.now() / 1000);
  const minterLpPools = [["0xcE2E091802c44191ca147EAee66bFE064A01FE37", 10]];
  const ammLpPools = [[BPTAddress, 10]];

  //const haloTokenContractAddress = "0x695eEC33257c167b3f90fb1611bE31a88322b8Ab";
  const minterContractAddress = "0xE94B97b6b43639E238c851A7e693F50033EfD75C";

  const HaloTokenContract = await ethers.getContractFactory("HaloToken");
  let haloTokenContract = await HaloTokenContract.deploy("Halo", "HALO");

  await haloTokenContract.deployed();
  const haloTokenContractAddress = haloTokenContract.address;
  console.log("halo token deployed: ", haloTokenContract.address);

  const rewardsContract = await RewardsContract.deploy(
    haloTokenContractAddress,
    startingRewards,
    decayBase, //multiplied by 10^18
    epochLength,
    minterLpRewardsRatio, //in bps, multiplied by 10^4
    ammLpRewardsRatio, //in bps, multiplied by 10^4
    vestingRewardsRatio, //in bps, multiplied by 10^4
    minterContractAddress,
    genesisTs,
    minterLpPools,
    ammLpPools
  );

  await rewardsContract.deployed();
  console.log("Rewards Contract deployed: ", rewardsContract.address);

  await haloTokenContract.mint(
    rewardsContract.address,
    ethers.utils.parseEther((40 * INITIAL_MINT).toString())
  );

  console.log(
    (40 * INITIAL_MINT).toString() +
      " HALO minted to " +
      rewardsContract.address
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
