from brownie import Contract, accounts
from brownie import Rewards, CollateralERC20, LpToken, Minter, UBE, HaloToken
from dotenv import load_dotenv
from os import getenv
import shelve
from time import sleep
from random import randint

def update(rewards, lp_address, collateral_address):
    args = {"from": accounts[0], "gasPrice": "5 gwei", "allow_revert": True}
    rewards.updateAmmRewardPool(lp_address, args)
    rewards.updateMinterRewardPool(collateral_address, args)

def main():
    d = shelve.open('addresses')

    DECIMALS = 10**18
    BPS = 10**4
    INITIAL_MINT = 10**6 * DECIMALS
    args = {"from": accounts[0], "gasPrice": "5 gwei", "allow_revert": True}
    #sleep(5)

    collateralERC20_address = d['collateralERC20']
    ammLpToken_address = d['ammLpToken']
    ube_address = d['ube']
    halo_address = d['halo']
    minter_address = d['minter']
    rewards_address = d['rewards']

    rewards = Contract(rewards_address)
    # rewards.initialize({"from": accounts[0]})

    #approvals
    ammLpToken = Contract(ammLpToken_address)
    # ammLpToken.approve(rewards_address, 2**255, {"from": accounts[0]})

    collateralERC20 = Contract(collateralERC20_address)
    # collateralERC20.approve(minter_address, 2**255, {"from": accounts[0]})

    ube = Contract(ube_address)
    # ube.approve(minter_address, 2**255, {"from": accounts[0]})

    #deposit halo tokens to rewards contract
    halo = Contract(halo_address)
    # halo.transfer(rewards_address, halo.balanceOf(accounts[0]), {"from": accounts[0]})

    # rewards.deposit(ammLpToken_address, 100*DECIMALS, args)
    #
    # sleep(randint(30,60))
    # update(rewards, ammLpToken_address, collateralERC20_address)
    # print(rewards.pendingAmmLpUserRewards(ammLpToken_address, accounts[0]))
    # print(rewards.getAmmLpPoolInfo(ammLpToken_address))


    minter = Contract(minter_address)
    print(collateralERC20.allowance(accounts[0], minter_address))
    deposit_tx = minter.depositByCollateralAddress(100*DECIMALS, 100*DECIMALS, collateralERC20_address, args)
    print(deposit_tx.call_trace())
    # print(deposit_tx.info())
    # print(deposit_tx.events)
    # print(deposit_tx.traceback())
    sleep(randint(30,60))
    update(rewards, ammLpToken_address, collateralERC20_address)
    print(rewards.pendingAmmLpUserRewards(ammLpToken_address, accounts[0]))
    print(rewards.getAmmLpPoolInfo(ammLpToken_address))
    print(rewards.getMinterLpPoolInfo(collateralERC20_address))

    print(halo.balanceOf(accounts[0]))

    #Steps
    #1. Deploy collateral, lptoken, ubetoken erc20s
    #2. Deploy minter contract
    #3. set phm (ube) address on minter
    #4.
