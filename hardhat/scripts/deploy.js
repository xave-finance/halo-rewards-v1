const hre = require('hardhat')
const ethers = hre.ethers

const BPS = 10 ** 4

const main = async () => {
  /**
   * Deploy HeloToken contract
   */
  const HaloToken = await ethers.getContractFactory('HaloToken')
  const haloTokenContract = await HaloToken.deploy('HALO Rewards Token', 'HALO')
  await haloTokenContract.deployed()
  console.log('haloTokenContract deployed at: ', haloTokenContract.address)

  /**
   * Deploy HeloChest contract
   */
  const HaloChest = await ethers.getContractFactory('HaloChest')
  const haloChestContract = await HaloChest.deploy(haloTokenContract.address)
  await haloChestContract.deployed()
  console.log('haloChestContract deployed at: ', haloChestContract.address)

  /**
   * Deploy dummy contracts (required by Rewards contract)
   * - collateral token
   * - LP token contract
   * - minter
   */
  const CollateralERC20 = await ethers.getContractFactory('CollateralERC20')
  const collateralERC20Contract = await CollateralERC20.deploy('Dai', 'DAI')
  await collateralERC20Contract.deployed()

  const LpToken = await ethers.getContractFactory('LpToken')
  lpTokenContract = await LpToken.deploy('LpToken', 'LPT')
  await lpTokenContract.deployed()

  const Minter = await ethers.getContractFactory('Minter')
  minterContract = await Minter.deploy()
  await minterContract.deployed()
  console.log(
    'Collateral token, LP token & minter deployed at: ',
    collateralERC20Contract.address,
    lpTokenContract.address,
    minterContract.address
  )

  /**
   * Deploy Rewards contract
   */
  const startingRewards = ethers.utils.parseEther('7500000')
  const decayBase = ethers.utils.parseEther('0.813')
  const epochLength = 60
  const minterLpRewardsRatio = 0.4 * BPS
  const ammLpRewardsRatio = 0.4 * BPS
  const vestingRewardsRatio = 0.2 * BPS
  const genesisTs = Math.floor(Date.now() / 1000)
  const minterLpPools = [[collateralERC20Contract.address, 10]]
  const ammLpPools = [[lpTokenContract.address, 10]]

  const Rewards = await ethers.getContractFactory('Rewards')
  const rewardsContract = await Rewards.deploy(
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
  await rewardsContract.deployed()
  console.log('rewardsContract deployed at: ', rewardsContract.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
