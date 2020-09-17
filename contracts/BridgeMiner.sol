pragma solidity 0.6.12;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./BridgeToken.sol";



// BridgeMiner is the master of Bridge. He can make Bridge and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once BRIDGE is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract BridgeMiner is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of BRIDGEs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accBridgePerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accBridgePerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. BRIDGEs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that BRIDGEs distribution occurs.
        uint256 accBridgePerShare; // Accumulated BRIDGEs per share, times 1e12. See below.
    }

    // The BRIDGE TOKEN!
    BridgeToken public bridgeToken;
    // Dev address.
    address public devaddr;
    // Block number when test BRIDGE period ends.
    uint256 public testEndBlock;
    // Block number when bonus BRIDGE period ends.
    uint256 public bonusEndBlock;
    // Block number when bonus BRIDGE period ends.
    uint256 public allEndBlock;
    // BRIDGE tokens created per block.
    uint256 public bridgePerBlock;
    // Bonus muliplier for early bridge makers.
    uint256 public constant BONUS_MULTIPLIER = 3;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when BRIDGE mining starts.
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        BridgeToken _bridge,
        address _devaddr,
        uint256 _bridgePerBlock,
        uint256 _startBlock,
        uint256 _testEndBlock,
        uint256 _bonusEndBlock,
        uint256 _allEndBlock
    ) public {
        bridgeToken = _bridge;
        devaddr = _devaddr;
        bridgePerBlock = _bridgePerBlock;
        startBlock = _startBlock;
        testEndBlock = _testEndBlock;
        bonusEndBlock = _bonusEndBlock;
        allEndBlock = _allEndBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accBridgePerShare: 0
        }));
    }

    // Update the given pool's BRIDGE allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_from >= allEndBlock) {
            return 0;
        }

        uint256 noRewardCount = 0;
        if (_to >= allEndBlock) {
            noRewardCount = _to.sub(allEndBlock);
        }

        if (_to <= bonusEndBlock && _from >= testEndBlock) {
            return _to.sub(_from).mul(BONUS_MULTIPLIER);
        }

        if (_from >= bonusEndBlock || _to <= testEndBlock) {
            return _to.sub(_from).sub(noRewardCount);
        }

        if (_from <= testEndBlock && _to >= bonusEndBlock) {
            return testEndBlock.sub(_from).add(
                _to.sub(bonusEndBlock).add(
                    bonusEndBlock.sub(testEndBlock).mul(BONUS_MULTIPLIER)
                )
            ).sub(noRewardCount);
        }

        if (_from <= testEndBlock && _to <= bonusEndBlock) {
            return testEndBlock.sub(_from).add(
                _to.sub(testEndBlock).mul(BONUS_MULTIPLIER)
            );
        } else { //(_from <= bonusEndBlock && _to >= bonusEndBlock)
            return bonusEndBlock.sub(_from).mul(BONUS_MULTIPLIER).add(
                _to.sub(bonusEndBlock)
            ).sub(noRewardCount);
        }
    }

    // View function to see pending BRIDGEs on frontend.
    function pendingBridge(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accBridgePerShare = pool.accBridgePerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 bridgeReward = multiplier.mul(bridgePerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accBridgePerShare = accBridgePerShare.add(bridgeReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accBridgePerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 bridgeReward = multiplier.mul(bridgePerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        bridgeToken.mint(devaddr, bridgeReward.div(10));
        bridgeToken.mint(address(this), bridgeReward);
        pool.accBridgePerShare = pool.accBridgePerShare.add(bridgeReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to BridgeMiner for BRIDGE allocation.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accBridgePerShare).div(1e12).sub(user.rewardDebt);
            safeBridgeTransfer(msg.sender, pending);
        }
        if(_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accBridgePerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from BridgeMiner.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accBridgePerShare).div(1e12).sub(user.rewardDebt);
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accBridgePerShare).div(1e12);
        safeBridgeTransfer(msg.sender, pending);
        pool.lpToken.safeTransfer(address(msg.sender), _amount);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    // Safe bridge transfer function, just in case if rounding error causes pool to not have enough BRIDGEs.
    function safeBridgeTransfer(address _to, uint256 _amount) internal {
        uint256 bridgeBal = bridgeToken.balanceOf(address(this));
        if (_amount > bridgeBal) {
            bridgeToken.transfer(_to, bridgeBal);
        } else {
            bridgeToken.transfer(_to, _amount);
        }
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) public {
        require(msg.sender == devaddr, "Should be dev address");
        devaddr = _devaddr;
    }
}
