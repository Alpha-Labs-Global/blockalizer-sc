import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

interface PayableOptions {
  value: BigNumber;
}

interface BlockalizerV2Contract {
  name(): string;
  symbol(): string;
  balanceOf(address: string): BigNumber;
  totalSupply(): BigNumber;
  tokenOfOwnerByIndex(address: string, index: BigNumber): BigNumber;
  tokenURI(tokenId: BigNumber): string;

  getGenerationCount(): BigNumber;
  getGeneration(): string;
  startGeneration(
    _mintPrice: BigNumber,
    _maxSupply: BigNumber,
    _expiryTime: BigNumber,
    _startTime: BigNumber
  ): string;
  publicMint(uri: string, options: PayableOptions): void;
  addToWhitelist(address: string): void;
  goldenBlockHolder(address: string): boolean;
  updateTokenURI(tokenId: BigNumber, uri: string): void;
  withdraw(amount: BigNumber): void;
  withdrawAll(): void;

  supportsInterface(interface_id: string): boolean;
  hasRole(role: string, address: string): boolean;
  getRoleAdmin(role: string): string;
  grantRole(role: string, address: string): void;
}

interface BlockalizerV2TestContract extends BlockalizerV2Contract {
  address: string;

  connect(address: SignerWithAddress): BlockalizerV2Contract;
  deployed(): void;
}

interface BlockalizerGenerationContract {
  mintPrice(): BigNumber;
  maxSupply(): BigNumber;
  expiryTime(): BigNumber;
  startTime(): BigNumber;
  owner(): string;
  incrementTokenCount(): void;
}

interface BlockalizerGenerationTestContract
  extends BlockalizerGenerationContract {}

const _INTERFACE_ID_IERC721 = "0x80ac58cd";

