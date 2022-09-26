// SPDX-License-Identifier: bsl-1.1
/**
 * Copyright 2022 Unit Protocol V2: Artem Zakharov (hello@unit.xyz).
 */
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @notice Rewards distribution in sidechains to veDUCK holders
 * Snapshot of holders in mainnet is taken once
 */
contract veDistributionSnapshot is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /** @notice balance of user from snapshot */
    mapping(address => uint) public balanceOf;
    /** @notice users list */
    address[] public users;
    /** @notice sum of users' balances from snapshot */
    uint public totalSupply;

    /** @notice amounts of reward token already sent to all users */
    mapping(IERC20 => uint) public rewardsSent;
    /** @notice amounts of reward token already sent to user */
    mapping(IERC20 => mapping (address => uint)) public rewardsSentToUser;

    event RewardSent(IERC20 indexed token, address indexed user, uint amount);

    /**
     * @notice add users' balances from snapshot
     * @dev after all balances added `renounceOwnership` must be called
     */
    function addBalances(address[] calldata users_, uint[] calldata balances_) public onlyOwner {
        require(users_.length > 0, "DISTRIBUTION: EMPTY_ARRAYS");
        require(users_.length == balances_.length, "DISTRIBUTION: INVALID_ARRAYS_LENGTH");

        for (uint i; i < users_.length; i++) {
            require(balances_[i] > 0, "DISTRIBUTION: INVALID_AMOUNT");
            require(balanceOf[users_[i]] == 0, "DISTRIBUTION: USER_ALREADY_ADDED");

            balanceOf[users_[i]] = balances_[i];
            totalSupply += balances_[i];
            users.push(users_[i]);
        }
    }

    function usersCount() public view returns (uint) {
        return users.length;
    }

    function allUsers() public view returns (address[] memory) {
        return users;
    }

    function availableReward(address user_, IERC20 token_) public view returns (uint) {
        uint userBalance = balanceOf[user_];
        if (userBalance == 0) {
            return 0;
        }

        return _calcTotalUserReward(userBalance, token_) - rewardsSentToUser[token_][user_];
    }

    function withdrawReward(IERC20[] calldata tokens_) public nonReentrant {
        require(owner() == address(0), 'DISTRIBUTION: CONTRACT_IS_NOT_FINALIZED');

        for (uint i; i < tokens_.length; i++) {
            _withdrawReward(tokens_[i]);
        }
    }

    function _withdrawReward(IERC20 token_) internal {
        uint userBalance = balanceOf[msg.sender];
        require(userBalance > 0, 'DISTRIBUTION: AUTH_FAILED');

        uint totalUserReward = _calcTotalUserReward(userBalance, token_);
        require(totalUserReward > rewardsSentToUser[token_][msg.sender], 'DISTRIBUTION: NOTHING_TO_WITHDRAW');

        uint amountToSend = totalUserReward - rewardsSentToUser[token_][msg.sender];
        rewardsSentToUser[token_][msg.sender] += amountToSend;
        rewardsSent[token_] += amountToSend;

        token_.safeTransfer(msg.sender, amountToSend);
        emit RewardSent(token_, msg.sender, amountToSend);
    }

    function _calcTotalUserReward(uint userBalance_, IERC20 token_) internal view returns (uint) {
        uint totalRewardsReceived = rewardsSent[token_] + token_.balanceOf(address(this));

        return totalRewardsReceived * userBalance_ / totalSupply;
    }
}