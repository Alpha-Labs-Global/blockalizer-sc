import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

export async function getSignature(
  owner: SignerWithAddress,
  uriBytes: Uint8Array,
): Promise<string> {
  const messageHash = ethers.utils.solidityKeccak256(
    ["bytes"],
    [uriBytes]
  );
  const messageHashBinary = ethers.utils.arrayify(messageHash);
  return await owner.signMessage(messageHashBinary);
}
