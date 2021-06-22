//========================================================
// To deploy AmmRewards (Minichef Fork) specific contracts
//========================================================


const hre = require('hardhat')
async function main() {
    const Test = await hre.ethers.getContractFactory("Test");
    const test = await Test.deploy();
    await test.deployed();
    console.log((await test.get()).toString());
}
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
