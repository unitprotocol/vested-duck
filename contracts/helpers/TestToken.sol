// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract TestToken is ERC20 {
    constructor() ERC20 ("TestToken", "TT") { }

    function mint(address to, uint amount) external {
        _mint(to, amount);
    }
}