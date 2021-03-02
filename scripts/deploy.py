from brownie import Contract, accounts
from brownie import Rewards, CollateralERC20, LpToken, Minter, UBE, HaloToken
from dotenv import load_dotenv
from os import getenv
import shelve
from time import sleep
import time
from random import randint

def update(rewards, lp_address, collateral_address):
    args = {"from": accounts[0], "gasPrice": "5 gwei", "allow_revert": True}
    rewards.updateAmmRewardPool(lp_address, args)
    rewards.updateMinterRewardPool(collateral_address, args)

def main():
    # load_dotenv('.env')
    # accounts.add(getenv('pk1'))
    d = shelve.open('addresses')

    DECIMALS = 10**18
    BPS = 10**4
    INITIAL_MINT = 10**6 * DECIMALS
    args = {"from": accounts[0], "gasPrice": "5 gwei", "allow_revert": True}

    #deploy collateralERC20
    collateralERC20 = CollateralERC20.deploy("CollateralERC20", "COL", args)
    collateralERC20.mint(accounts[0], INITIAL_MINT)

    #deploy lpToken
    ammLpToken = LpToken.deploy("LpToken", "LPT", args)
    ammLpToken.mint(accounts[0], INITIAL_MINT)

    #deploy UBE
    ube = UBE.deploy("UBE", "UBE", args)
    ube.mint(accounts[0], INITIAL_MINT)

    #deploy Halo
    halo = HaloToken.deploy("Halo", "HALO", args)
    halo.mint(accounts[0], 40*INITIAL_MINT)

    #deploy minter
    minter = Minter.deploy(args)

    startingRewards = 7500000 * DECIMALS
    decay_base = 0.813 * DECIMALS
    epoch_length = 30 #2 minutes for testing, should be set to 30*24*60*60
    minterLpRewardsRatio = 0.5*BPS
    ammLpRewardsRatio = 0.5*BPS
    minterLpPools = [(collateralERC20.address, 10)]
    ammLpPools = [(ammLpToken.address, 10)]
    rewards = Rewards.deploy(halo.address, startingRewards, decay_base, epoch_length, minterLpRewardsRatio, ammLpRewardsRatio, minter.address, int(time.time()), minterLpPools, ammLpPools, args)

    # sleep(60)

    d['collateralERC20'] = collateralERC20.address
    d['ammLpToken'] = ammLpToken.address
    d['ube'] = ube.address
    d['halo'] = halo.address
    d['minter'] = minter.address
    d['rewards'] = rewards.address

    # rewards.initialize(args)

    #set minter var
    minter.setRewardsContract(rewards.address)
    minter.setPhmContract(ube.address)

    #approvals
    ammLpToken.approve(rewards.address, 10**36, args)

    collateralERC20.approve(minter.address, 10**36, args)

    ube.approve(minter.address, 10**36, args)

    #deposit halo tokens to rewards contract
    halo.transfer(rewards.address, halo.balanceOf(accounts[0]), args)

    #deposit ube tokens to minter contract
    ube.transfer(minter.address, ube.balanceOf(accounts[0]), args)

    sleep(2*epoch_length+5)
    print(collateralERC20.allowance(accounts[0], minter.address))
    deposit_tx = minter.depositByCollateralAddress(100*DECIMALS, 100*DECIMALS, collateralERC20.address, args)
    print(deposit_tx.call_trace())
    print(deposit_tx.events)
    # sleep(randint(20,30))
    update(rewards, ammLpToken.address, collateralERC20.address)
    print(rewards.pendingAmmLpUserRewards(ammLpToken.address, accounts[0]))
    print(rewards.getAmmLpPoolInfo(ammLpToken.address))
    print(rewards.getMinterLpPoolInfo(collateralERC20.address))

    #
    # print(halo.balanceOf(accounts[0]))

    # rewards.deposit(ammLpToken.address, 100*DECIMALS, {"from": accounts[0]})
    #
    # minter.depositByCollateralAddress(100*DECIMALS, 100*DECIMALS, collateralERC20.address, {"from": accounts[0]})
    #
    # sleep(3*60)
    #
    # update(rewards)
    #
    # rewards.deposit(ammLpToken.address, 1000*DECIMALS, {"from": accounts[0]})
    #
    # minter.depositByCollateralAddress(1000*DECIMALS, 100*DECIMALS, collateralERC20.address, {"from": accounts[0]})
    #
    # print(halo.balanceOf(accounts[0], {"from": accounts[0]}))
    #
    # sleep(4*60)
    #
    # update(rewards)

    #Steps
    #1. Deploy collateral, lptoken, ubetoken erc20s
    #2. Deploy minter contract
    #3. set phm (ube) address on minter
    #4.
