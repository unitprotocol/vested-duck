const { BigNumber } = require("ethers");
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { ethers } = require('hardhat');

const { expect } = chai;

const DAY = 86400
const WEEK = 7 * DAY

let veDuck, usdp, veDistribution, duck
let VeDuckFactory, VeDistributionFactory, TestTokenFactory
let admin, alice, bob, charlie

describe("veDistribution", function() {

  before(async function () {
    [admin, alice, bob, charlie] = await ethers.getSigners();
    TestTokenFactory = await ethers.getContractFactory("TestToken")

    VeDuckFactory = await ethers.getContractFactory("veDuck")
    VeDistributionFactory = await ethers.getContractFactory("veDistribution")
  })

  beforeEach(async function () {
    const startTime = (await ethers.provider.getBlock('latest')).timestamp
    duck = await TestTokenFactory.deploy()
    usdp = await TestTokenFactory.deploy()
    veDuck = await VeDuckFactory.deploy(duck.address, "veDuck", "veDuck", '1.0.0')
    veDistribution = await VeDistributionFactory.deploy(veDuck.address, startTime, usdp.address, admin.address, admin.address);
  })

  it("deposits after", async function() {
    const amount = 1000n * 10n ** 18n

    await usdp.mint(bob.address, 100n * 10n ** 18n)

    for (let i = 0; i < 35; i++) {
      await usdp.connect(bob).transfer(veDistribution.address, 10n ** 18n)
      await veDistribution.checkpoint_token()
      await veDistribution.checkpoint_total_supply()
      await ethers.provider.send('evm_mine', [await chainTime() + DAY])
    }

    await ethers.provider.send('evm_mine', [await chainTime() + WEEK])

    await duck.mint(alice.address, amount * 10n)
    await duck.connect(alice).approve(veDuck.address, amount * 10n)
    await veDuck.connect(alice).create_lock(amount, await chainTime() + 3 * WEEK)

    await ethers.provider.send('evm_mine', [await chainTime() + 2 * WEEK])

    await veDistribution.connect(alice)['claim()']()

    expect(await usdp.balanceOf(alice.address)).to.be.equal(BigNumber.from(0))
  });

  it("deposits during", async function() {
    const amount = 1000n * 10n ** 18n

    await duck.mint(alice.address, amount * 10n)
    await duck.connect(alice).approve(veDuck.address, amount * 10n)
    await veDuck.connect(alice).create_lock(amount, await chainTime() + 8 * WEEK)
    await ethers.provider.send('evm_mine', [await chainTime() + WEEK])

    await usdp.mint(bob.address, 100n * 10n ** 18n)

    veDistribution = await VeDistributionFactory.deploy(veDuck.address, await chainTime(), usdp.address, admin.address, admin.address)

    for (let i = 0; i < 21; i++) {
      await usdp.connect(bob).transfer(veDistribution.address, 10n ** 18n)
      await veDistribution.checkpoint_token()
      await veDistribution.checkpoint_total_supply()
      await ethers.provider.send('evm_mine', [await chainTime() + DAY])
    }

    await ethers.provider.send('evm_mine', [await chainTime() + WEEK])
    await veDistribution.checkpoint_token()

    await veDistribution.connect(alice)['claim()']()

    expect(await usdp.balanceOf(alice.address)).to.be.closeTo(BigNumber.from(21n * 10n ** 18n), 10n)
  })

  it("deposits before", async function() {
    const amount = 1000n * 10n ** 18n

    await duck.mint(alice.address, amount)

    await duck.connect(alice).approve(veDuck.address, amount)
    await usdp.mint(bob.address, 100n * 10n ** 18n)

    await veDuck.connect(alice).create_lock(amount, await chainTime() + 8 * WEEK)

    await ethers.provider.send('evm_mine', [await chainTime() + WEEK])
    const startTime = await chainTime()

    await ethers.provider.send('evm_mine', [startTime + 5 * WEEK])

    veDistribution = await VeDistributionFactory.deploy(veDuck.address, startTime, usdp.address, admin.address, admin.address)

    const distributionAmount = 10n ** 19n
    await usdp.connect(bob).transfer(veDistribution.address, distributionAmount)

    await veDistribution.checkpoint_token()
    await ethers.provider.send('evm_mine', [await chainTime() + WEEK])
    await veDistribution.checkpoint_token()

    await veDistribution.connect(alice)['claim()']()

    expect(await usdp.balanceOf(alice.address)).to.be.closeTo(BigNumber.from(distributionAmount), 10n)
  })

  it("deposits twice", async function() {
    const amount = 1000n * 10n ** 18n

    await duck.mint(alice.address, amount)

    await duck.connect(alice).approve(veDuck.address, amount * 2n)
    await usdp.mint(bob.address, 100n * 10n ** 18n)

    await veDuck.connect(alice).create_lock(amount, await chainTime() + 4 * WEEK)
    await ethers.provider.send('evm_mine', [await chainTime() + WEEK])

    const startTime = await chainTime()
    await ethers.provider.send('evm_mine', [await chainTime() + 3 * WEEK])

    await veDuck.connect(alice).withdraw()

    const excludeTime = Math.floor(Math.floor(await chainTime() / WEEK) * WEEK) // Alice had 0 here
    await veDuck.connect(alice).create_lock(amount, await chainTime() + 4 * WEEK)

    await ethers.provider.send('evm_mine', [await chainTime() + 2 * WEEK])

    veDistribution = await VeDistributionFactory.deploy(veDuck.address, startTime, usdp.address, admin.address, admin.address)

    const distributionAmount = 10n ** 19n
    await usdp.connect(bob).transfer(veDistribution.address, distributionAmount)

    await veDistribution.checkpoint_token()

    await ethers.provider.send('evm_mine', [await chainTime() + WEEK])
    await veDistribution.checkpoint_token()
    await veDistribution.connect(alice)['claim()']()

    const excludedReward = await veDistribution.tokens_per_week(excludeTime)

    expect((await usdp.balanceOf(alice.address)).add(excludedReward)).to.be.closeTo(BigNumber.from(distributionAmount), 10n)
  })

  it("deposits parallel", async function() {
    const amount = 1000n * 10n ** 18n

    await duck.mint(alice.address, amount)
    await duck.mint(bob.address, amount)

    await duck.connect(alice).approve(veDuck.address, amount)
    await duck.connect(bob).approve(veDuck.address, amount)

    await usdp.mint(charlie.address, 100n * 10n ** 18n)

    await veDuck.connect(alice).create_lock(amount, await chainTime() + 8 * WEEK)
    await veDuck.connect(bob).create_lock(amount, await chainTime() + 8 * WEEK)

    await ethers.provider.send('evm_mine', [await chainTime() + WEEK])

    const startTime = await chainTime()
    await ethers.provider.send('evm_mine', [await chainTime() + 5 * WEEK])

    veDistribution = await VeDistributionFactory.deploy(veDuck.address, startTime, usdp.address, admin.address, admin.address)

    const distributionAmount = 10n ** 19n
    await usdp.connect(charlie).transfer(veDistribution.address, distributionAmount)

    await veDistribution.checkpoint_token()

    await ethers.provider.send('evm_mine', [await chainTime() + WEEK])
    await veDistribution.checkpoint_token()

    await veDistribution.connect(alice)['claim()']()
    await veDistribution.connect(bob)['claim()']()

    const balanceAlice = await usdp.balanceOf(alice.address)
    const balanceBob = await usdp.balanceOf(bob.address)

    expect(balanceAlice.add(balanceBob)).to.be.closeTo(BigNumber.from(distributionAmount), 10n)
  })
})

const chainTime = async () => (await ethers.provider.getBlock('latest')).timestamp
