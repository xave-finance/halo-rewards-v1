import deployAll2 from './initDeploy2'

deployAll2('Local', false)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
