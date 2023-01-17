// contracts/BlockalizerV4.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./interfaces/IBlockalizer.sol";
import "./BlockalizerV3.sol";

contract BlockalizerControllerV5 is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    using Address for address payable;
    using ECDSA for bytes32;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private _collectionIdCounter;
    mapping(uint256 => address) private _collections;

    CountersUpgradeable.Counter private _generationCounter;
    mapping(uint256 => address) private _generations;

    mapping(address => bool) private _whitelisted;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");
    bytes32 public constant WHITELISTER_ROLE = keccak256("WHITELISTER_ROLE");
    bytes32 public constant GENERATOR_ROLE = keccak256("GENERATOR_ROLE");

    event Collection(uint256 indexed _id, address indexed _address);
    event Generation(uint256 indexed _id, address indexed _address);

    error GenerationExpired(uint256 timestamp);
    error MaxMinted(address sender, uint256 maximum);
    error PaymentDeficit(uint256 value, uint256 price);
    error MintNotAllowed(address sender);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        uint256 _mintPrice,
        uint256 _maxSupply,
        uint256 _expiryTime,
        uint256 _startTime,
        uint16 _maxMintsPerWallet
    ) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(WITHDRAWER_ROLE, msg.sender);
        _grantRole(WHITELISTER_ROLE, msg.sender);
        _grantRole(GENERATOR_ROLE, msg.sender);

        _initializeCollection();
        _initializeGeneration(
            _mintPrice,
            _maxSupply,
            _expiryTime,
            _startTime,
            _maxMintsPerWallet
        );
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    function _initializeCollection() internal {
        uint256 collectionId = _collectionIdCounter.current();
        IBlockalizer collection = new BlockalizerV3();
        _collections[collectionId] = address(collection);

        emit Collection(collectionId, _collections[collectionId]);
    }

    function getCollection(
        uint256 _collectionId
    ) external view returns (address) {
        return _collections[_collectionId];
    }

    function _initializeGeneration(
        uint256 _mintPrice,
        uint256 _maxSupply,
        uint256 _expiryTime,
        uint256 _startTime,
        uint16 _maxMintsPerWallet
    ) internal {
        if (_expiryTime <= block.timestamp) {
            revert GenerationExpired(block.timestamp);
        }
        uint256 generationId = _generationCounter.current();
        BlockalizerGenerationV2 generation = new BlockalizerGenerationV2(
            _mintPrice,
            _maxSupply,
            _expiryTime,
            _startTime,
            _maxMintsPerWallet
        );
        _generations[generationId] = address(generation);

        emit Generation(generationId, _generations[generationId]);
    }

    function getGenerationCount() public view returns (uint256) {
        return _generationCounter.current();
    }

    function getGeneration() public view returns (address) {
        uint256 generationId = _generationCounter.current();
        return _generations[generationId];
    }

    function isInWhitelist(address user) external view returns (bool) {
        return _whitelisted[user];
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function startGeneration(
        uint96 _mintPrice,
        uint96 _maxSupply,
        uint32 _expiryTime,
        uint32 _startTime,
        uint32 _maxMintsPerWallet
    ) external onlyRole(UPGRADER_ROLE) {
        _generationCounter.increment();
        _initializeGeneration(
            _mintPrice,
            _maxSupply,
            _expiryTime,
            _startTime,
            _maxMintsPerWallet
        );
    }

    function addToWhitelist(
        address[] calldata users
    ) external onlyRole(WHITELISTER_ROLE) {
        for (uint256 i = 0; i < users.length; ++i) {
            _whitelisted[users[i]] = true;
        }
    }

    function publicMint(
        uint256 _collectionId,
        string memory _uri,
        bytes memory sig
    ) public payable {
        IBlockalizer collection = IBlockalizer(_collections[_collectionId]);
        uint256 tokenId = collection.currentTokenId();
        uint256 generationId = _generationCounter.current();
        BlockalizerGenerationV2 generation = BlockalizerGenerationV2(
            _generations[generationId]
        );
        uint256 tokenCount = generation.getTokenCount();
        if (generation.balanceOf(_msgSender()) >= generation.maxMintsPerWallet()) {
            revert MaxMinted(_msgSender(), generation.maxMintsPerWallet());
        }
        if (generation.maxSupply() <= tokenCount) {
            revert MaxMinted(address(0), generation.maxSupply());
        }
        if (msg.value != generation.mintPrice()) {
            revert PaymentDeficit(msg.value, generation.mintPrice());
        }
        if (!_whitelisted[_msgSender()] && block.timestamp <= generation.startTime()) {
            revert MintNotAllowed(_msgSender());
        }
        if (generation.expiryTime() <= block.timestamp) {
            revert GenerationExpired(block.timestamp);
        }
        if (hasRole(GENERATOR_ROLE, keccak256(abi.encodePacked(_uri)).recover(sig))) {
            revert MintNotAllowed(_msgSender());
        }
        collection.safeMint(msg.sender, tokenId);
        collection.setTokenURI(tokenId, _uri);
        generation.incrementTokenCount(msg.sender);
        collection.incrementTokenId();
    }

    function withdraw(uint256 amount) public onlyRole(WITHDRAWER_ROLE) {
        uint256 balance = address(this).balance;
        amount = amount > balance ? balance : amount;
        amount = amount == 0 ? balance : amount;
        payable(msg.sender).sendValue(amount);
    }
}
