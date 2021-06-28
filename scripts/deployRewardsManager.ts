import doDeployRewardsManager from './doDeployRewardsManager'

doDeployRewardsManager(
  process.env.HALO_TOKEN_ADDRESS,
  process.env.AMM_REWARDS_CONTRACT_ADDRESS,
  process.env.HALOHALO_CONTRACT_ADDRESS,
  true
)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
