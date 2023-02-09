import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades, network } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

import {
  BlockalizerControllerV5,
  BlockalizerGenerationV2,
  BlockalizerV3,
} from "../artifacts/types";

import { getSignature } from "./utils/signature";
import { multiMint } from "./utils/minting";

const _INTERFACE_ID_IERC721 = "0x80ac58cd";

describe("BlockalizerV5", function () {
  let instance: BlockalizerControllerV5;
  let instanceCollection: BlockalizerV3;
  let instanceGeneration: BlockalizerGenerationV2;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let rest: Array<SignerWithAddress>;

  const initialMintPrice = ethers.utils.parseEther("0.01");
  const initialMaxSupply = BigNumber.from(10);
  const initialStartTime = BigNumber.from(Math.floor(Date.now() / 1000)).sub(
    60
  );
  const initialExpiryTime = initialStartTime.add(30 * 60);
  const maxMintsPerWallet = BigNumber.from(5);

  const collectionId = BigNumber.from(0);
  const upgraderRole = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("UPGRADER_ROLE")
  );
  const authorizerRole = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("AUTHORIZER_ROLE")
  );

  async function multiMintHelper(minter: SignerWithAddress, count: number) {
    await multiMint(
      instance,
      instanceCollection,
      minter,
      owner,
      count,
      initialMintPrice
    );
  }

  beforeEach(async function () {
    const ContractFactory = await ethers.getContractFactory(
      "BlockalizerControllerV5"
    );

    //@ts-ignore
    instance = await upgrades.deployProxy(
      ContractFactory,
      [
        initialMintPrice,
        initialMaxSupply,
        initialExpiryTime,
        initialStartTime,
        maxMintsPerWallet,
      ],
      {
        initializer: "initialize",
      }
    );
    await instance.deployed();

    const collectionAddress = await instance.getCollection(collectionId);
    const generationAddress = await instance.getGeneration();

    const childContract1 = await ethers.getContractFactory("BlockalizerV3");
    instanceCollection = childContract1.attach(collectionAddress);

    const childContract2 = await ethers.getContractFactory(
      "BlockalizerGenerationV2"
    );
    instanceGeneration = childContract2.attach(generationAddress);
    [owner, addr1, addr2, ...rest] = await ethers.getSigners();

    instance.grantRole(authorizerRole, owner.address);
  });

  afterEach(async () => {
    await network.provider.request({
      method: "hardhat_reset",
    });
  });

  it("deploys", async function () {
    expect(await instanceCollection.name()).to.equal("Blockalizer:Chroma");
    expect(await instanceCollection.symbol()).to.equal("CHROMA");
    expect(await instanceCollection.totalSupply()).to.equal(0);
    expect(await instanceCollection.supportsInterface(_INTERFACE_ID_IERC721)).to
      .be.true;
    expect(await instance.getGenerationCount()).to.equal(0);
    expect(await instanceGeneration.mintPrice()).to.equal(initialMintPrice);
    expect(await instanceGeneration.maxSupply()).to.equal(initialMaxSupply);
    expect(await instanceGeneration.expiryTime()).to.equal(initialExpiryTime);
    expect(await instanceGeneration.startTime()).to.equal(initialStartTime);
  });

  it("upgrades", async function () {
    const ContractFactory = await ethers.getContractFactory(
      "BlockalizerControllerV5"
    );
    // @ts-ignore
    const secondInstance: BlockalizerControllerV2TestContract =
      await upgrades.upgradeProxy(instance.address, ContractFactory);
    await secondInstance.deployed();

    const collectionAddress = await secondInstance.getCollection(collectionId);
    const generationAddress = await secondInstance.getGeneration();

    expect(collectionAddress).to.equal(instanceCollection.address);
    expect(generationAddress).to.equal(instanceGeneration.address);
    expect(await secondInstance.getGenerationCount()).to.equal(0);
    expect(instance.address).to.equal(secondInstance.address);
  });

  it("has roles set up", async function () {
    expect(await instance.hasRole(upgraderRole, owner.address)).to.be.true;
    expect(await instance.hasRole(authorizerRole, owner.address)).to.be.true;

    const defaultAdminRole = await instance.getRoleAdmin(upgraderRole);
    expect(await instance.hasRole(defaultAdminRole, owner.address)).to.be.true;

    expect(await instance.hasRole(upgraderRole, addr1.address)).to.be.false;
    await instance.grantRole(upgraderRole, addr1.address);
    expect(await instance.hasRole(upgraderRole, addr1.address)).to.be.true;

    await expect(instanceCollection.incrementTokenId()).to.be.revertedWith(
      /Ownable: caller is not the owner/
    );

    expect(await instanceCollection.owner()).to.equal(instance.address);
  });

  it("simple mint with signatures", async function () {
    const mintValue = ethers.utils.parseEther("0.01");
    expect(await instanceGeneration.mintPrice()).to.equal(mintValue);

    const uri = "https://www.example.com/cat.json";
    const uriBytes = ethers.utils.toUtf8Bytes(uri);
    const sig = await getSignature(uriBytes, owner);

    expect(await instanceCollection.totalSupply()).to.equal(0);

    const options = { value: mintValue };
    await expect(instance.connect(addr1).publicMint(uriBytes, sig, options))
      .to.emit(instanceCollection, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 0);

    expect(await instanceCollection.totalSupply()).to.equal(1);
    expect(await instanceCollection.balanceOf(addr1.address)).to.equal(1);
    expect(
      await instanceCollection.tokenOfOwnerByIndex(
        addr1.address,
        BigNumber.from(0)
      )
    ).to.equal(0);
    expect(await instanceCollection.tokenURI(BigNumber.from(0))).to.equal(uri);

    // signed with wrong signature
    const wrongSig = await getSignature(uriBytes, addr1);
    await expect(
      instance.publicMint(uriBytes, wrongSig, options)
    ).to.be.revertedWithCustomError(instance, "MintNotAllowed");

    // signature used again
    await expect(
      instance.publicMint(uriBytes, sig, options)
    ).to.be.revertedWithCustomError(instance, "MintNotAllowed");

    // not enough ether
    const wrongMintValue = ethers.utils.parseEther("0.009");
    const sig2 = await getSignature(uriBytes, owner);
    await expect(instance.publicMint(uriBytes, sig2, { value: wrongMintValue }))
      .to.be.revertedWithCustomError(instance, "PaymentDeficit")
      .withArgs(wrongMintValue, mintValue);
  });

  it("multiple mint with signatures", async function () {
    let tokenId;
    const mintValue = ethers.utils.parseEther("0.01");
    expect(await instanceGeneration.mintPrice()).to.equal(mintValue);

    const uri1 = "https://www.example.com/cat.json";
    const uriBytes1 = ethers.utils.toUtf8Bytes(uri1);

    const uri2 = "https://www.example.com/dog.json";
    const uriBytes2 = ethers.utils.toUtf8Bytes(uri2);

    const uri3 = "https://www.example.com/mouse.json";
    const uriBytes3 = ethers.utils.toUtf8Bytes(uri3);

    expect(await instanceCollection.totalSupply()).to.equal(0);

    const options = { value: mintValue };
    const sig1 = await getSignature(uriBytes1, owner);
    await expect(instance.connect(addr1).publicMint(uriBytes1, sig1, options))
      .to.emit(instanceCollection, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 0);

    const sig2 = await getSignature(uriBytes2, owner);
    await expect(instance.connect(addr1).publicMint(uriBytes2, sig2, options))
      .to.emit(instanceCollection, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1);

    const sig3 = await getSignature(uriBytes3, owner);
    await expect(instance.connect(addr1).publicMint(uriBytes3, sig3, options))
      .to.emit(instanceCollection, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 2);

    expect(await instanceCollection.totalSupply()).to.equal(3);
    expect(await instanceCollection.balanceOf(addr1.address)).to.equal(3);

    expect(
      await instanceCollection.tokenOfOwnerByIndex(
        addr1.address,
        BigNumber.from(0)
      )
    ).to.equal(0);
    expect(await instanceCollection.tokenURI(BigNumber.from(0))).to.equal(uri1);
    expect(
      await instanceCollection.tokenOfOwnerByIndex(
        addr1.address,
        BigNumber.from(1)
      )
    ).to.equal(1);
    expect(await instanceCollection.tokenURI(BigNumber.from(1))).to.equal(uri2);
    expect(
      await instanceCollection.tokenOfOwnerByIndex(
        addr1.address,
        BigNumber.from(2)
      )
    ).to.equal(2);
    expect(await instanceCollection.tokenURI(BigNumber.from(2))).to.equal(uri3);
  });

  it("withdraws funds", async function () {
    const mintValue = ethers.utils.parseEther("0.01");

    await multiMint(instance, instanceCollection, owner, owner, 4, mintValue);
    await multiMint(instance, instanceCollection, addr1, owner, 4, mintValue);
    await multiMint(instance, instanceCollection, addr2, owner, 2, mintValue);

    const contractBalance = ethers.utils.parseEther("0.1");
    expect(await ethers.provider.getBalance(instance.address)).to.be.equal(
      contractBalance
    );

    await expect(instance.connect(addr1).withdrawAll()).to.be.revertedWith(
      `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${upgraderRole.toLowerCase()}`
    );

    await instance.withdrawAll();
    const updatedBalance = ethers.utils.parseEther("0");
    expect(await ethers.provider.getBalance(instance.address)).to.be.equal(
      updatedBalance
    );
  });

  it("advancing generations", async function () {
    expect(await instanceGeneration.maxSupply()).to.equal(initialMaxSupply);

    const mintValue = ethers.utils.parseEther("0.01");
    const uri = "https://www.example.com/cat.json";
    const options = { value: mintValue };

    await multiMintHelper(owner, 5);

    const uriBytes = ethers.utils.toUtf8Bytes(uri);
    const sig = await getSignature(uriBytes, owner);
    await expect(
      instance.publicMint(uriBytes, sig, options)
    ).to.be.revertedWithCustomError(instance, "UserMaxMinted");

    await multiMintHelper(addr1, 3);
    await multiMintHelper(addr2, 2);

    const newMaxSupply = BigNumber.from(5);
    const falseExpiryTime = initialStartTime.sub(60);
    await expect(
      instance.startGeneration(
        initialMintPrice,
        newMaxSupply,
        falseExpiryTime,
        initialStartTime,
        maxMintsPerWallet
      )
    ).to.be.revertedWithCustomError(instance, "InvalidGeneration");

    const oneMonthInSeconds = 60 * 24 * 60 * 60;
    const oneHour = 60 * 60;
    const newStartTime = BigNumber.from(Math.floor(Date.now() / 1000)).add(
      oneHour
    );
    const newExpiryTime = newStartTime.add(oneMonthInSeconds);
    await instance.startGeneration(
      initialMintPrice,
      newMaxSupply,
      newExpiryTime,
      newStartTime,
      maxMintsPerWallet
    );
    const newAddress = await instance.getGeneration();
    const newChild = await ethers.getContractFactory("BlockalizerGeneration");
    //@ts-ignore
    const newInstanceChild: BlockalizerGenerationV2 = await newChild.attach(
      newAddress
    );

    expect(await newInstanceChild.maxSupply()).to.equal(newMaxSupply);
    expect(await newInstanceChild.expiryTime()).to.equal(newExpiryTime);

    await expect(
      instance.publicMint(uriBytes, sig, options)
    ).to.be.revertedWithCustomError(instance, "MintNotLive");

    await time.increase(oneHour * 2);
    const uriBytes2 = ethers.utils.toUtf8Bytes(uri);
    const sig2 = await getSignature(uriBytes2, owner);
    await instance.publicMint(uriBytes2, sig2, options);
    expect(await instanceCollection.totalSupply()).to.equal(11);

    const uriBytes3 = ethers.utils.toUtf8Bytes(uri);
    const sig3 = await getSignature(uriBytes3, owner);
    await time.increase(oneMonthInSeconds * 2);
    await expect(
      instance.publicMint(uriBytes3, sig3, options)
    ).to.be.revertedWithCustomError(instance, "MintNotLive");
  });

  it("adds people to whitelist", async function () {
    const zero = ethers.utils.hexZeroPad("0x00", 32);
    expect(await instance.merkleRoot()).to.equal(zero);

    // mint first generation
    await multiMintHelper(owner, 5);
    await multiMintHelper(addr1, 3);
    await multiMintHelper(addr2, 2);

    // start second generation
    const oneMonthInSeconds = 60 * 24 * 60 * 60;
    const oneHour = 60 * 60;
    const startTime = BigNumber.from(Math.floor(Date.now() / 1000)).add(
      oneHour
    );
    const expiryTime = startTime.add(oneMonthInSeconds);
    const maxSupply = BigNumber.from(5);
    const maxMints = BigNumber.from(2);
    await instance.startGeneration(
      initialMintPrice,
      maxSupply,
      expiryTime,
      startTime,
      maxMints
    );

    // create merkletree and add to whitelist
    const addresses = [addr2, ...rest].map(({ address }) => address);
    const leaves = addresses.map((address) =>
      ethers.utils.solidityKeccak256(["address"], [address])
    );
    const tree = new MerkleTree(leaves, keccak256, { sort: true });
    const root = tree.getHexRoot();
    await instance.setMerkleRoot(root);
    expect(await instance.merkleRoot()).to.not.equal(zero);

    // check if whitelist can mint
    const proof = tree.getHexProof(leaves[0]);
    const mintValue = ethers.utils.parseEther("0.01");
    const uri = "https://www.example.com/cat.json";
    const options = { value: mintValue };
    const uriBytes = ethers.utils.toUtf8Bytes(uri);
    const sig = await getSignature(uriBytes, owner);
    await instance.connect(addr2).preMint(uriBytes, sig, proof, options);
    expect(await instanceCollection.totalSupply()).to.equal(11);

    // check non-whitelist can't mint
    await expect(
      instance.connect(addr1).publicMint(uriBytes, sig, options)
    ).to.be.revertedWithCustomError(instance, "MintNotLive");
  });

  it("updates token URI", async function () {
    await multiMintHelper(owner, 5);
    await multiMintHelper(addr1, 3);
    await multiMintHelper(addr2, 2);

    const randomTokenId = 4;
    const uri = "https://www.example.com/cat.json";

    await expect(
      instanceCollection.tokenURI(randomTokenId)
    ).eventually.to.not.equal(uri);

    await instance.setTokenURI(
      BigNumber.from(0),
      BigNumber.from(randomTokenId),
      uri
    );

    await expect(
      instanceCollection.tokenURI(randomTokenId)
    ).eventually.to.equal(uri);
  });
});
