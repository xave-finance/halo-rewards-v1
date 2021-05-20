import deployAll from './initDeploy'

deployAll('Moonbase', false)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
