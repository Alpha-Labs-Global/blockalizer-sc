import { ethers, BigNumber } from "ethers";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

import {
  BlockalizerControllerV3,
  BlockalizerV3,
  BlockalizerGenerationV2,
} from "../../typechain-types";

const dotenv = require("dotenv");
dotenv.config({ path: __dirname + "/../../.env" });

const controllerABI =
  require("../../artifacts/contracts/BlockalizerV5.sol/BlockalizerControllerV3.json").abi;
const collectionABI =
  require("../../artifacts/contracts/BlockalizerV3.sol/BlockalizerV3.json").abi;
const generationABI =
  require("../../artifacts/contracts/BlockalizerV3.sol/BlockalizerGenerationV2.json").abi;

const PRIVATE_KEY = process.env.PRIVATE_KEY || "private_key";
const ALCHEMY_GOERLI_API_KEY = process.env.ALCHEMY_GOERLI_API_KEY;
const CONTROLLER_ADDRESS = "0xa83c6a470643416c4001ce01ef0cb94592013b83";

const network = "goerli";
const provider = new ethers.providers.AlchemyProvider(
  network,
  ALCHEMY_GOERLI_API_KEY
);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
// @ts-ignore
const controller: BlockalizerControllerV3 = new ethers.Contract(
  CONTROLLER_ADDRESS,
  controllerABI,
  signer
);

async function getCount() {
  const collectionAddress = await controller.getCollection(BigNumber.from(0));
  // @ts-ignore
  const collection: BlockalizerV3 = new ethers.Contract(
    collectionAddress,
    collectionABI,
    signer
  );
  const tokenId = await collection.currentTokenId();
  console.log("Current token ID: ", tokenId.toNumber());
  return tokenId.toNumber();
}

async function isAuthorized(address: string) {
  const upgraderRole = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("UPGRADER_ROLE")
  );
  const role = await controller.hasRole(upgraderRole, address);
  console.log(role);
  return role;
}

async function isLive() {
  const generationAddress = await controller.getGeneration();
  // @ts-ignore
  const generation: BlockalizerGenerationV2 = new ethers.Contract(
    generationAddress,
    generationABI,
    signer
  );
  const gen = (await controller.getGenerationCount()).toNumber();
  const start = new Date((await generation.startTime()).toNumber() * 1000);
  const end = new Date((await generation.expiryTime()).toNumber() * 1000);
  const max = (await generation.maxSupply()).toNumber();
  const count = (await generation.getTokenCount()).toNumber();
  const today = new Date(Date.now());
  console.log(gen, start, end, count, today);
  const live = today > start && today < end && count < max;
  const acceptPreMint = today < end && count < max;
  console.log(live, acceptPreMint);
  return live;
}

async function startNewGeneration() {
  const mintPrice = ethers.utils.parseEther("0.001");
  const maxSupply = BigNumber.from(20);
  const oneWeek = 7 * 24 * 60 * 60;
  const twoDays = 2 * 24 * 60 * 60;
  const now = BigNumber.from(Math.floor(Date.now() / 1000));
  const startTime = now.add(twoDays);
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

async function mintToken() {
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
    // const receipt = await tx.wait();
  } catch (e: any) {
    console.log(e);
  }
}

// addMerkleRoot(whitelisted);
// const proof = getProof(whitelisted, 0);
// preMint(proof);
// isLive();
// isAuthorized(signer.address);
// startNewGeneration();
// mintToken();
getCount();
