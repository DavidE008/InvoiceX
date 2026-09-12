// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// @dev Test double only. Live deployments MUST use ATS-issued assets.
contract ComplianceAsset is ERC20 {
    mapping(address => bool) public kyc;
    address public admin;
    constructor(address issuer) ERC20("TEST DOUBLE Invoice", "MOCK") {
        admin = msg.sender;
        kyc[issuer] = true;
        _mint(issuer, 1);
    }
    function decimals() public pure override returns (uint8) { return 0; }
    function setKyc(address account, bool allowed) external { require(msg.sender == admin); kyc[account] = allowed; }
    function _update(address from, address to, uint256 value) internal override {
        require(to == address(0) || kyc[to], "Recipient lacks KYC");
        require(from == address(0) || kyc[from], "Sender lacks KYC");
        super._update(from, to, value);
    }
}
