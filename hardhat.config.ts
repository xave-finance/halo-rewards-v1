require('dotenv').config()

import { task } from 'hardhat/config'
import { HardhatUserConfig } from 'hardhat/types'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-gas-reporter'
import '@nomiclabs/hardhat-ethers'
import 'solidity-coverage'

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID || ''
const MNEMONIC_SEED = process.env.MNEMONIC_SEED || ''

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const config: HardhatUserConfig = {
  solidity: '0.6.12',
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: MNEMONIC_SEED
      }
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: {
        mnemonic: MNEMONIC_SEED
      }
    },
    localhost: {
      chainId: 1337,
      url: 'http://127.0.0.1:8545/'
    }
  }
}

export default config
