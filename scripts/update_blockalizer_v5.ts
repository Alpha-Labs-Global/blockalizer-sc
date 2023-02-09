import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";

async function main() {
  const ContractFactory = await ethers.getContractFactory(
    "BlockalizerControllerV5"
  );

  // TESTNET

  const address = "0xa83c6a470643416c4001ce01ef0cb94592013b83";
  // const deployment = await upgrades.forceImport(address, ContractFactory);

  // await deployment.deployed();
  // console.log("Blockalizer deployed to:", deployment.address);

  const instance = await upgrades.upgradeProxy(address, ContractFactory);
  await instance.deployed();

  console.log("Blockalizer deployed to:", instance.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