describe("BlockalizerV2", function () {
  let instance: BlockalizerV2TestContract;
  let instanceChild: BlockalizerGenerationTestContract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  let initialMintPrice = ethers.utils.parseEther("0.01");
  let initialMaxSupply = BigNumber.from(10);
  let initialStartTime = BigNumber.from(Math.floor(Date.now() / 1000));
  let initialExpiryTime = initialStartTime.add(30 * 24 * 60 * 60);

  beforeEach(async function () {
    const ContractFactory = await ethers.getContractFactory("BlockalizerV2");

    //@ts-ignore
    instance = await ContractFactory.deploy(
      initialMintPrice,
      initialMaxSupply,
      initialExpiryTime,
      initialStartTime
    );
    await instance.deployed();

    const childAddress = await instance.getGeneration();
    const child = await ethers.getContractFactory("BlockalizerGeneration");
    //@ts-ignore
    instanceChild = await child.attach(childAddress);

    [owner, addr1, addr2] = await ethers.getSigners();
  });

  it("deploys", async function () {
    expect(await instance.name()).to.equal("Blockalizer");
    expect(await instance.symbol()).to.equal("BLOCK");
    expect(await instance.totalSupply()).to.equal(0);
    expect(await instance.supportsInterface(_INTERFACE_ID_IERC721)).to.be.true;
    expect(await instance.getGenerationCount()).to.equal(0);
    expect(await instanceChild.mintPrice()).to.equal(initialMintPrice);
    expect(await instanceChild.maxSupply()).to.equal(initialMaxSupply);
    expect(await instanceChild.expiryTime()).to.equal(initialExpiryTime);
    expect(await instanceChild.startTime()).to.equal(initialStartTime);
  });

  it("has roles set up", async function () {
    const upgraderRole = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("UPGRADER_ROLE")
    );
    expect(await instance.hasRole(upgraderRole, owner.address)).to.be.true;

    const defaultAdminRole = await instance.getRoleAdmin(upgraderRole);
    expect(await instance.hasRole(defaultAdminRole, owner.address)).to.be.true;

    expect(await instance.hasRole(upgraderRole, addr1.address)).to.be.false;
    await instance.grantRole(upgraderRole, addr1.address);
    expect(await instance.hasRole(upgraderRole, addr1.address)).to.be.true;

    await expect(instanceChild.incrementTokenCount()).to.be.revertedWith(
      /Ownable: caller is not the owner/
    );

    expect(await instanceChild.owner()).to.equal(instance.address);
  });

  it("basic mint functionality", async function () {
    const mintValue = ethers.utils.parseEther("0.01");
    expect(await instanceChild.mintPrice()).to.equal(mintValue);

    const uri1 = "https://www.example.com/cat.json";
    const uri2 = "https://www.example.com/dog.json";
    const uri3 = "https://www.example.com/mouse.json";
    expect(await instance.totalSupply()).to.equal(0);
    const options = { value: mintValue };
    // ability to mint and emit Transfer events
    await expect(instance.connect(addr1).publicMint(uri1, options))
      .to.emit(instance, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 0);
    await expect(instance.connect(addr1).publicMint(uri2, options))
      .to.emit(instance, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 1);
    await expect(instance.connect(addr1).publicMint(uri3, options))
      .to.emit(instance, "Transfer")
      .withArgs(ethers.constants.AddressZero, addr1.address, 2);

    expect(await instance.totalSupply()).to.equal(3);
    expect(await instance.balanceOf(addr1.address)).to.equal(3);

    expect(
      await instance.tokenOfOwnerByIndex(addr1.address, BigNumber.from(0))
    ).to.equal(0);
    expect(await instance.tokenURI(BigNumber.from(0))).to.equal(uri1);
    expect(
      await instance.tokenOfOwnerByIndex(addr1.address, BigNumber.from(1))
    ).to.equal(1);
    expect(await instance.tokenURI(BigNumber.from(1))).to.equal(uri2);
    expect(
      await instance.tokenOfOwnerByIndex(addr1.address, BigNumber.from(2))
    ).to.equal(2);
    expect(await instance.tokenURI(BigNumber.from(2))).to.equal(uri3);
  });

  it("withdraws funds", async function () {
    const mintValue = ethers.utils.parseEther("0.01");
    const uri = "https://www.example.com/cat.json";
    const options = { value: mintValue };
    for (let i = 0; i < 10; i++) {
      await instance.publicMint(uri, options);
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
    ).to.be.revertedWith(/Ownable: caller is not the owner/);

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

  it("golden block", async function () {
    const mintValue = ethers.utils.parseEther("0.01");
    const uri = "https://www.example.com/cat.json";
    const options = { value: mintValue };

    let allEvents = [];
    expect(await instance.goldenBlockHolder(owner.address)).to.equal(false);
    for (let i = 0; i < 10; i++) {
      const tx = await instance.publicMint(uri, options);
      //@ts-ignore
      const receipt = await tx.wait();
      allEvents.push(...receipt.events);
    }
    let goldenBlockEvents = allEvents.filter((e) => {
      return e.event == "GoldenBlock";
    });
    expect(goldenBlockEvents.length).to.equal(1);
    expect(goldenBlockEvents[0].args[0]).to.equal(owner.address);
    expect(goldenBlockEvents[0].args[1]).to.be.approximately(5, 6);
    expect(goldenBlockEvents[0].args[2]).to.equal(0);
    expect(await instance.goldenBlockHolder(owner.address)).to.equal(true);

    const tokenId = BigNumber.from(goldenBlockEvents[0].args[1]);
    const newUri = "https://www.example.com/golden.json";
    await instance.updateTokenURI(tokenId, newUri);
    expect(await instance.tokenURI(tokenId)).to.equal(newUri);
  });

  /*
  
  Fast-forwards time. There is no way to rewind, so must be the last
  test in the list

  */

  it("advanced minting functionality", async function () {
    expect(await instanceChild.maxSupply()).to.equal(initialMaxSupply);

    const mintValue = ethers.utils.parseEther("0.01");
    const uri = "https://www.example.com/cat.json";
    const options = { value: mintValue };

    for (let i = 0; i < 10; i++) {
      await instance.publicMint(uri, options);
    }

    await expect(instance.publicMint(uri, options)).to.be.revertedWith(
      /All NFTs in this generation have been minted/
    );

    const newMaxSupply = BigNumber.from(5);
    const falseExpiryTime = initialStartTime.sub(60);
    await expect(
      instance.startGeneration(
        initialMintPrice,
        newMaxSupply,
        falseExpiryTime,
        initialStartTime
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
      newStartTime
    );
    const newAddress = await instance.getGeneration();
    const newChild = await ethers.getContractFactory("BlockalizerGeneration");
    //@ts-ignore
    const newInstanceChild: BlockalizerGenerationTestContract =
      await newChild.attach(newAddress);

    expect(await newInstanceChild.maxSupply()).to.equal(newMaxSupply);
    expect(await newInstanceChild.expiryTime()).to.equal(newExpiryTime);

    await expect(instance.publicMint(uri, options)).to.be.revertedWith(
      /Minting not yet live/
    );
    await instance.addToWhitelist(addr2.address);
    await instance.connect(addr2).publicMint(uri, options);
    expect(await instance.totalSupply()).to.equal(11);

    await time.increase(oneHour * 2);
    await instance.publicMint(uri, options);
    expect(await instance.totalSupply()).to.equal(12);

    await time.increase(oneMonthInSeconds * 2);
    await expect(instance.publicMint(uri, options)).to.be.revertedWith(
      /Expiry has passed/
    );
  });
});
