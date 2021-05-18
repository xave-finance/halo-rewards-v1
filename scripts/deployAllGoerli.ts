import  deployAll  from './initDeploy'

deployAll('Goerli', false)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
