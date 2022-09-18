const { BigNumber } = require("ethers");
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { ethers } = require('hardhat');
const {expect} = require("chai");

let context;
describe("veDistributionSnapshot", function() {

  before(async function () {
    context = this;
    [this.deployer, this.user1, this.user2, this.user3, this.user4] = await ethers.getSigners();
    this.TestTokenFactory = await ethers.getContractFactory("TestToken")
    this.DistributionFactory = await ethers.getContractFactory("veDistributionSnapshot")
  })

  beforeEach(async function () {
    this.token1 = await this.TestTokenFactory.deploy()
    this.token2 = await this.TestTokenFactory.deploy()
    this.token3 = await this.TestTokenFactory.deploy()
    this.distribution = await this.DistributionFactory.deploy();
  })

  it("add balances", async function() {
    expect(await this.distribution.balanceOf(this.user1.address)).to.be.equal(0);
    expect(await this.distribution.balanceOf(this.user2.address)).to.be.equal(0);
    expect(await this.distribution.balanceOf(this.user3.address)).to.be.equal(0);
    expect(await this.distribution.balanceOf(this.user4.address)).to.be.equal(0);
    expect(await this.distribution.totalSupply()).to.be.equal(0);
    expect(await this.distribution.allUsers()).to.be.deep.equal([]);
    expect(await this.distribution.usersCount()).to.be.equal(0);

    await expect(
      this.distribution.connect(this.user1).addBalances([this.user1.address, this.user2.address], [1, 2])
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(
      this.distribution.addBalances([], [])
    ).to.be.revertedWith("DISTRIBUTION: EMPTY_ARRAYS");

    await expect(
      this.distribution.addBalances([this.user1.address], [])
    ).to.be.revertedWith("DISTRIBUTION: INVALID_ARRAYS_LENGTH");

    await expect(
      this.distribution.addBalances([this.user1.address], [1, 2])
    ).to.be.revertedWith("DISTRIBUTION: INVALID_ARRAYS_LENGTH");

    await expect(
      this.distribution.addBalances([this.user1.address, this.user2.address], [1, 0])
    ).to.be.revertedWith("DISTRIBUTION: INVALID_AMOUNT");

    await expect(
      this.distribution.addBalances([this.user1.address, this.user1.address], [1, 1])
    ).to.be.revertedWith("DISTRIBUTION: USER_ALREADY_ADDED");

    await this.distribution.addBalances([this.user1.address], [1])
    expect(await this.distribution.balanceOf(this.user1.address)).to.be.equal(1);
    expect(await this.distribution.balanceOf(this.user2.address)).to.be.equal(0);
    expect(await this.distribution.balanceOf(this.user3.address)).to.be.equal(0);
    expect(await this.distribution.balanceOf(this.user4.address)).to.be.equal(0);
    expect(await this.distribution.totalSupply()).to.be.equal(1);
    expect(await this.distribution.allUsers()).to.be.deep.equal([this.user1.address]);
    expect(await this.distribution.usersCount()).to.be.equal(1);
    expect(await this.distribution.users(0)).to.be.equal(this.user1.address);

    await this.distribution.addBalances([this.user2.address, this.user3.address, this.user4.address], [2, 3, 4])
    expect(await this.distribution.balanceOf(this.user1.address)).to.be.equal(1);
    expect(await this.distribution.balanceOf(this.user2.address)).to.be.equal(2);
    expect(await this.distribution.balanceOf(this.user3.address)).to.be.equal(3);
    expect(await this.distribution.balanceOf(this.user4.address)).to.be.equal(4);
    expect(await this.distribution.totalSupply()).to.be.equal(10);
    expect(await this.distribution.allUsers()).to.be.deep.equal([this.user1.address, this.user2.address, this.user3.address, this.user4.address]);
    expect(await this.distribution.usersCount()).to.be.equal(4);
    expect(await this.distribution.users(0)).to.be.equal(this.user1.address);
    expect(await this.distribution.users(3)).to.be.equal(this.user4.address);

    await expect(
      this.distribution.connect(this.user1).renounceOwnership()
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await this.distribution.renounceOwnership();

    await expect(
      this.distribution.addBalances([this.deployer.address], [1])
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  async function addBalances() {
    await this.distribution.addBalances(
        [this.user1.address, this.user2.address, this.user3.address, this.user4.address],
        [1, 2, 3, 4]
    );
    await this.distribution.renounceOwnership();
  }

  it("withdraw case1: full withdrawal and then additional reward", async function() {
    await expect(
      this.distribution.withdrawReward([this.token1.address])
    ).to.be.revertedWith("DISTRIBUTION: CONTRACT_IS_NOT_FINALIZED");

    await addBalances.bind(this)();

    await expect(
      this.distribution.withdrawReward([this.token1.address])
    ).to.be.revertedWith("DISTRIBUTION: AUTH_FAILED");

    await expect(
      this.distribution.connect(this.user1).withdrawReward([this.token1.address])
    ).to.be.revertedWith("DISTRIBUTION: NOTHING_TO_WITHDRAW");

    ////////
    await checkBalances(this.token1, 0, 0, 0, 0, 0);
    await checkBalances(this.token2, 0, 0, 0, 0, 0);
    await checkBalances(this.token3, 0, 0, 0, 0, 0);


    await this.token1.mint(this.distribution.address, 10000);
    await this.token2.mint(this.distribution.address, 33333);
    await this.token3.mint(this.distribution.address, 8);
    await checkBalances(this.token1, 10000, 0, 0, 0, 0);
    await checkBalances(this.token2, 33333, 0, 0, 0, 0);
    await checkBalances(this.token3, 8,     0, 0, 0, 0);

    await this.distribution.connect(this.user1).withdrawReward([this.token1.address]);
    await checkBalances(this.token1, 9000,  1000, 0, 0, 0);
    await checkBalances(this.token2, 33333, 0, 0, 0, 0);
    await checkBalances(this.token3, 8,     0, 0, 0, 0);

    await this.distribution.connect(this.user1).withdrawReward([this.token2.address]);
    await checkBalances(this.token1, 9000,  1000, 0, 0, 0);
    await checkBalances(this.token2, 30000, 3333, 0, 0, 0);
    await checkBalances(this.token3, 8,     0,    0, 0, 0);
    await checkWithdrawFailed(this.user1);

    ///////

    await withdrawFromAllTokens(this.user3);
    await checkBalances(this.token1, 6000,  1000, 0, 3000, 0);
    await checkBalances(this.token2, 20001, 3333, 0, 9999, 0);
    await checkBalances(this.token3, 6,     0,    0, 2,    0);
    await checkWithdrawFailed(this.user3);

    ///////

    await withdrawFromAllTokens(this.user4);
    await checkBalances(this.token1, 2000, 1000, 0, 3000, 4000);
    await checkBalances(this.token2, 6668, 3333, 0, 9999, 13333);
    await checkBalances(this.token3, 3,    0,    0, 2,    3);
    await checkWithdrawFailed(this.user4);

    ///////

    await withdrawFromAllTokens(this.user2);
    await checkBalances(this.token1, 0, 1000, 2000, 3000, 4000);
    await checkBalances(this.token2, 2, 3333, 6666, 9999, 13333);
    await checkBalances(this.token3, 2, 0,    1,    2,    3);
    await checkWithdrawFailed(this.user2);

    ///////

    await this.token1.mint(this.distribution.address, 10000);
    await this.token2.mint(this.distribution.address, 8);
    await this.token3.mint(this.distribution.address, 2);
    await checkBalances(this.token1, 10000, 1000, 2000, 3000, 4000);
    await checkBalances(this.token2, 10,    3333, 6666, 9999, 13333);
    await checkBalances(this.token3, 4,     0,    1,    2,    3);

    //////

    await withdrawFromAllTokens(this.user1);
    await checkBalances(this.token1, 9000, 2000, 2000, 3000, 4000);
    await checkBalances(this.token2, 9,    3334, 6666, 9999, 13333);
    await checkBalances(this.token3, 3,    1,    1,    2,    3);
    await checkWithdrawFailed(this.user1);

    //////

    await withdrawFromAllTokens(this.user3);
    await checkBalances(this.token1, 6000, 2000, 2000, 6000,  4000);
    await checkBalances(this.token2, 6,    3334, 6666, 10002, 13333);
    await checkBalances(this.token3, 2,    1,    1,    3,     3);
    await checkWithdrawFailed(this.user3);

    //////

    await withdrawFromAllTokens(this.user2);
    await checkBalances(this.token1, 4000, 2000, 4000, 6000,  4000);
    await checkBalances(this.token2, 4,    3334, 6668, 10002, 13333);
    await checkBalances(this.token3, 1,    1,    2,    3,     3);
    await checkWithdrawFailed(this.user2);

    //////

    await withdrawFromAllTokens(this.user4);
    await checkBalances(this.token1, 0, 2000, 4000, 6000,  8000);
    await checkBalances(this.token2, 1, 3334, 6668, 10002, 13336);
    await checkBalances(this.token3, 0, 1,    2,    3,     4);
    await checkWithdrawFailed(this.user2);
  })

  it("withdraw case1: withdrawal with additional reward in the middle", async function() {
    await expect(
      this.distribution.withdrawReward([this.token1.address])
    ).to.be.revertedWith("DISTRIBUTION: CONTRACT_IS_NOT_FINALIZED");

    await addBalances.bind(this)();

    await expect(
      this.distribution.withdrawReward([this.token1.address])
    ).to.be.revertedWith("DISTRIBUTION: AUTH_FAILED");

    await expect(
      this.distribution.connect(this.user1).withdrawReward([this.token1.address])
    ).to.be.revertedWith("DISTRIBUTION: NOTHING_TO_WITHDRAW");

    ////////
    await checkBalances(this.token1, 0, 0, 0, 0, 0);
    await checkBalances(this.token2, 0, 0, 0, 0, 0);
    await checkBalances(this.token3, 0, 0, 0, 0, 0);


    await this.token1.mint(this.distribution.address, 10000);
    await this.token2.mint(this.distribution.address, 33333);
    await this.token3.mint(this.distribution.address, 8);
    await checkBalances(this.token1, 10000, 0, 0, 0, 0);
    await checkBalances(this.token2, 33333, 0, 0, 0, 0);
    await checkBalances(this.token3, 8,     0, 0, 0, 0);

    await this.distribution.connect(this.user1).withdrawReward([this.token1.address]);
    await checkBalances(this.token1, 9000,  1000, 0, 0, 0);
    await checkBalances(this.token2, 33333, 0, 0, 0, 0);
    await checkBalances(this.token3, 8,     0, 0, 0, 0);

    await this.distribution.connect(this.user1).withdrawReward([this.token2.address]);
    await checkBalances(this.token1, 9000,  1000, 0, 0, 0);
    await checkBalances(this.token2, 30000, 3333, 0, 0, 0);
    await checkBalances(this.token3, 8,     0,    0, 0, 0);
    await checkWithdrawFailed(this.user1);

    ///////

    await withdrawFromAllTokens(this.user3);
    await checkBalances(this.token1, 6000,  1000, 0, 3000, 0);
    await checkBalances(this.token2, 20001, 3333, 0, 9999, 0);
    await checkBalances(this.token3, 6,     0,    0, 2,    0);
    await checkWithdrawFailed(this.user3);

    ///////

    await this.token1.mint(this.distribution.address, 10000);
    await this.token2.mint(this.distribution.address, 8);
    await this.token3.mint(this.distribution.address, 2);
    await checkBalances(this.token1, 16000, 1000, 0, 3000, 0);
    await checkBalances(this.token2, 20009, 3333, 0, 9999, 0);
    await checkBalances(this.token3, 8,     0,    0, 2,    0);

    ///////

    await withdrawFromAllTokens(this.user4);
    await checkBalances(this.token1, 8000, 1000, 0, 3000, 8000);
    await checkBalances(this.token2, 6673, 3333, 0, 9999, 13336);
    await checkBalances(this.token3, 4,    0,    0, 2,    4);
    await checkWithdrawFailed(this.user4);

    ///////

    await withdrawFromAllTokens(this.user3);
    await checkBalances(this.token1, 5000, 1000, 0, 6000,  8000);
    await checkBalances(this.token2, 6670, 3333, 0, 10002, 13336);
    await checkBalances(this.token3, 3,    0,    0, 3,     4);
    await checkWithdrawFailed(this.user3);

    ///////

    await withdrawFromAllTokens(this.user2);
    await checkBalances(this.token1, 1000, 1000, 4000, 6000,  8000);
    await checkBalances(this.token2, 2,    3333, 6668, 10002, 13336);
    await checkBalances(this.token3, 1,    0,    2,    3,     4);
    await checkWithdrawFailed(this.user2);

    ///////

    await withdrawFromAllTokens(this.user1);
    await checkBalances(this.token1, 0, 2000, 4000, 6000,  8000);
    await checkBalances(this.token2, 1, 3334, 6668, 10002, 13336);
    await checkBalances(this.token3, 0, 1,    2,    3,     4);
    await checkWithdrawFailed(this.user1);
  })
})

async function checkBalances(token, expectedDistributionBalance, expectedBalance1, expectedBalance2, expectedBalance3, expectedBalance4) {
  expect(await token.balanceOf(context.distribution.address)).to.be.equal(expectedDistributionBalance);
  expect(await token.balanceOf(context.user1.address)).to.be.equal(expectedBalance1);
  expect(await token.balanceOf(context.user2.address)).to.be.equal(expectedBalance2);
  expect(await token.balanceOf(context.user3.address)).to.be.equal(expectedBalance3);
  expect(await token.balanceOf(context.user4.address)).to.be.equal(expectedBalance4);

  expect(await context.distribution.rewardsSentToUser(token.address, context.user1.address)).to.be.equal(expectedBalance1);
  expect(await context.distribution.rewardsSentToUser(token.address, context.user2.address)).to.be.equal(expectedBalance2);
  expect(await context.distribution.rewardsSentToUser(token.address, context.user3.address)).to.be.equal(expectedBalance3);
  expect(await context.distribution.rewardsSentToUser(token.address, context.user4.address)).to.be.equal(expectedBalance4);

  expect(await context.distribution.rewardsSent(token.address)).to.be.equal(
      expectedBalance1+expectedBalance2+expectedBalance3+expectedBalance4
  );
}

async function checkWithdrawFailed(user) {
    await expect(
      context.distribution.connect(user).withdrawReward([context.token1.address])
    ).to.be.revertedWith("DISTRIBUTION: NOTHING_TO_WITHDRAW");
    await expect(
      context.distribution.connect(user).withdrawReward([context.token2.address])
    ).to.be.revertedWith("DISTRIBUTION: NOTHING_TO_WITHDRAW");
    await expect(
      context.distribution.connect(user).withdrawReward([context.token3.address])
    ).to.be.revertedWith("DISTRIBUTION: NOTHING_TO_WITHDRAW");
}

async function withdrawFromAllTokens(user) {
    await context.distribution.connect(user).withdrawReward([context.token1.address, context.token3.address]);
    await context.distribution.connect(user).withdrawReward([context.token2.address]);
}
