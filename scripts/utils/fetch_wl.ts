import dotenv from "dotenv";
dotenv.config({
  path: __dirname + "/../../.env",
});

import { ethers, BigNumber } from "ethers";
import fs from "fs";

import {
  BlockalizerControllerV3,
  BlockalizerV3,
  BlockalizerGenerationV2,
} from "../../artifacts/types";

import { abi as controllerABI } from "../../artifacts/contracts/BlockalizerV4.sol/BlockalizerControllerV2.json";
import { abi as collectionABI } from "../../artifacts/contracts/BlockalizerV3.sol/BlockalizerV3.json";
import { abi as generationABI } from "../../artifacts/contracts/BlockalizerV3.sol/BlockalizerGenerationV2.json";

const gen1_whitelist: Array<string> = require("./whitelist-gen1.json");
const gen2_whitelist_from_gen1: Array<string> = require("./wl_not_minted.json");
const gen1_whitelist_holders: Array<string> = require("./wl_current.json");

const PRIVATE_KEY = process.env.PRIVATE_KEY || "private_key";
const ALCHEMY_MAINNET_API_KEY = process.env.ALCHEMY_MAINNET_API_KEY;
const CONTROLLER_ADDRESS = "0x6c75d96849f34304A2a1Bd14e047C1A7c40364cd";
const COLLECTION_ID = BigNumber.from(0);

const network = "mainnet";
const provider = new ethers.providers.AlchemyProvider(
  network,
  ALCHEMY_MAINNET_API_KEY
);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

const getContracts = async (): Promise<
  [BlockalizerControllerV3, BlockalizerGenerationV2, BlockalizerV3]
> => {
  // @ts-ignore
  const controller: BlockalizerControllerV3 = new ethers.Contract(
    CONTROLLER_ADDRESS,
    controllerABI,
    signer
  );

  const generationContractAddress = await controller.getGeneration();
  // @ts-ignore
  const generation: BlockalizerGenerationV2 = new ethers.Contract(
    generationContractAddress,
    generationABI,
    signer
  );

  const collectionAddress = await controller.getCollection(COLLECTION_ID);

  // @ts-ignore
  const collection: BlockalizerV3 = new ethers.Contract(
    collectionAddress,
    collectionABI,
    signer
  );

  return [controller, generation, collection];
};

async function holdersAtHeight(height: number = 0) {
  const [controller, generation, collection] = await getContracts();

  let holders = new Map<string, number>();
  const overrides: ethers.CallOverrides = { blockTag: height };
  for (let i = 0; i < 1000; i++) {
    const holder = await collection.ownerOf(BigNumber.from(i), overrides);
    console.log(i);
    if (holders.has(holder)) {
      const count = holders.get(holder);
      holders.set(holder, count! + 1);
    } else {
      holders.set(holder, 1);
    }
  }
  return holders;
}

async function whoDidNotMinted() {
  const heightAtMint = 16393603;
  const holdersAtMint = await holdersAtHeight(heightAtMint);
  let new_wl = [];
  for (let i = 0; i < gen1_whitelist.length; i++) {
    const potentialMinter = gen1_whitelist[i];
    if (!holdersAtMint.has(potentialMinter)) {
      new_wl.push(potentialMinter);
    }
  }
  return new_wl;
}

async function holdersOfTwo() {
  const heightNow = 16586410;
  const holdersNow = await holdersAtHeight(heightNow);
  let new_wl: Array<string> = [];
  holdersNow.forEach((count: number, holder: string) => {
    if (count > 1) {
      new_wl.push(holder);
    }
  });
  return new_wl;
}

async function main() {
  //   const wlDidNotMint = await whoDidNotMinted();
  //   await fs.writeFileSync("./wl_not_minted.json", JSON.stringify(wlDidNotMint));
  //   console.log(gen2_whitelist_from_gen1);
  //   console.log(gen2_whitelist_from_gen1.length);
  //   const wlTwoGen1 = await holdersOfTwo();
  //   await fs.writeFileSync("./wl_current.json", JSON.stringify(wlTwoGen1));
  console.log(gen1_whitelist_holders);
  console.log(gen1_whitelist_holders.length);
}

// holders at block height X - whitelisted
// 2 gen1 holders
main();
