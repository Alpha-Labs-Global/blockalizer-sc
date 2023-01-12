import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

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

interface BlockalizerController {
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
  updateTokenURI(tokenId: BigNumber, uri: string): void;
  isInWhitelist(address: string): boolean;
  withdraw(amount: BigNumber): void;
  withdrawAll(): void;

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

interface BlockalizerControllerTestContract extends BlockalizerController {
  address: string;

  connect(address: SignerWithAddress): BlockalizerController;
  deployed(): void;
}

const _INTERFACE_ID_IERC721 = "0x80ac58cd";

describe("BlockalizerV3", function () {
  let instance: BlockalizerControllerTestContract;
  let instanceCollection: BlockalizerV3TestContract;
  let instanceGeneration: BlockalizerGenerationV2TestContract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  const initialMintPrice = ethers.utils.parseEther("0.01");
  const initialMaxSupply = BigNumber.from(10);
  const initialStartTime = BigNumber.from(Math.floor(Date.now() / 1000));
  const initialExpiryTime = initialStartTime.add(30 * 24 * 60 * 60);
  const maxMintsPerWallet = BigNumber.from(4);

  const collectionId = BigNumber.from(0);
  const upgraderRole = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("UPGRADER_ROLE")
  );

  beforeEach(async function () {
    const ContractFactory = await ethers.getContractFactory(
      "BlockalizerController"
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
    //@ts-ignore
    await instance.deployed();

    const collectionAddress = await instance.getCollection(collectionId);
    const generationAddress = await instance.getGeneration();

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
    expect(await instance.getGenerationCount()).to.equal(0);
    expect(await instanceGeneration.mintPrice()).to.equal(initialMintPrice);
    expect(await instanceGeneration.maxSupply()).to.equal(initialMaxSupply);
    expect(await instanceGeneration.expiryTime()).to.equal(initialExpiryTime);
    expect(await instanceGeneration.startTime()).to.equal(initialStartTime);
  });

  it("has roles set up", async function () {
    expect(await instance.hasRole(upgraderRole, owner.address)).to.be.true;

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

  it("basic mint functionality", async function () {
    const mintValue = ethers.utils.parseEther("0.01");
    expect(await instanceGeneration.mintPrice()).to.equal(mintValue);

    const uri1 = "https://www.example.com/cat.json";
    const uri2 = "https://www.example.com/dog.json";
    const uri3 = "https://www.example.com/mouse.json";
    expect(await instanceCollection.totalSupply()).to.equal(0);
    const options = { value: mintValue };
    // ability to mint and emit Transfer events
    await expect(
      instance.connect(addr1).publicMint(collectionId, uri1, options)
    )
      .to.emit(instanceCollection, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 0);
    await expect(
      instance.connect(addr1).publicMint(collectionId, uri2, options)
    )
      .to.emit(instanceCollection, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1);
    await expect(
      instance.connect(addr1).publicMint(collectionId, uri3, options)
    )
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
    const uri = "https://www.example.com/cat.json";
    const options = { value: mintValue };

    for (let i = 0; i < 4; i++) {
      await instance.publicMint(collectionId, uri, options);
    }
    for (let i = 0; i < 4; i++) {
      await instance.connect(addr1).publicMint(collectionId, uri, options);
    }
    for (let i = 0; i < 2; i++) {
      await instance.connect(addr2).publicMint(collectionId, uri, options);
    }

    const contractBalance = ethers.utils.parseEther("0.1");
    expect(await ethers.provider.getBalance(instance.address)).to.be.equal(
      contractBalance
    );

    const amount = ethers.utils.parseEther("0.05");
    const updatedBalance = ethers.utils.parseEther("0.05");
    await instance.withdraw(amount);
    expect(await ethers.provider.getBalance(instance.address)).to.be.equal(
      updatedBalance
    );

    const falseAmount = ethers.utils.parseEther("0.05");
    await expect(
      instance.connect(addr1).withdraw(falseAmount)
    ).to.be.revertedWith(
      `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${upgraderRole.toLowerCase()}`
    );

    const newAmount = ethers.utils.parseEther("1");
    await expect(instance.withdraw(newAmount)).to.be.revertedWith(
      /Amount greater than balance/
    );

    await instance.withdrawAll();
    const finalBalance = ethers.utils.parseEther("0");
    expect(await ethers.provider.getBalance(instance.address)).to.be.equal(
      finalBalance
    );
  });

  /*

  Fast-forwards time. There is no way to rewind, so must be the last
  test in the list

  */

  it("advanced minting functionality", async function () {
    expect(await instanceGeneration.maxSupply()).to.equal(initialMaxSupply);

    const mintValue = ethers.utils.parseEther("0.01");
    const uri = "https://www.example.com/cat.json";
    const options = { value: mintValue };

    for (let i = 0; i < 4; i++) {
      await instance.publicMint(collectionId, uri, options);
    }
    await expect(
      instance.publicMint(collectionId, uri, options)
    ).to.be.revertedWith(
      /User has already minted max tokens in this generation/
    );

    for (let i = 0; i < 4; i++) {
      await instance.connect(addr1).publicMint(collectionId, uri, options);
    }
    for (let i = 0; i < 2; i++) {
      await instance.connect(addr2).publicMint(collectionId, uri, options);
    }
    await expect(
      instance.publicMint(collectionId, uri, options)
    ).to.be.revertedWith(
      /User has already minted max tokens in this generation/
    );

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
    ).to.be.revertedWith(/Expiry time must be in future/);

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
    const newInstanceChild: BlockalizerGenerationTestContract =
      await newChild.attach(newAddress);

    expect(await newInstanceChild.maxSupply()).to.equal(newMaxSupply);
    expect(await newInstanceChild.expiryTime()).to.equal(newExpiryTime);

    await expect(
      instance.publicMint(collectionId, uri, options)
    ).to.be.revertedWith(/Minting not yet live/);
    await instance.addToWhitelist([addr2.address]);
    await instance.connect(addr2).publicMint(collectionId, uri, options);
    expect(await instanceCollection.totalSupply()).to.equal(11);

    await time.increase(oneHour * 2);
    await instance.publicMint(collectionId, uri, options);
    expect(await instanceCollection.totalSupply()).to.equal(12);

    await time.increase(oneMonthInSeconds * 2);
    await expect(
      instance.publicMint(collectionId, uri, options)
    ).to.be.revertedWith(/Expiry has passed/);
  });
});
