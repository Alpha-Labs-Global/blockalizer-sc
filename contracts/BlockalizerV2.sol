// contracts/BlockalizerV2.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract BlockalizerGeneration is Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    uint256 private goldenNumber;

    uint256 public startTime;
    uint public mintPrice;
    uint256 public maxSupply;
    uint256 public expiryTime;

    constructor(
        uint _mintPrice,
        uint256 _maxSupply,
        uint256 _expiryTime,
        uint256 _startTime
    ) {
        mintPrice = _mintPrice;
        maxSupply = _maxSupply;
        expiryTime = _expiryTime;
        startTime = _startTime;

        // Random number selected from looking at the previous blockhash
        goldenNumber = uint(blockhash(block.number - 1)) % maxSupply;
    }

    function getTokenCount() public view returns (uint256) {
        return _tokenIdCounter.current();
    }

    function incrementTokenCount() public onlyOwner {
        _tokenIdCounter.increment();
    }

    function isGoldenNumber() public view onlyOwner returns (bool) {
        uint256 tokenCount = _tokenIdCounter.current();
        return (goldenNumber == tokenCount);
    }
}

contract BlockalizerV2 is
    Ownable,
    AccessControl,
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage
{
    using Counters for Counters.Counter;

    event GoldenBlock(
        address indexed receiver,
        uint256 indexed tokenId,
        uint256 generationId
    );

    // Using Factory-Child pattern
    Counters.Counter private generationCounter;
    mapping(uint256 => address) private generations;

    mapping(address => bool) private _goldenBlockHolders;
    mapping(address => bool) private _whitelisted;

    Counters.Counter private _tokenIdCounter;
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    constructor(
        uint _initialMintPrice,
        uint256 _initialMaxSupply,
        uint256 _initialExpiryTime,
        uint256 _initialStartTime
    ) ERC721("Blockalizer", "BLOCK") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        _initializeGeneration(
            _initialMintPrice,
            _initialMaxSupply,
            _initialExpiryTime,
            _initialStartTime
        );
    }

    function _initializeGeneration(
        uint _mintPrice,
        uint256 _maxSupply,
        uint256 _expiryTime,
        uint256 _startTime
    ) internal {
        require(_expiryTime > block.timestamp, "Expiry time must be in future");
        uint256 generationId = generationCounter.current();
        BlockalizerGeneration generation = new BlockalizerGeneration(
            _mintPrice,
            _maxSupply,
            _expiryTime,
            _startTime
        );
        generations[generationId] = address(generation);
    }

    function startGeneration(
        uint _mintPrice,
        uint256 _maxSupply,
        uint256 _expiryTime,
        uint256 _startTime
    ) external onlyRole(UPGRADER_ROLE) {
        generationCounter.increment();
        _initializeGeneration(_mintPrice, _maxSupply, _expiryTime, _startTime);
    }

    function getGenerationCount() public view returns (uint256) {
        return generationCounter.current();
    }

    function getGeneration() public view returns (address) {
        uint256 generationId = generationCounter.current();
        return generations[generationId];
    }

    function publicMint(string memory _uri) public payable {
        uint256 tokenId = _tokenIdCounter.current();
        uint256 generationId = generationCounter.current();
        BlockalizerGeneration generation = BlockalizerGeneration(
            generations[generationId]
        );
        uint256 tokenCount = generation.getTokenCount();
        require(
            generation.maxSupply() > tokenCount,
            "All NFTs in this generation have been minted"
        );
        require(msg.value == generation.mintPrice(), "Not enough ETH provided");
        // whitelisted users can by-pass
        if (!_whitelisted[msg.sender]) {
            require(
                block.timestamp > generation.startTime(),
                "Minting not yet live"
            );
        }
        require(generation.expiryTime() > block.timestamp, "Expiry has passed");

        if (generation.isGoldenNumber()) {
            _goldenBlockHolders[msg.sender] = true;
            emit GoldenBlock(msg.sender, tokenId, generationId);
        }
        _safeMint(msg.sender, tokenId);
        // emit an event
        _setTokenURI(tokenId, _uri);
        generation.incrementTokenCount();
        _tokenIdCounter.increment();
    }

    function addToWhitelist(address user) external onlyRole(UPGRADER_ROLE) {
        _whitelisted[user] = true;
    }

    function goldenBlockHolder(address candidate) external view returns (bool) {
        return _goldenBlockHolders[candidate];
    }

    function updateTokenURI(
        uint256 tokenId,
        string memory _uri
    ) public onlyRole(UPGRADER_ROLE) {
        _setTokenURI(tokenId, _uri);
    }

    function withdraw(uint amount) public onlyOwner {
        require(amount < address(this).balance, "Amount greater than balance");

        address payable _to = payable(owner());
        _to.transfer(amount);
    }

    function withdrawAll() public onlyOwner {
        address payable _to = payable(owner());
        _to.transfer(address(this).balance);
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
