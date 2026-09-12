// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Testnet receivables market. One ATS token unit represents one whole invoice.
/// ATS enforces compliance on every asset transfer. No bridge or off-chain payment oracle.
contract InvoiceMarketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum Status { None, Open, Financed, Repaid, Settled, Cancelled }
    struct Invoice {
        address asset;
        address seller;
        address debtor;
        uint256 faceValue;
        uint256 price;
        uint64 dueDate;
        bytes32 commitment;
        string ensName;
        Status status;
    }
    IERC20 public immutable paymentToken;
    uint256 public invoiceCount;
    mapping(uint256 => Invoice) public invoices;
    mapping(address => address) public approvedIssuer;
    mapping(address => bool) public usedAsset;
    event AssetApproved(address indexed asset, address indexed issuer);
    event Listed(uint256 indexed id, address indexed asset, address indexed seller, bytes32 commitment);
    event Financed(uint256 indexed id, address indexed investor);
    event Repaid(uint256 indexed id, address indexed payer);
    event Claimed(uint256 indexed id, address indexed holder);
    event Cancelled(uint256 indexed id);
    error InvalidTerms();
    error Unauthorized();
    error WrongStatus();
    error Expired();
    error UnsupportedToken();

    constructor(address payment, address admin) Ownable(admin) {
        if (payment.code.length == 0) revert InvalidTerms();
        paymentToken = IERC20(payment);
    }

    /// @dev Admin verifies ATS provenance and one-unit, zero-decimal issuance before approval.
    function approveAsset(address asset, address issuer) external onlyOwner {
        if (asset.code.length == 0 || asset == address(paymentToken) || issuer == address(0)) revert InvalidTerms();
        approvedIssuer[asset] = issuer;
        emit AssetApproved(asset, issuer);
    }

    function list(address asset, address debtor, uint256 faceValue, uint256 price, uint64 dueDate, bytes32 commitment, string calldata ensName)
        external nonReentrant returns (uint256 id)
    {
        if (approvedIssuer[asset] != msg.sender) revert Unauthorized();
        if (usedAsset[asset] || debtor == address(0) || price == 0 || faceValue < price ||
            dueDate <= block.timestamp || commitment == bytes32(0) || bytes(ensName).length == 0 || bytes(ensName).length > 255) revert InvalidTerms();
        if (IERC20(asset).totalSupply() != 1) revert InvalidTerms();
        usedAsset[asset] = true;
        id = ++invoiceCount;
        invoices[id] = Invoice(asset, msg.sender, debtor, faceValue, price, dueDate, commitment, ensName, Status.Open);
        _receiveExact(IERC20(asset), msg.sender, 1);
        emit Listed(id, asset, msg.sender, commitment);
    }

    function finance(uint256 id) external nonReentrant {
        Invoice storage item = invoices[id];
        if (item.status != Status.Open) revert WrongStatus();
        if (block.timestamp >= item.dueDate) revert Expired();
        if (msg.sender == item.seller) revert Unauthorized();
        item.status = Status.Financed;
        _receiveExact(paymentToken, msg.sender, item.price);
        paymentToken.safeTransfer(item.seller, item.price);
        // If ATS rejects a non-KYC investor, all payment and state changes revert atomically.
        IERC20(item.asset).safeTransfer(msg.sender, 1);
        emit Financed(id, msg.sender);
    }

    /// @notice Anyone may repay, including the debtor; early repayment is supported.
    function repay(uint256 id) external nonReentrant {
        Invoice storage item = invoices[id];
        if (item.status != Status.Financed) revert WrongStatus();
        item.status = Status.Repaid;
        _receiveExact(paymentToken, msg.sender, item.faceValue);
        emit Repaid(id, msg.sender);
    }

    /// @notice Current ATS holder redeems the full invoice, even after compliant secondary transfers.
    function claim(uint256 id) external nonReentrant {
        Invoice storage item = invoices[id];
        if (item.status != Status.Repaid) revert WrongStatus();
        item.status = Status.Settled;
        _receiveExact(IERC20(item.asset), msg.sender, 1);
        paymentToken.safeTransfer(msg.sender, item.faceValue);
        emit Claimed(id, msg.sender);
    }

    function cancel(uint256 id) external nonReentrant {
        Invoice storage item = invoices[id];
        if (item.status != Status.Open) revert WrongStatus();
        if (msg.sender != item.seller) revert Unauthorized();
        item.status = Status.Cancelled;
        IERC20(item.asset).safeTransfer(item.seller, 1);
        emit Cancelled(id);
    }

    function _receiveExact(IERC20 token, address from, uint256 amount) private {
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        if (token.balanceOf(address(this)) != beforeBalance + amount) revert UnsupportedToken();
    }
}
