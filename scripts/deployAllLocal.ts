import { ethers } from 'hardhat'

const BPS = 10 ** 4
const INITIAL_MINT = 10 ** 6

const deployAllLocal = async () => {
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
  const HaloHalo = await ethers.getContractFactory('HaloHalo')
  const HaloHaloContract = await HaloHalo.deploy(haloTokenContract.address)
  await HaloHaloContract.deployed()
  console.log('halohaloContract deployed at: ', HaloHaloContract.address)

  /**
   * Deploy dummy contracts (required by Rewards contract)
   * - collateral token
   * - LP token contract
   * - minter
   */
  const CollateralERC20 = await ethers.getContractFactory('CollateralERC20')
  const collateralERC20Contract = await CollateralERC20.deploy('Dai', 'DAI')
  await collateralERC20Contract.deployed()

  const Minter = await ethers.getContractFactory('Minter')
  const minterContract = await Minter.deploy()
  await minterContract.deployed()
  console.log(
    'Collateral token & minter deployed at: ',
    collateralERC20Contract.address,
    minterContract.address
  )

  /**
   * Deploy LP Token for Local
   */

  const LpToken = await ethers.getContractFactory('LpToken')
  const lpTokenContract = await LpToken.deploy('LpToken', 'LPT')
  await lpTokenContract.deployed()
  console.log('lptoken deployed at ', lpTokenContract.address)

  /**
   * Deploy Rewards contract
   */
  const startingRewards = ethers.utils.parseEther('7500000')
  const minterLpRewardsRatio = 0.4 * BPS
  const ammLpRewardsRatio = 0.4 * BPS
  const vestingRewardsRatio = 0.2 * BPS
  const genesisBlock = await ethers.provider.getBlockNumber()
  const minterLpPools = [[collateralERC20Contract.address, 10]]

  // Hardcode kovan balancer pools
  const ammLpPools = [[lpTokenContract.address, 10]]

  const Rewards = await ethers.getContractFactory('Rewards')
  const rewardsContract = await Rewards.deploy(
    haloTokenContract.address,
    startingRewards,
    minterLpRewardsRatio, //in bps, multiplied by 10^4
    ammLpRewardsRatio, //in bps, multiplied by 10^4
    vestingRewardsRatio, //in bps, multiplied by 10^4
    minterContract.address,
    genesisBlock,
    minterLpPools,
    ammLpPools
  )
  await rewardsContract.deployed()
  console.log('rewardsContract deployed at: ', rewardsContract.address)

  // Mint initial Halo tokens
  await haloTokenContract.mint(
    rewardsContract.address,
    ethers.utils.parseEther((40 * INITIAL_MINT).toString())
  )
  console.log('Minted initial HALO for Rewards contract')

  // Set Reward's Halo Chest Contract
  await rewardsContract.setHaloChest(HaloHaloContract.address)
  console.log('Done setting Halo Chest contract address')
}

deployAllLocal()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
