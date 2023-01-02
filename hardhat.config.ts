import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

const dotenv = require("dotenv");
dotenv.config({ path: __dirname + "/.env" });

const TEST_PRIVATE_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";

const PRIVATE_KEY = process.env.PRIVATE_KEY || TEST_PRIVATE_KEY;
const ALCHEMY_GOERLI_HTTPS =
  process.env.ALCHEMY_GOERLI_HTTPS || "alchemy_goerli_https";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "etherscan_api_key";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    goerli: {
      url: ALCHEMY_GOERLI_HTTPS,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};

export default config;
