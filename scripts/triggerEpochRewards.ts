import { ethers } from 'hardhat'
import { formatEther, parseEther } from 'ethers/lib/utils'

const triggerEpochRewards = async () => {
  // We get the contract to deploy
  const [deployer] = await ethers.getSigners()
  const REWARDS_TO_DEPLOY = 100000

  // Deployer information
  console.log('Deployer Address:', deployer.address)
  console.log('Deployer balance:', formatEther(await deployer.getBalance()))

  const rewardsManagerContractAddress =
    '0xC37ed3A97c99a4fD1f2627d83f5a0b4BC2AF4156'

  const haloTokenContract = await ethers.getContractAt(
    'HaloToken',
    '0x24b773b2ADBa437b9920BD354F6718a77dbc76af'
  )

  const currentHaloBalance = await haloTokenContract.balanceOf(deployer.address)

  console.log('Current Balance: ', formatEther(currentHaloBalance))

  if (+formatEther(currentHaloBalance) < REWARDS_TO_DEPLOY) {
    const mintTxn = await haloTokenContract.mint(
      deployer.address,
      parseEther(`${REWARDS_TO_DEPLOY}`)
    )

    console.log(await mintTxn.wait())
    console.log('Minted!')
  }

  // Rewards Manager
  await haloTokenContract.approve(
    rewardsManagerContractAddress,
    ethers.constants.MaxUint256
  )
  console.log('Approved!')

  // Rewards constants
  const rewardsManager = await ethers.getContractAt(
    'RewardsManager',
    rewardsManagerContractAddress
  )

  const txn = await rewardsManager.releaseEpochRewards(
    parseEther(`${REWARDS_TO_DEPLOY}`),
    {
      gasLimit: 1000000
    }
  )

  console.log(await txn.wait())
  console.log('Released current epoch!')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
triggerEpochRewards()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
