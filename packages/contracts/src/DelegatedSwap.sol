// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

interface ISwapRouter {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}

contract DelegatedSwap is EIP712, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // Service fee: 1% = 100 basis points
    uint256 public serviceFee = 100;
    uint256 public constant MAX_FEE = 500; // Max 5%
    uint256 public constant FEE_DENOMINATOR = 10000;

    // Fee recipient
    address public feeRecipient;

    // Swap router (1inch, 0x, Uniswap, etc.)
    address public swapRouter;

    // User nonces for replay protection
    mapping(address => uint256) public nonces;

    // Relayers allowed to execute swaps
    mapping(address => bool) public relayers;

    // EIP-712 type hash
    bytes32 public constant DELEGATED_SWAP_TYPEHASH = keccak256(
        "DelegatedSwap(address user,address inputToken,address outputToken,uint256 inputAmount,uint256 minOutputAmount,uint256 deadline,uint256 nonce)"
    );

    // Events
    event DelegatedSwapExecuted(
        address indexed user,
        address indexed inputToken,
        address indexed outputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 serviceFeeAmount,
        address relayer
    );
    event RelayerUpdated(address relayer, bool status);
    event ServiceFeeUpdated(uint256 newFee);
    event FeeRecipientUpdated(address newRecipient);
    event SwapRouterUpdated(address newRouter);

    constructor(
        address _feeRecipient,
        address _swapRouter
    ) EIP712("OmniSwap Delegated", "1") {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        require(_swapRouter != address(0), "Invalid swap router");
        
        feeRecipient = _feeRecipient;
        swapRouter = _swapRouter;
        relayers[msg.sender] = true;
    }

    /**
     * @notice Execute a delegated swap with user's signature
     * @param user User address
     * @param inputToken Input token address
     * @param outputToken Output token address
     * @param inputAmount Amount of input tokens
     * @param minOutputAmount Minimum output tokens (slippage protection)
     * @param deadline Signature deadline
     * @param signature User's EIP-712 signature
     */
    function executeDelegatedSwap(
        address user,
        address inputToken,
        address outputToken,
        uint256 inputAmount,
        uint256 minOutputAmount,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused returns (uint256 outputAmount) {
        require(relayers[msg.sender], "Not authorized relayer");
        require(block.timestamp <= deadline, "Signature expired");
        require(inputAmount > 0, "Invalid input amount");

        // Verify signature
        uint256 currentNonce = nonces[user];
        bytes32 structHash = keccak256(
            abi.encode(
                DELEGATED_SWAP_TYPEHASH,
                user,
                inputToken,
                outputToken,
                inputAmount,
                minOutputAmount,
                deadline,
                currentNonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == user, "Invalid signature");

        // Increment nonce
        nonces[user] = currentNonce + 1;

        // Transfer input tokens from user to this contract
        IERC20(inputToken).safeTransferFrom(user, address(this), inputAmount);

        // Approve swap router
        IERC20(inputToken).safeApprove(swapRouter, inputAmount);

        // Execute swap
        outputAmount = ISwapRouter(swapRouter).swap(
            inputToken,
            outputToken,
            inputAmount,
            minOutputAmount,
            address(this)
        );

        require(outputAmount >= minOutputAmount, "Slippage exceeded");

        // Calculate and deduct service fee
        uint256 feeAmount = (outputAmount * serviceFee) / FEE_DENOMINATOR;
        uint256 userAmount = outputAmount - feeAmount;

        // Transfer fee to fee recipient
        if (feeAmount > 0) {
            IERC20(outputToken).safeTransfer(feeRecipient, feeAmount);
        }

        // Transfer remaining tokens to user
        IERC20(outputToken).safeTransfer(user, userAmount);

        emit DelegatedSwapExecuted(
            user,
            inputToken,
            outputToken,
            inputAmount,
            userAmount,
            feeAmount,
            msg.sender
        );

        return userAmount;
    }

    /**
     * @notice Execute delegated swap with permit (gasless approval)
     */
    function executeDelegatedSwapWithPermit(
        address user,
        address inputToken,
        address outputToken,
        uint256 inputAmount,
        uint256 minOutputAmount,
        uint256 deadline,
        bytes calldata swapSignature,
        // Permit parameters
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused returns (uint256 outputAmount) {
        // Execute permit first
        try IERC20Permit(inputToken).permit(
            user,
            address(this),
            inputAmount,
            permitDeadline,
            v,
            r,
            s
        ) {} catch {
            // Permit might have already been used, continue if allowance exists
            require(
                IERC20(inputToken).allowance(user, address(this)) >= inputAmount,
                "Insufficient allowance"
            );
        }

        // Execute the swap
        return this.executeDelegatedSwap(
            user,
            inputToken,
            outputToken,
            inputAmount,
            minOutputAmount,
            deadline,
            swapSignature
        );
    }

    /**
     * @notice Get the current nonce for a user
     */
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    /**
     * @notice Get the domain separator for EIP-712
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // Admin functions

    function setRelayer(address relayer, bool status) external onlyOwner {
        relayers[relayer] = status;
        emit RelayerUpdated(relayer, status);
    }

    function setServiceFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_FEE, "Fee too high");
        serviceFee = newFee;
        emit ServiceFeeUpdated(newFee);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid address");
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    function setSwapRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid address");
        swapRouter = newRouter;
        emit SwapRouterUpdated(newRouter);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Emergency withdrawal
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function emergencyWithdrawETH() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "ETH transfer failed");
    }

    receive() external payable {}
}