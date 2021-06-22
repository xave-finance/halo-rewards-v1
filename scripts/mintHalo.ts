import { ethers } from 'hardhat'
import { parseEther, formatEther } from 'ethers/lib/utils'
const hre = require('hardhat')
/**
 * Note: This script only works on Kovan. This will supply the user with HALO tokens
 */
const mintHalo = async () => {
  // Get signer
  const [deployer] = await ethers.getSigners()

  // Signer details
  console.log('Caller Address:', deployer.address)
  console.log('Caller balance:', formatEther(await deployer.getBalance()))

  // Hardcoded parameters
  const TOKENS_TO_MINT = '100'
  const haloTokenContractAddress = '0xc4b3F0437c5D53B01B3C7dDEd7318A60ecE76650'
  // const receiver = '0xeF86859bdD9686e2Ba1eEdfe4BdFe5Fb7cBF5648'

  // Get contract instance
  const haloTokenContract = await ethers.getContractAt(
    'HaloToken',
    haloTokenContractAddress
  )

  // Mint tokens to reciever
  const mintTxn = await haloTokenContract.mint(
    receiver,
    parseEther(TOKENS_TO_MINT)
  )

  // Wait for transaction receipt
  console.log('========================')
  console.log('Transaction Receipt: ')
  console.log('')
  console.log(await mintTxn.wait())
  console.log('')
  console.log('========================')
  console.log('')

  // Confirmation
  console.log(`=> Minted ${TOKENS_TO_MINT} to address ${receiver}`)

  // Check receiver balance
  const receiverBalance = await haloTokenContract.balanceOf(receiver)
  console.log(`=> Receiver new balance: ${formatEther(receiverBalance)}`)

  // auto verify halohalo contract
  console.log('verifying halohaloContract')
  await hre.run('verify:verify', {
    address: HaloHaloContract.address,
    constructorArguments: [haloTokenContract.address]
  })
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
mintHalo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
