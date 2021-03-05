from brownie import Contract, accounts, TestContract

def main():
    decimals = 10**18
    test = TestContract.deploy({"from": accounts[0]})
    for i in range(1,61):
        tx = test.calcExp(0.813*decimals, i)
        print(i, "=>", tx.gas_used)
