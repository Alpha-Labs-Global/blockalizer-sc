import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

export async function getSignature(
  uriBytes: Uint8Array,
  tokenId: number,
  owner: SignerWithAddress
): Promise<string> {
  const messageHash = ethers.utils.solidityKeccak256(
    ["bytes", "uint256"],
    [uriBytes, tokenId]
  );
  const messageHashBinary = ethers.utils.arrayify(messageHash);
  return await owner.signMessage(messageHashBinary);
}
