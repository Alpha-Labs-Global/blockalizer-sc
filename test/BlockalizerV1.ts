import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";

interface PayableOptions {
  value: BigNumber;
}

interface BlockalizerContract {
  name(): string;
  symbol(): string;
  balanceOf(address: string): BigNumber;
  totalSupply(): BigNumber;
  publicMint(uri: string, options: PayableOptions): string;
  tokenOfOwnerByIndex(address: string, index: BigNumber): BigNumber;
  tokenURI(tokenId: BigNumber): string;
  mintPrice(): BigNumber;
  maxSupply(): BigNumber;
  setMintPrice(price: BigNumber): void;
  setMaxSupply(supply: BigNumber): void;
  withdraw(amount: BigNumber): void;
  withdrawAll(): void;

  supportsInterface(interface_id: string): boolean;
  hasRole(role: string, address: string): boolean;
  getRoleAdmin(role: string): string;
  grantRole(role: string, address: string): void;
}

interface BlockalizerTestContract extends BlockalizerContract {
  address: string;
  connect(address: SignerWithAddress): BlockalizerContract;
}

const _INTERFACE_ID_IERC721 = "0x80ac58cd";

describe("BlockalizerV1", function () {
  let instance: BlockalizerTestContract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    const ContractFactory = await ethers.getContractFactory("Blockalizer");

    //@ts-ignore
    instance = await upgrades.deployProxy(ContractFactory, [], {
      initializer: "initialize",
    });
    //@ts-ignore
    await instance.deployed();

    [owner, addr1, addr2] = await ethers.getSigners();
  });

  it("deploys", async function () {
    expect(await instance.name()).to.equal("Blockalizer");
    expect(await instance.symbol()).to.equal("BLOCK");
    expect(await instance.totalSupply()).to.equal(0);
    expect(await instance.supportsInterface(_INTERFACE_ID_IERC721)).to.be.true;
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
  });

  it("mints", async function () {
    const mint_value = ethers.utils.parseEther("0.015");
    expect(await instance.mintPrice()).to.equal(mint_value);

    const uri1 = "https://www.example.com/cat.json";
    const uri2 = "https://www.example.com/dog.json";
    const uri3 = "https://www.example.com/mouse.json";
    expect(await instance.totalSupply()).to.equal(0);
    const options = { value: mint_value };
    await instance.connect(addr1).publicMint(uri1, options);
    await instance.connect(addr1).publicMint(uri2, options);
    await instance.connect(addr1).publicMint(uri3, options);

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

  it("change mint price", async function () {
    const mintValue = ethers.utils.parseEther("0.015");
    expect(await instance.mintPrice()).to.equal(mintValue);
    const upgraderRole = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("UPGRADER_ROLE")
    );
    expect(await instance.hasRole(upgraderRole, owner.address)).to.be.true;

    const newMintValue = ethers.utils.parseEther("0.005");
    await instance.setMintPrice(newMintValue);
    expect(await instance.mintPrice()).to.equal(newMintValue);

    await expect(
      instance.connect(addr1).setMintPrice(mintValue)
    ).to.be.revertedWith(/AccessControl: account .* is missing role .*/);
  });

  it("sets max supply", async function () {
    expect(await instance.maxSupply()).to.equal(1000);

    const newMaxSupply = BigNumber.from(5);
    await instance.setMaxSupply(newMaxSupply);
    expect(await instance.maxSupply()).to.equal(newMaxSupply);

    const mintValue = ethers.utils.parseEther("0.015");
    const uri = "https://www.example.com/cat.json";
    const options = { value: mintValue };
    for (let i = 0; i < 5; i++) {
      await instance.publicMint(uri, options);
    }

    await expect(instance.publicMint(uri, options)).to.be.revertedWith(
      /All NFTs have been minted/
    );

    const anotherMaxSupply = BigNumber.from(4);
    await expect(instance.setMaxSupply(anotherMaxSupply)).to.be.revertedWith(
      /Max supply can not be less than total minted tokens/
    );
  });

  it("withdraws funds", async function () {
    const mintValue = ethers.utils.parseEther("0.015");
    const uri = "https://www.example.com/cat.json";
    const options = { value: mintValue };
    for (let i = 0; i < 10; i++) {
      await instance.publicMint(uri, options);
    }

    const contractBalance = ethers.utils.parseEther("0.15");
    expect(await ethers.provider.getBalance(instance.address)).to.be.equal(
      contractBalance
    );

    const amount = ethers.utils.parseEther("0.05");
    const updatedBalance = ethers.utils.parseEther("0.1");
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

  // TODO: events
  // expect(transactionResponse).to.emit(simpleStorage, 'storedNumber')
});
