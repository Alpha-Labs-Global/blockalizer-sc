const ethers = require("ethers");

const BigNumber = ethers.BigNumber;

const dotenv = require("dotenv");
dotenv.config({ path: __dirname + "/../.env" });

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const CONTROLLER_ADDRESS = "0xa83c6a470643416c4001ce01ef0cb94592013b83";
const ABI =
  require("../artifacts/contracts/BlockalizerV3.sol/BlockalizerController.json").abi;

const mintPrice = ethers.utils.parseEther("0.001");
const maxSupply = BigNumber.from(100);
const startTime = BigNumber.from(Math.floor(Date.now() / 1000));
const expiryTime = startTime.add(3 * 24 * 60 * 60);
const maxMintsPerWallet = BigNumber.from(25);

const network = "goerli";
const provider = new ethers.providers.AlchemyProvider(network, ALCHEMY_API_KEY);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const Controller = new ethers.Contract(CONTROLLER_ADDRESS, ABI, signer);

async function display() {
  console.log("mintPrice: ", mintPrice.toHexString());
  console.log("maxSupply: ", maxSupply.toHexString());
  console.log("expiryTime: ", expiryTime.toHexString());
  console.log("maxMintsPerWallet: ", maxMintsPerWallet.toHexString());
}

async function startGeneration() {
  const g = await Controller.startGeneration(
    mintPrice,
    maxSupply,
    startTime,
    expiryTime,
    maxMintsPerWallet
  );
  console.log(g);
}

async function fetchGeneration() {
  const g = await Controller.getGenerationCount();
  console.log(g);
}

async function fetchCollection() {
  const g = await Controller.getCollection(BigNumber.from(0));
  console.log(g);
}

// display();

fetchCollection();
