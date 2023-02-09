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

async function getCount() {
  const collectionAddress = await controller.getCollection(BigNumber.from(0));
  const collection = new ethers.Contract(
    collectionAddress,
    collectionABI,
    signer
  ) as BlockalizerV3;
  const tokenId = await collection.currentTokenId();
  console.log("Current token ID: ", tokenId.toNumber());
  return tokenId.toNumber();
}

export async function isAuthorized(address: string) {
  const upgraderRole = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("UPGRADER_ROLE")
  );
  const role = await controller.hasRole(upgraderRole, address);
  console.log(role);
  return role;
}

export async function isLive() {
  const generationAddress = await controller.getGeneration();
  const generation = new ethers.Contract(
    generationAddress,
    generationABI,
    signer
  ) as BlockalizerGenerationV2;
  const gen = (await controller.getGenerationCount()).toNumber();
  const start = new Date((await generation.startTime()).toNumber() * 1000);
  const end = new Date((await generation.expiryTime()).toNumber() * 1000);
  const max = (await generation.maxSupply()).toNumber();
  const count = (await generation.getTokenCount()).toNumber();
  const today = new Date(Date.now());
  console.log("Generation: ", gen);
  console.log("Start Time: ", start);
  console.log("End time: ", end);
  console.log("Minted so far: ", count);
  const live = today > start && today < end && count < max;
  const acceptPreMint = today < end && count < max;
  console.log("Pre-mint: ", acceptPreMint);
  console.log("Public mint: ", live);
  return live;
}

export async function startNewGeneration() {
  const mintPrice = ethers.utils.parseEther("0.001");
  const maxSupply = BigNumber.from(100);
  const oneWeek = 7 * 24 * 60 * 60;
  const twoDays = 2 * 24 * 60 * 60;
  const now = BigNumber.from(Math.floor(Date.now() / 1000));
  const startTime = now;
  const expiryTime = now.add(oneWeek);
  const maxMintsPerWallet = BigNumber.from(5);
  await controller.startGeneration(
    mintPrice,
    maxSupply,
    expiryTime,
    startTime,
    maxMintsPerWallet
  );
}

export async function mintToken() {
  const uri =
    "https://gateway.pinata.cloud/ipfs/QmQa26WBRsGpUpyJcY2k9ygo7SfvUEpGuwJSp8LJQmVeYm";
  const uriBytes = ethers.utils.toUtf8Bytes(uri);
  const tokenId = await getCount();
  const messageHash = ethers.utils.solidityKeccak256(
    ["bytes", "uint256"],
    [uriBytes, tokenId]
  );
  const messageHashBinary = ethers.utils.arrayify(messageHash);
  const sig = await signer.signMessage(messageHashBinary);
  const mintPrice = ethers.utils.parseEther("0.015");
  const options = { value: mintPrice, gasLimit: 100000 };
  try {
    const tx = await controller.publicMint(uriBytes, sig, options);
    const receipt = await tx.wait();
    console.log(receipt);
  } catch (e: any) {
    console.log(e);
  }
}

export async function addMerkleRoot(addresses: Array<string>) {
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

function decodeErrorName(e: any): string {
  if (e.code == "UNPREDICTABLE_GAS_LIMIT") {
    const errorId = e.error.error.error.data.slice(0, 10);
    for (const [signature, errorFragment] of Object.entries(
      controller.interface.errors
    )) {
      const customErrorId = ethers.utils.id(signature).slice(0, 10);
      if (errorId == customErrorId) return errorFragment.name;
    }
  }
  return e.code;
}

// gen1: 0x6Ad177F26b0a46a4cBc3Fc50C3dDfe69CaDb1009

const whitelisted = [
  "0xB2D17c014D9a5BC9De4aDCc656e1a3B3b608238D", // blockalizer
  "0xe1EBc6DB1cfE34b4cAed238dD5f59956335E2998", // uneeb 1
  "0xBb6f397d9d8bf128dDa607005397F539B43CD710", // uneeb 2
];

async function preMint(proof: string[]) {
  // await instance.connect(addr2).preMint(uriBytes, sig, proof, options);
  const uri =
    "https://gateway.pinata.cloud/ipfs/QmciZDSTESJFiTPpLt1nBtt6kqDUWrTzd9Xv6TXg38kmSa";
  const uriBytes = ethers.utils.toUtf8Bytes(uri);
  const tokenId = await getCount();
  const messageHash = ethers.utils.solidityKeccak256(
    ["bytes", "uint256"],
    [uriBytes, tokenId]
  );
  const messageHashBinary = ethers.utils.arrayify(messageHash);
  const sig = await signer.signMessage(messageHashBinary);
  const mintPrice = ethers.utils.parseEther("0.001");
  const options = { value: mintPrice };
  try {
    const tx = await controller.preMint(uriBytes, sig, proof, options);
    console.log("transaction");
    const receipt = await tx.wait();
    console.log("receipt");
  } catch (e: any) {
    const errorName = decodeErrorName(e);
    console.log(errorName);

    // console.log(controller.interface.errors);
    // controller.interface.decodeErrorResult
    // const x = controller.interface.decodeErrorResult();
    // console.log(x);
  }
}

// addMerkleRoot(whitelisted);
// const proof = getProof(whitelisted, 0);
// preMint(proof);
isLive();
// isAuthorized(signer.address);
// startNewGeneration();
// mintToken();
// getCount();
