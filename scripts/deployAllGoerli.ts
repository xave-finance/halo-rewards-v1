import deployAllAmmRewards from './deployAllAmmRewards'

deployAllAmmRewards('Goerli', true)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
