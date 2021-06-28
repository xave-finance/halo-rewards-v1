import { ethers } from 'hardhat'
const hre = require('hardhat')

const BASIS_POINTS = 10 ** 4

const vestingRewardsRatio = 0.2 * BASIS_POINTS
const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

const doDeployRewardsManager = async (
  rnbwAddress,
  ammRewardsContract,
  haloHaloAddress,
  verify
) => {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying with account: ', deployer.address)

  const RewardsManager = await ethers.getContractFactory('RewardsManager')
  const rewardsManager = await RewardsManager.deploy(
    vestingRewardsRatio,
    ammRewardsContract,
    haloHaloAddress,
    rnbwAddress
  )
  console.log(
    'rewardsManager deployed at contract address ',
    rewardsManager.address
  )

  if (verify === true) {
    console.log(
      'waiting 1 minute for etherscan to cache newly deployed contract bytecode'
    )
    await sleep(60000)
    console.log('done waiting')

    // auto verify RewardsManager contract
    console.log('verifying rewardsManagerContract')
    await hre.run('verify:verify', {
      address: rewardsManager.address,
      constructorArguments: [
        vestingRewardsRatio,
        ammRewardsContract,
        haloHaloAddress,
        rnbwAddress
      ]
    })
  }
}

export default doDeployRewardsManager
function formatEther(arg0: any): any {
  throw new Error('Function not implemented.')
}
