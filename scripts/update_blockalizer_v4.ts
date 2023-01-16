import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";

async function main() {
  const ContractFactory = await ethers.getContractFactory(
    "BlockalizerControllerV2"
  );

  // TESTNET

  const address = "0xa83c6a470643416c4001ce01ef0cb94592013b83";

  // MAINNET

  //   const address = "0x6c75d96849f34304A2a1Bd14e047C1A7c40364cd";

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
