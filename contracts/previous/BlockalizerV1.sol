// contracts/BlockalizerV1.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

contract Blockalizer is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    OwnableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private _tokenIdCounter;
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint public mintPrice;
    uint256 public maxSupply;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC721_init("Blockalizer", "BLOCK");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __Ownable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        setMintPrice(0.015 ether);
        setMaxSupply(1000);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    function publicMint(string memory _uri) public payable {
        uint256 tokenId = _tokenIdCounter.current();
        require(tokenId < maxSupply, "All NFTs have been minted");
        _tokenIdCounter.increment();
        require(msg.value == mintPrice, "Not enough ETH provided");
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _uri);
    }

    function setMintPrice(uint _mintPrice) public onlyRole(UPGRADER_ROLE) {
        mintPrice = _mintPrice;
    }

    function setMaxSupply(uint256 _maxSupply) public onlyRole(UPGRADER_ROLE) {
        uint256 current = _tokenIdCounter.current();
        require(
            _maxSupply >= current,
            "Max supply can not be less than total minted tokens"
        );
        maxSupply = _maxSupply;
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
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            AccessControlUpgradeable
        )
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
