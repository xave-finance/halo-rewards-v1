import deployAll from './deployAllAmmRewards'

deployAll('Kovan', true)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
