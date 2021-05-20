import deployAll from './initDeploy'

deployAll('Matic', false)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
