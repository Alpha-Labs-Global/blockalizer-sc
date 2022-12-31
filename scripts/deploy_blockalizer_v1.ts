import { ethers, upgrades } from "hardhat";

async function main() {
  const ContractFactory = await ethers.getContractFactory("Blockalizer");

  const instance = await upgrades.deployProxy(ContractFactory, [], {
    initializer: "initialize",
  });

  await instance.deployed();

  console.log("Blockalizer deployed to:", instance.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
