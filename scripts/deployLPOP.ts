import doDeployLPOP from './doDeployLPOP'

const INITIAL_MINT = 10 ** 3

doDeployLPOP(INITIAL_MINT, true)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
