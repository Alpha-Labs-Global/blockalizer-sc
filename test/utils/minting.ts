import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { BlockalizerControllerV3, BlockalizerV3 } from "../../artifacts/types";
import { BigNumber } from "ethers";

import { getSignature } from "./signature";

export async function multiMint(
  controller: BlockalizerControllerV3,
  collection: BlockalizerV3,
  minter: SignerWithAddress,
  owner: SignerWithAddress,
  count: number,
  mintValue: BigNumber
) {
  let tokenId;
  const options = { value: mintValue };
  for (let i = 0; i < count; i++) {
    const uri = randomUri();
    const uriBytes = ethers.utils.toUtf8Bytes(uri);

    tokenId = (await collection.currentTokenId()).toNumber();
    const sig3 = await getSignature(owner, uriBytes);
    await controller.connect(minter).publicMint(uriBytes, sig3, options);
  }
}

function makeid(length: number) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

function randomUri() {
  return `https://www.example.com/${makeid(10)}.json`;
}
