const { ethers } = require('hardhat');

const DECIMAL_PRECISION = 2;

function roundTo2Decimals(numberToFormat){
    return parseFloat(numberToFormat).toFixed(DECIMAL_PRECISION);
}

function formatEtherRoundTo2Decimals(numberToFormat){
    return parseFloat(ethers.utils.formatEther(numberToFormat)).toFixed(DECIMAL_PRECISION);
}

module.exports = { roundTo2Decimals, formatEtherRoundTo2Decimals }
