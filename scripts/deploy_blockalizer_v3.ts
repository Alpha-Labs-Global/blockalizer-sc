import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";

async function main() {
  const ContractFactory = await ethers.getContractFactory(
    "BlockalizerController"
  );

  // TESTNET
  // const mintPrice = ethers.utils.parseEther("0.001");
  // const maxSupply = BigNumber.from(50);
  // const timeNow = BigNumber.from(Math.floor(Date.now() / 1000));
  // const startTime = timeNow.add(15 * 60);
  // const expiryTime = startTime.add(1 * 60 * 60);
  // const maxMintsPerWallet = BigNumber.from(15);

  // MAINNET
  const mintPrice = ethers.utils.parseEther("0.015");
  const maxSupply = BigNumber.from(1000);
  const timeNow = BigNumber.from(Math.floor(Date.now() / 1000));
  const startTime = timeNow.add(24 * 60 * 60);
  const expiryTime = BigNumber.from(
    Math.floor(new Date("2023-02-01").valueOf() / 1000)
  );
  const maxMintsPerWallet = BigNumber.from(2);

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
