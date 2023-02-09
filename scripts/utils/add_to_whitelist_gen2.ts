import dotenv from "dotenv";
dotenv.config({
  path: __dirname + "/../../.env",
});

import { ethers, BigNumber } from "ethers";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

import {
  BlockalizerControllerV5,
  BlockalizerV3,
  BlockalizerGenerationV2,
} from "../../artifacts/types";

import { abi as controllerABI } from "../../artifacts/contracts/BlockalizerControllerV5.sol/BlockalizerControllerV5.json";
import { abi as collectionABI } from "../../artifacts/contracts/BlockalizerV3.sol/BlockalizerV3.json";
import { abi as generationABI } from "../../artifacts/contracts/BlockalizerGenerationV2.sol/BlockalizerGenerationV2.json";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "private_key";
const ALCHEMY_GOERLI_API_KEY = process.env.ALCHEMY_GOERLI_API_KEY;
const CONTROLLER_ADDRESS = "0xa83c6a470643416c4001ce01ef0cb94592013b83";
const COLLECTION_ID = BigNumber.from(0);

const network = "goerli";
const provider = new ethers.providers.AlchemyProvider(
  network,
  ALCHEMY_GOERLI_API_KEY
);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const controller = new ethers.Contract(
  CONTROLLER_ADDRESS,
  controllerABI,
  signer
) as BlockalizerControllerV5;

const getContracts = async (): Promise<
  [BlockalizerControllerV5, BlockalizerGenerationV2, BlockalizerV3]
> => {
  // @ts-ignore
  const controller: BlockalizerControllerV5 = new ethers.Contract(
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

async function addMerkleRoot(addresses: Array<string>) {
  const leaves = addresses.map((address) =>
    ethers.utils.solidityKeccak256(["address"], [address])
  );
  const tree = new MerkleTree(leaves, keccak256, { sort: true });
  const root = tree.getHexRoot();
  await controller.setMerkleRoot(root);
}

function getProof(addresses: Array<string>, index: number) {
  const leaves = addresses.map((address) =>
    ethers.utils.solidityKeccak256(["address"], [address])
  );
  const tree = new MerkleTree(leaves, keccak256, { sort: true });
  const proof = tree.getHexProof(leaves[index]);
  return proof;
}

async function holdersAtHeight(height: number = 0) {
  const [controller, generation, collection] = await getContracts();

  let holders = new Map<string, number>();
  const overrides: ethers.CallOverrides = { blockTag: height };
  for (let i = 0; i < 1000; i++) {
    const holder = await collection.ownerOf(BigNumber.from(0), overrides);
    if (holders.has(holder)) {
      const count = holders.get(holder);
      holders.set(holder, count! + 1);
    } else {
      holders.set(holder, 1);
    }
  }
  return holders;
}

async function main() {
  const heightAtMint = 16393603;
  const holdersAtMint = holdersAtHeight(heightAtMint);
  console.log(holdersAtMint);
}

// holders at block height X - whitelisted
// 2 gen1 holders
