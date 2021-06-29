import { NETWORK, VESTING_ADDRESS } from './constants/addresses'
import { doDeployAmmRewards } from './doDeployAmmRewards'

doDeployAmmRewards(NETWORK, VESTING_ADDRESS, true)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
