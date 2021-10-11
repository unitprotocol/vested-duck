// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const {ethers} = require("hardhat");

const duckAddress = "0x92E187a03B6CD19CB6AF293ba17F2745Fd2357D5"
const usdpAddress = "0x1456688345527bE1f37E9e627DA0837D6f08C925"

async function main() {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    await hre.run('compile');

    const admin = (await ethers.getSigners())[0].address

    // We get the contract to deploy
    const veDuckFactory = await hre.ethers.getContractFactory("veDuck");
    const veDuck = await veDuckFactory.deploy(duckAddress, "veDuck", "veDuck", '1.0.0');
    await veDuck.deployed();

    console.log("veDUCK deployed to:", veDuck.address);

    const veDistributionFactory = await hre.ethers.getContractFactory("veDistribution");
    const startTime = Math.floor(new Date().getTime() / 1000);
    const veDistribution = await veDistributionFactory.deploy(veDuck.address, startTime, usdpAddress, admin, admin);
    await veDistribution.deployed();

    console.log("veDistribution deployed to:", veDistribution.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
