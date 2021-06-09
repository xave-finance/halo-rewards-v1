import deployAllAmmRewards from './deployAllAmmRewards'

deployAllAmmRewards('BSCTestnet', true)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
