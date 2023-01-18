import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { BigNumber } from "ethers"
import { ethers, upgrades } from "hardhat"

import {
  BlockalizerControllerV5,
  BlockalizerGenerationV2,
  BlockalizerV3,
} from "../typechain-types"

const _INTERFACE_ID_IERC721 = "0x80ac58cd"

describe("BlockalizerControllerV5", function () {
  let firstInstance: BlockalizerControllerV5
  let instanceCollection: BlockalizerV3
  let instanceGeneration: BlockalizerGenerationV2
  let owner: SignerWithAddress
  let addr1: SignerWithAddress
  let addr2: SignerWithAddress

  const initialMintPrice = ethers.utils.parseEther("0.01")
  const initialMaxSupply = BigNumber.from(10)
  const initialStartTime = BigNumber.from(Math.floor(Date.now() / 1000)).sub(
    60
  )
  const initialExpiryTime = initialStartTime.add(30 * 60)
  const maxMintsPerWallet = BigNumber.from(5)

  const collectionId = BigNumber.from(0)
  const upgraderRole = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("UPGRADER_ROLE"),
  )
  const withdrawerRole = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("WITHDRAWER_ROLE"),
  )
  const whitelisterRole = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("WHITELISTER_ROLE"),
  )
  const generatorRole = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("GENERATOR_ROLE"),
  )

  beforeEach(async function () {
    const ContractFactory = await ethers.getContractFactory(
      "BlockalizerControllerV5"
    )

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
    )
    await firstInstance.deployed()

    const collectionAddress = await firstInstance.getCollection(collectionId)
    const generationAddress = await firstInstance.getGeneration()

    const childContract1 = await ethers.getContractFactory("BlockalizerV3")
    instanceCollection = childContract1.attach(collectionAddress)

    const childContract2 = await ethers.getContractFactory(
      "BlockalizerGenerationV2"
    )
    instanceGeneration = childContract2.attach(generationAddress)

    ;([owner, addr1, addr2] = await ethers.getSigners())
  })

  it("deploys", async function () {
    expect(await instanceCollection.name()).to.equal("Blockalizer:Chroma")
    expect(await instanceCollection.symbol()).to.equal("CHROMA")
    expect(await instanceCollection.totalSupply()).to.equal(0)
    expect(await instanceCollection.supportsInterface(_INTERFACE_ID_IERC721)).to
      .be.true
    expect(await firstInstance.getGenerationCount()).to.equal(0)
    expect(await instanceGeneration.mintPrice()).to.equal(initialMintPrice)
    expect(await instanceGeneration.maxSupply()).to.equal(initialMaxSupply)
    expect(await instanceGeneration.expiryTime()).to.equal(initialExpiryTime)
    expect(await instanceGeneration.startTime()).to.equal(initialStartTime)
  })

  it("upgrades", async function () {
    const ContractFactory = await ethers.getContractFactory(
      "BlockalizerControllerV5"
    )
    // @ts-ignore
    const secondInstance: BlockalizerControllerV5 =
      await upgrades.upgradeProxy(firstInstance.address, ContractFactory)
    await secondInstance.deployed()

    const collectionAddress = await secondInstance.getCollection(collectionId)
    const generationAddress = await secondInstance.getGeneration()

    expect(collectionAddress).to.equal(instanceCollection.address)
    expect(generationAddress).to.equal(instanceGeneration.address)
    expect(await secondInstance.getGenerationCount()).to.equal(0)
    expect(firstInstance.address).to.equal(secondInstance.address)
  })

  it("updates token URI", async function () {
    // mint all of all
    // check can't mint more
    const mintValue = ethers.utils.parseEther("0.01")
    const options = { value: mintValue }
    const uri = "https://www.example.com/cat.json"
    const sig = await addr1.signMessage(uri)
    for (let i = 0; i < 5; i++) {
      await expect(firstInstance.publicMint(collectionId, uri, sig, options))
        .to.emit(instanceCollection, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          await owner.getAddress(),
          i,
        )
    }
    await expect(firstInstance.publicMint(collectionId, uri, sig, options))
      .to.be.revertedWithCustomError(firstInstance, 'MaxMinted')
      .withArgs(
        await instanceGeneration.maxMintsPerWallet(),
      )
    const first1 = firstInstance.connect(addr1)
    const first2 = firstInstance.connect(addr2)
    const totalSupply = await instanceCollection.totalSupply()
    for (let i = 0; i < 5; i++) {
      await expect(first1.publicMint(collectionId, uri, sig, options))
        .to.emit(instanceCollection, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          await addr1.getAddress(),
          totalSupply.add(i),
        )
    }
    await expect(first2.publicMint(collectionId, uri, sig, options))
      .to.be.revertedWithCustomError(firstInstance, 'MaxMinted')
      .withArgs(
        await instanceGeneration.maxSupply(),
      )

    const randomTokenId = 4
    await expect(instanceCollection.tokenURI(randomTokenId))
      .eventually.to.equal(uri)

    await expect(first2.publicMint(
      collectionId,
      uri,
      sig,
      options,
    ))
      .to.be.revertedWithCustomError(firstInstance, 'MaxMinted')
      .withArgs(
        await instanceGeneration.maxSupply(),
      )
  })
})
