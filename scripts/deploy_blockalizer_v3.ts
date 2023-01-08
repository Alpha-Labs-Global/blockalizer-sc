import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";

async function main() {
  const ContractFactory = await ethers.getContractFactory(
    "BlockalizerController"
  );

  const mintPrice = ethers.utils.parseEther("0.015");
  const maxSupply = BigNumber.from(1000);
  const startTime = BigNumber.from(Math.floor(Date.now() / 1000));
  const expiryTime = startTime.add(30 * 24 * 60 * 60);
  const maxMintsPerWallet = BigNumber.from(3);

  const instance = await upgrades.deployProxy(
    ContractFactory,
    [mintPrice, maxSupply, expiryTime, startTime, maxMintsPerWallet],
    {
      initializer: "initialize",
    }
  );

  await instance.deployed();

  console.log("Blockalizer deployed to:", instance.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
