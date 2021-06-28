import { ethers } from 'hardhat'
import { formatEther } from 'ethers/lib/utils'

const updateAMMPoolRewards = async () => {
  // We get the contract to deploy
  const [deployer] = await ethers.getSigners()

  // Deployer information
  console.log('Deployer Address:', deployer.address)
  console.log('Deployer balance:', formatEther(await deployer.getBalance()))
  const rewardsContract = '0xA5915c43ACff074631C88e6E2F66f6eFeDe3051F'
  const pool = 0xc37ed3a97c99a4fd1f2627d83f5a0b4bc2af4156

  // Rewards constants
  const rewards = await ethers.getContractAt('Rewards', rewardsContract)

  // If you need to add to amm lp
  // await rewards.addAmmLp(pool, 10)

  const txn = await rewards.updateAmmRewardPool(pool, {
    gasLimit: 1000000
  })

  console.log(await txn.wait())
  console.log('Updated AMM Reward Pool')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
updateAMMPoolRewards()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
