// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// @notice Freely mintable test currency, deliberately restricted to development networks.
contract TestUSD is ERC20 {
    constructor() ERC20("InvoiceX Test USD", "ixUSD") {
        require(block.chainid == 296 || block.chainid == 11155111 || block.chainid == 1337, "Testnets only");
    }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
