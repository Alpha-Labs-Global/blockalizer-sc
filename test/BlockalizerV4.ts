import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";

interface PayableOptions {
  value: BigNumber;
}

interface BlockalizerV3Contract {
  currentTokenId(): BigNumber;
  incrementTokenId(): void;
  setTokenURI(tokenId: BigNumber, uri: string): void;
  safeMint(to: string, tokenId: BigNumber): void;

  name(): string;
  symbol(): string;
  balanceOf(address: string): BigNumber;
  totalSupply(): BigNumber;
  tokenOfOwnerByIndex(address: string, index: BigNumber): BigNumber;
  tokenURI(tokenId: BigNumber): string;

  owner(): string;
  supportsInterface(interface_id: string): boolean;
}

interface BlockalizerGenerationV2Contract {
  mintPrice(): BigNumber;
  maxSupply(): BigNumber;
  expiryTime(): BigNumber;
  startTime(): BigNumber;
  owner(): string;
  incrementTokenCount(address: string): void;
}

interface BlockalizerV2Controller {
  getCollection(collectionId: BigNumber): string;
  getGenerationCount(): BigNumber;
  getGeneration(): string;
  startGeneration(
    _mintPrice: BigNumber,
    _maxSupply: BigNumber,
    _expiryTime: BigNumber,
    _startTime: BigNumber,
    _maxMintPerWallet: BigNumber
  ): string;
  publicMint(
    collectionId: BigNumber,
    uri: string,
    options: PayableOptions
  ): void;
  addToWhitelist(addresses: string[]): void;
  isInWhitelist(address: string): boolean;
  withdraw(amount: BigNumber): void;
  withdrawAll(): void;
  setTokenURI(
    _collectionId: BigNumber,
    _tokenId: BigNumber,
    _uri: string
  ): void;

  hasRole(role: string, address: string): boolean;
  getRoleAdmin(role: string): string;
  grantRole(role: string, address: string): void;
}

interface BlockalizerV3TestContract extends BlockalizerV3Contract {
  address: string;
}

interface BlockalizerGenerationV2TestContract
  extends BlockalizerGenerationV2Contract {
  address: string;
}

interface BlockalizerControllerV2TestContract extends BlockalizerV2Controller {
  address: string;

  connect(address: SignerWithAddress): BlockalizerV2Controller;
  deployed(): void;
}

const _INTERFACE_ID_IERC721 = "0x80ac58cd";

describe("BlockalizerV4", function () {
  let firstInstance: any;
  let instanceCollection: BlockalizerV3TestContract;
  let instanceGeneration: BlockalizerGenerationV2TestContract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

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

  beforeEach(async function () {
    const ContractFactory = await ethers.getContractFactory(
      "BlockalizerController"
    );

    //@ts-ignore
    firstInstance = await upgrades.deployProxy(
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
    //@ts-ignore
    await firstInstance.deployed();

    const collectionAddress = await firstInstance.getCollection(collectionId);
    const generationAddress = await firstInstance.getGeneration();

    const childContract1 = await ethers.getContractFactory("BlockalizerV3");
    //@ts-ignore
    instanceCollection = await childContract1.attach(collectionAddress);

    const childContract2 = await ethers.getContractFactory(
      "BlockalizerGenerationV2"
    );
    //@ts-ignore
    instanceGeneration = await childContract2.attach(generationAddress);

    [owner, addr1, addr2] = await ethers.getSigners();
  });

  it("deploys", async function () {
    expect(await instanceCollection.name()).to.equal("Blockalizer:Chroma");
    expect(await instanceCollection.symbol()).to.equal("CHROMA");
    expect(await instanceCollection.totalSupply()).to.equal(0);
    expect(await instanceCollection.supportsInterface(_INTERFACE_ID_IERC721)).to
      .be.true;
    expect(await firstInstance.getGenerationCount()).to.equal(0);
    expect(await instanceGeneration.mintPrice()).to.equal(initialMintPrice);
    expect(await instanceGeneration.maxSupply()).to.equal(initialMaxSupply);
    expect(await instanceGeneration.expiryTime()).to.equal(initialExpiryTime);
    expect(await instanceGeneration.startTime()).to.equal(initialStartTime);
  });

  it("upgrades", async function () {
    const ContractFactory = await ethers.getContractFactory(
      "BlockalizerControllerV2"
    );
    // @ts-ignore
    const secondInstance: BlockalizerControllerV2TestContract =
      await upgrades.upgradeProxy(firstInstance.address, ContractFactory);
    await secondInstance.deployed();

    const collectionAddress = await secondInstance.getCollection(collectionId);
    const generationAddress = await secondInstance.getGeneration();

    expect(collectionAddress).to.equal(instanceCollection.address);
    expect(generationAddress).to.equal(instanceGeneration.address);
    expect(await secondInstance.getGenerationCount()).to.equal(0);
    expect(firstInstance.address).to.equal(secondInstance.address);
  });

  it("updates token URI", async function () {
    // mint all of all
    // check can't mint more
    const mintValue = ethers.utils.parseEther("0.01");
    const options = { value: mintValue };
    const uri = "https://www.example.com/cat.json";
    for (let i = 0; i < 5; i++) {
      await firstInstance.publicMint(collectionId, uri, options);
    }
    await expect(
      firstInstance.publicMint(collectionId, uri, options)
    ).to.be.revertedWith(
      /User has already minted max tokens in this generation/
    );
    for (let i = 0; i < 5; i++) {
      await firstInstance.connect(addr1).publicMint(collectionId, uri, options);
    }
    await expect(
      firstInstance.connect(addr2).publicMint(collectionId, uri, options)
    ).to.be.revertedWith(/All NFTs in this generation have been minted/);

    const ContractFactory = await ethers.getContractFactory(
      "BlockalizerControllerV2"
    );
    // @ts-ignore
    const secondInstance: BlockalizerControllerV2TestContract =
      await upgrades.upgradeProxy(firstInstance.address, ContractFactory);
    await secondInstance.deployed();

    const randomTokenId = BigNumber.from(4);
    expect(await instanceCollection.tokenURI(randomTokenId)).to.equal(uri);

    const newURI = "https://www.example.com/cat.json";
    await secondInstance.setTokenURI(collectionId, randomTokenId, newURI);

    expect(await instanceCollection.tokenURI(randomTokenId)).to.equal(newURI);
    await expect(
      firstInstance.connect(addr2).publicMint(collectionId, uri, options)
    ).to.be.revertedWith(/All NFTs in this generation have been minted/);

    const anotherRandomTokenId = BigNumber.from(6);
    await expect(
      secondInstance
        .connect(addr2)
        .setTokenURI(collectionId, anotherRandomTokenId, newURI)
    ).to.be.revertedWith(
      `AccessControl: account ${addr2.address.toLowerCase()} is missing role ${upgraderRole.toLowerCase()}`
    );
  });
});
