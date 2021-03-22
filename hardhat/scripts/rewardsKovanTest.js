const hre = require("hardhat");
const { formatEther, parseEther } = require("ethers/lib/utils");

async function main() {
  // We get the contract to deploy
  const [deployer] = await hre.ethers.getSigners();

  // Get contract instance
  const account = "0xeF86859bdD9686e2Ba1eEdfe4BdFe5Fb7cBF5648";
  const rewardsAddress = "0xED83387E0a5eB3f4a7C452ddef92aeB1A911Be27";
  const poolAddress = "0x37f80ac90235ce0d3911952d0ce49071a0ffdb1e";
  const rewardsContract = await ethers.getContractAt("Rewards", rewardsAddress);

  await rewardsContract.updateAmmRewardPool(poolAddress);
  var updateTxTs = (await ethers.provider.getBlock()).timestamp;
  console.log(updateTxTs);
  // "test:kovan": "npx hardhat run scripts/rewardsKovanTest.js --network \"kovan\"",

  console.log(
    "Current deposited LP: ",
    formatEther(
      await rewardsContract.getDepositedPoolTokenBalanceByUser(
        poolAddress,
        account
      )
    )
  );

  console.log(
    "Rewards: ",
    formatEther(
      await rewardsContract.getUnclaimedPoolRewardsByUserByPool(
        poolAddress,
        account
      )
    )
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
