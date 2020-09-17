const BridgeMiner = artifacts.require('BridgeMiner.sol');
const BridgeToken = artifacts.require('BridgeToken.sol');
const MockERC20 = artifacts.require('MockERC20.sol');

module.exports = async function (deployer, network, accounts) {
  // await deployer.deploy(BridgeToken);
  // console.log('bridgeToken.address', BridgeToken.address);
  // await deployer.deploy(BridgeMiner,
  //   BridgeToken.address,
  //   '0x4cf0a877e906dead748a41ae7da8c220e4247d9e',
  //   '100000000000000000000',
  //   '7193938',
  //   '8193938'
  // );
  // console.log('BridgeMiner.address', BridgeMiner.address);

  // await deployer.deploy(MockERC20, 'USD in Ethereum', 'USDT', 6, '1000000000000');
};
