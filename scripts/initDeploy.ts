import { ethers } from 'hardhat'
const hre = require('hardhat')

const BASIS_POINTS = 10 ** 4
const INITIAL_MINT = 10 ** 6

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

const deployAll = async ( network, verify ) => {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying with account: ', deployer.address)
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

  /**
   * Deploy Rewards contract
   */
  const ammLpRewardsRatio = 0.4 * BASIS_POINTS
  const vestingRewardsRatio = 0.2 * BASIS_POINTS
  const genesisBlock = await ethers.provider.getBlockNumber()
  
  let ammLpPools = []

  switch (network) {
    case 'Kovan':
      // Hardcode kovan balancer pools
      ammLpPools = [
        ['0x37f80ac90235ce0d3911952d0ce49071a0ffdb1e', 10],
        ['0x65850ecd767e7ef71e4b78a348bb605343bd87c3', 10]
      ]
      break;
    case 'Goerli':
      ammLpPools = [
        ['0xBea012aaF56949a95759B9CE0B494A97edf389e6', 10],
        ['0x9C303C18397cB5Fa62D9e68a0C7f2Cc6e00F0066', 10]
      ]
      break;
    case 'Matic':
      // Sushi LP Token
      ammLpPools = [
        ['0xc4e595acDD7d12feC385E5dA5D43160e8A0bAC0E', 10]
      ]
      break
    case 'Moonbase': 
    case 'Local': {
      const LpToken = await ethers.getContractFactory('LpToken')
      const lpTokenContract = await LpToken.deploy('LpToken', 'LPT')
      await lpTokenContract.deployed()
      console.log('lptoken deployed at ', lpTokenContract.address)
      ammLpPools = [[lpTokenContract.address, 10]]
      break
    }
    default:
      ammLpPools = [
        ['0x37f80ac90235ce0d3911952d0ce49071a0ffdb1e', 10],
        ['0x65850ecd767e7ef71e4b78a348bb605343bd87c3', 10]
      ]
      break
  }

  const Rewards = await ethers.getContractFactory('Rewards')
  const rewardsContract = await Rewards.deploy(
    HaloHaloContract.address,
    ammLpRewardsRatio, //in bps, multiplied by 10^4
    genesisBlock,
    ammLpPools
  )
  await rewardsContract.deployed()
  console.log(
    'rewardsContract deployed at contract address ',
    rewardsContract.address
  )

  const RewardsManager = await ethers.getContractFactory('RewardsManager')
  const rewardsManager = await RewardsManager.deploy(
    vestingRewardsRatio,
    rewardsContract.address,
    HaloHaloContract.address,
    haloTokenContract.address
  )
  console.log(
    'rewardsManager deployed at contract address ',
    rewardsManager.address
  )
  await rewardsContract.setRewardsManagerAddress(rewardsManager.address)
  const rewardsManagerAddress = await rewardsContract.getRewardsManagerAddress()
  console.log(
    'rewardsContract manager set to ',
    rewardsManagerAddress
  )

  if (verify === true) {

    console.log(
      'waiting 1 minute for etherscan to cache newly deployed contract bytecode'
    )
    await sleep(60000)
    console.log('done waiting')

    // auto verify halo token
    console.log('verifying haloToken')
    await hre.run('verify:verify', {
      address: haloTokenContract.address,
      constructorArguments: ['HALO Rewards Token', 'HALO']
    })

    // auto verify rewards contract
    console.log('verifying rewardsContract')
    await hre.run('verify:verify', {
      address: rewardsContract.address,
      constructorArguments: [
        HaloHaloContract.address,
        ammLpRewardsRatio,
        genesisBlock,
        ammLpPools
      ]
    })

    // auto verify halohalo contract
    console.log('verifying halohaloContract')
    await hre.run('verify:verify', {
      address: HaloHaloContract.address,
      constructorArguments: [haloTokenContract.address]
    })

    // auto verify RewardsManager contract
    console.log('verifying rewardsManagerContract')
    await hre.run('verify:verify', {
      address: rewardsManager.address,
      constructorArguments: [
        vestingRewardsRatio,
        rewardsContract.address,
        HaloHaloContract.address,
        haloTokenContract.address
      ]
    })

  }
  // Mint initial Halo tokens
  await haloTokenContract.mint(
    deployer.address,
    ethers.utils.parseEther((100 * INITIAL_MINT).toString())
  )
  console.log('Minted initial HALO for deployer account', deployer.address)
}

export default deployAll
