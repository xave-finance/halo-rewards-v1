require('dotenv').config()

import { task } from 'hardhat/config'
import { HardhatUserConfig } from 'hardhat/types'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-gas-reporter'
import '@nomiclabs/hardhat-ethers'
import 'solidity-coverage'
import '@nomiclabs/hardhat-etherscan'
import sleep from './scripts/util/sleep'

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

/**
 * use this if you ran the deploy script, but timed out on terminal while waiting for tx confirmation
 * sample: npx hardhat verifyHalo --address '' --name 'Rainbow Token' --symbol 'RNBW' --network "mainnet"
 */
task('verifyHalo', 'verifies predeployed Halo token')
  .addParam(
    'address',
    'The mainnet address of the deployed contract to be verified'
  )
  .addParam('name', 'name of the deployed token')
  .addParam('symbol', 'symbol of the deployed token')
  .setAction(async (args, hre) => {
    // auto verify halo token
    console.log('verifying haloToken')
    await hre.run('verify:verify', {
      address: args.address,
      constructorArguments: [args.name, args.symbol]
    })
  })

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID || ''
const MNEMONIC_SEED = process.env.MNEMONIC_SEED || ''
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ''

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  solidity: '0.6.12',
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      chainId: 1,
      accounts: {
        mnemonic: MNEMONIC_SEED
      },
      gas: 'auto',
      gasPrice: 'auto'
    },
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
    },
    bscTestnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      gasPrice: 20000000000,
      accounts: {
        mnemonic: MNEMONIC_SEED
      }
    },
    matic: {
      url: 'https://rpc-mumbai.maticvigil.com',
      chainId: 137,
      accounts: {
        mnemonic: MNEMONIC_SEED
      }
    },
    moonbase: {
      url: 'https://rpc.testnet.moonbeam.network',
      chainId: 1287,
      accounts: {
        mnemonic: MNEMONIC_SEED
      }
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  }
}

// export default config
