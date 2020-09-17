const { expectRevert, time } = require('@openzeppelin/test-helpers');
const BridgeToken = artifacts.require('BridgeToken');
const BridgeMiner = artifacts.require('BridgeMiner');
const MockERC20 = artifacts.require('MockERC20');

contract('BridgeMiner', ([alice, bob, carol, dev, minter]) => {
    beforeEach(async () => {
        this.bridge = await BridgeToken.new({ from: alice });
    });

    it('should set correct state variables', async () => {
        this.chef = await BridgeMiner.new(this.bridge.address, dev, '1000', '0', '100', '1000', '10000', { from: alice });
        await this.bridge.transferOwnership(this.chef.address, { from: alice });
        const bridge = await this.chef.bridgeToken();
        const devaddr = await this.chef.devaddr();
        const owner = await this.bridge.owner();
        assert.equal(bridge.valueOf(), this.bridge.address);
        assert.equal(devaddr.valueOf(), dev);
        assert.equal(owner.valueOf(), this.chef.address);
    });

    it('should allow dev and only dev to update dev', async () => {
        this.chef = await BridgeMiner.new(this.bridge.address, dev, '1000', '0', '100', '1000', '10000', { from: alice });
        assert.equal((await this.chef.devaddr()).valueOf(), dev);
        await expectRevert(this.chef.dev(bob, { from: bob }), 'Should be dev address');
        await this.chef.dev(bob, { from: dev });
        assert.equal((await this.chef.devaddr()).valueOf(), bob);
        await this.chef.dev(alice, { from: bob });
        assert.equal((await this.chef.devaddr()).valueOf(), alice);
    })

    context('With ERC/LP token added to the field', () => {
        beforeEach(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', 18, '10000000000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', 18, '10000000000', { from: minter });
            await this.lp2.transfer(alice, '1000', { from: minter });
            await this.lp2.transfer(bob, '1000', { from: minter });
            await this.lp2.transfer(carol, '1000', { from: minter });

            this.lp3 = await MockERC20.new('LPToken3', 'LP3', 4, '10000000000', { from: minter });
            await this.lp3.transfer(alice, '1000', { from: minter });
            await this.lp3.transfer(bob, '1000', { from: minter });
            await this.lp3.transfer(carol, '1000', { from: minter });

            this.lp4 = await MockERC20.new('LPToken4', 'LP4', 8, '10000000000', { from: minter });
            await this.lp4.transfer(alice, '1000', { from: minter });
            await this.lp4.transfer(bob, '1000', { from: minter });
            await this.lp4.transfer(carol, '1000', { from: minter });
        });

        it('should allow emergency withdraw', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '100', '100', '1000', '10000', { from: alice });
            await this.chef.add('100', this.lp.address, false);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await this.chef.deposit(0, '100', { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '900');
            await this.chef.emergencyWithdraw(0, { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
        });

        it('should give out BRIDGEs only after farming time', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '100', '100', '1000', '10000', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.chef.add('100', this.lp.address, true);
            await this.chef.set(0, '50', true);
            await this.chef.set(0, '100', false);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await this.chef.deposit(0, '100', { from: bob });
            await time.advanceBlockTo('89');
            await this.chef.deposit(0, '0', { from: bob }); // block 90
            assert.equal((await this.bridge.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('94');
            await this.chef.deposit(0, '0', { from: bob }); // block 95
            assert.equal((await this.bridge.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('99');
            await this.chef.deposit(0, '0', { from: bob }); // block 100
            assert.equal((await this.bridge.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('100');
            await this.chef.deposit(0, '0', { from: bob }); // block 101
            assert.equal((await this.bridge.balanceOf(bob)).valueOf(), '1000');
            await time.advanceBlockTo('104');
            await this.chef.deposit(0, '0', { from: bob }); // block 105
            assert.equal((await this.bridge.balanceOf(bob)).valueOf(), '5000');
            assert.equal((await this.bridge.balanceOf(dev)).valueOf(), '500');
            assert.equal((await this.bridge.totalSupply()).valueOf(), '5500');
        });

        it('should not distribute BRIDGEs if no one deposit', async () => {
            // 100 per block farming rate starting at block 200 with bonus until block 1000
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '200', '200', '1000', '10000', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.chef.add('100', this.lp.address, true);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await time.advanceBlockTo('199');
            assert.equal((await this.bridge.totalSupply()).valueOf(), '0');
            await time.advanceBlockTo('204');
            assert.equal((await this.bridge.totalSupply()).valueOf(), '0');
            await time.advanceBlockTo('209');
            await this.chef.deposit(0, '10', { from: bob }); // block 210
            assert.equal((await this.bridge.totalSupply()).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(bob)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(dev)).valueOf(), '0');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '990');
            await time.advanceBlockTo('219');
            await this.chef.withdraw(0, '10', { from: bob }); // block 220
            assert.equal((await this.bridge.totalSupply()).valueOf(), '11000');
            assert.equal((await this.bridge.balanceOf(bob)).valueOf(), '10000');
            assert.equal((await this.bridge.balanceOf(dev)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
        });

        it('should distribute BRIDGEs properly for each staker', async () => {
            // 100 per block farming rate starting at block 300 with bonus until block 1000
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '300', '300', '1000', '10000', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.chef.add('100', this.lp.address, true);
            await this.lp.approve(this.chef.address, '1000', { from: alice });
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await this.lp.approve(this.chef.address, '1000', { from: carol });
            // Alice deposits 10 LPs at block 310
            await time.advanceBlockTo('309');
            await this.chef.deposit(0, '10', { from: alice });
            // Bob deposits 20 LPs at block 314
            await time.advanceBlockTo('313');
            await this.chef.deposit(0, '20', { from: bob });
            // Carol deposits 30 LPs at block 318
            await time.advanceBlockTo('317');
            await this.chef.deposit(0, '30', { from: carol });
            // Alice deposits 10 more LPs at block 320. At this point:
            //   Alice should have: 4*1000 + 4*1/3*1000 + 2*1/6*1000 = 5666
            //   BridgeMiner should have the remaining: 10000 - 5666 = 4334
            await time.advanceBlockTo('319')
            await this.chef.deposit(0, '10', { from: alice });
            assert.equal((await this.bridge.totalSupply()).valueOf(), '11000');
            assert.equal((await this.bridge.balanceOf(alice)).valueOf(), '5666');
            assert.equal((await this.bridge.balanceOf(bob)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(this.chef.address)).valueOf(), '4334');
            assert.equal((await this.bridge.balanceOf(dev)).valueOf(), '1000');
            // Bob withdraws 5 LPs at block 330. At this point:
            //   Bob should have: 4*2/3*1000 + 2*2/6*1000 + 10*2/7*1000 = 6190
            await time.advanceBlockTo('329')
            await this.chef.withdraw(0, '5', { from: bob });
            assert.equal((await this.bridge.totalSupply()).valueOf(), '22000');
            assert.equal((await this.bridge.balanceOf(alice)).valueOf(), '5666');
            assert.equal((await this.bridge.balanceOf(bob)).valueOf(), '6190');
            assert.equal((await this.bridge.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(this.chef.address)).valueOf(), '8144');
            assert.equal((await this.bridge.balanceOf(dev)).valueOf(), '2000');
            // Alice withdraws 20 LPs at block 340.
            // Bob withdraws 15 LPs at block 350.
            // Carol withdraws 30 LPs at block 360.
            await time.advanceBlockTo('339')
            await this.chef.withdraw(0, '20', { from: alice });
            await time.advanceBlockTo('349')
            await this.chef.withdraw(0, '15', { from: bob });
            await time.advanceBlockTo('359')
            await this.chef.withdraw(0, '30', { from: carol });
            assert.equal((await this.bridge.totalSupply()).valueOf(), '55000');
            assert.equal((await this.bridge.balanceOf(dev)).valueOf(), '5000');
            // Alice should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
            assert.equal((await this.bridge.balanceOf(alice)).valueOf(), '11600');
            // Bob should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
            assert.equal((await this.bridge.balanceOf(bob)).valueOf(), '11831');
            // Carol should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
            assert.equal((await this.bridge.balanceOf(carol)).valueOf(), '26568');
            // All of them should have 1000 LPs back.
            assert.equal((await this.lp.balanceOf(alice)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(carol)).valueOf(), '1000');

            let poolLength = await this.chef.poolLength();
            console.log('poolLength', poolLength);

        });

        it('should give proper BRIDGEs allocation to each pool', async () => {
            // 100 per block farming rate starting at block 400 with bonus until block 1000
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '400', '400', '1000', '10000', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.lp.approve(this.chef.address, '1000', { from: alice });
            await this.lp2.approve(this.chef.address, '1000', { from: bob });
            // Add first LP to the pool with allocation 1
            await this.chef.add('10', this.lp.address, true);
            // Alice deposits 10 LPs at block 410
            await time.advanceBlockTo('409');
            await this.chef.deposit(0, '10', { from: alice });
            // Add LP2 to the pool with allocation 2 at block 420
            await time.advanceBlockTo('419');
            await this.chef.add('20', this.lp2.address, true);
            // Alice should have 10*1000 pending reward
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '10000');
            // Bob deposits 10 LP2s at block 425
            await time.advanceBlockTo('424');
            await this.chef.deposit(1, '5', { from: bob });
            // Alice should have 10000 + 5*1/3*1000 = 11666 pending reward
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '11666');
            await time.advanceBlockTo('430');
            // At block 430. Bob should get 5*2/3*1000 = 3333. Alice should get ~1666 more.
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '13333');
            assert.equal((await this.chef.pendingBridge(1, bob)).valueOf(), '3333');
        });

        it('should stop giving bonus BRIDGEs after the bonus period ends', async () => {
            // 100 per block farming rate starting at block 500 with bonus until block 600
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '500', '500', '600', '10000', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.lp.approve(this.chef.address, '1000', { from: alice });
            await this.chef.add('1', this.lp.address, true);
            // Alice deposits 10 LPs at block 590
            await time.advanceBlockTo('589');
            await this.chef.deposit(0, '10', { from: alice });
            // At block 605, she should have 1000*10 + 100*5 = 10500 pending.
            await time.advanceBlockTo('605');
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '10500');
            // At block 606, Alice withdraws all pending rewards and should get 10600.
            await this.chef.deposit(0, '0', { from: alice });
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(alice)).valueOf(), '10600');
        });

        it('state test 1', async () => {
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '600', '800', '1000', '10000', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.lp.approve(this.chef.address, '100000', { from: alice });
            await this.chef.add('1', this.lp.address, true);

            await time.advanceBlockTo('699');
            // Alice deposits 10 LPs at block 700
            await this.chef.deposit(0, '10', { from: alice });
            // At block 810, she should have 100*100 + 10*1000 = 20000 pending.
            await time.advanceBlockTo('810');
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '20000');

            // At block 811, Alice withdraws all pending rewards and should get 21000.
            await this.chef.deposit(0, '0', { from: alice });
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(alice)).valueOf(), '21000');
        });

        it('state test 2', async () => {
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '900', '910', '920', '10000', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.lp.approve(this.chef.address, '100000', { from: alice });
            await this.chef.add('1', this.lp.address, true);

            await time.advanceBlockTo('919');
            // Alice deposits 10 LPs at block 920
            await this.chef.deposit(0, '10', { from: alice });
            // At block 930, she should have 10*100 = 1000 pending.
            await time.advanceBlockTo('930');
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '1000');

            // At block 811, Alice withdraws all pending rewards and should get 21000.
            await this.chef.deposit(0, '0', { from: alice });
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(alice)).valueOf(), '1100');
        });

        it('state test 3', async () => {
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '1000', '1010', '1020', '10000', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.lp.approve(this.chef.address, '100000', { from: alice });
            await this.chef.add('1', this.lp.address, true);

            await time.advanceBlockTo('1014');
            // Alice deposits 10 LPs at block 1015
            await this.chef.deposit(0, '10', { from: alice });
            // she should have 5000 pending.
            await time.advanceBlockTo('1020');
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '5000');

            // Alice withdraws all pending rewards and should get 5100.
            await this.chef.deposit(0, '0', { from: alice });
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(alice)).valueOf(), '5100');
        });

        it('state test 4', async () => {
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '1100', '1110', '1120', '10000', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.lp.approve(this.chef.address, '100000', { from: alice });
            await this.chef.add('1', this.lp.address, true);

            await time.advanceBlockTo('1104');
            // Alice deposits 10 LPs at block 1105
            await this.chef.deposit(0, '10', { from: alice });
            // she should have 5*100 + 10*1000 + 10*100 = 11500 pending.
            await time.advanceBlockTo('1130');
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '11500');

            // Alice withdraws all pending rewards and should get 11600.
            await this.chef.deposit(0, '0', { from: alice });
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(alice)).valueOf(), '11600');
        });

        it('state test 5', async () => {
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '1135', '1140', '1150', '1200', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.lp.approve(this.chef.address, '100000', { from: alice });
            await this.chef.add('1', this.lp.address, true);

            await time.advanceBlockTo('1205');
            // Alice deposits 10 LPs at block 1105
            await this.chef.deposit(0, '10', { from: alice });
            // she should have 5*100 + 10*1000 + 10*100 = 11500 pending.
            await time.advanceBlockTo('1210');
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '0');

            // Alice withdraws all pending rewards and should get 11600.
            await this.chef.deposit(0, '0', { from: alice });
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(alice)).valueOf(), '0');
        });

        it('state test 6', async () => {
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '1300', '1310', '1320', '1400', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.lp.approve(this.chef.address, '100000', { from: alice });
            await this.chef.add('1', this.lp.address, true);

            await time.advanceBlockTo('1389');
            // Alice deposits 10 LPs at block 1390
            await this.chef.deposit(0, '10', { from: alice });
            // she should have 10*100 = 1000 pending.
            await time.advanceBlockTo('1410');
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '1000');

            // Alice withdraws all pending rewards and should get 11600.
            await this.chef.deposit(0, '0', { from: alice });
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '0');
            assert.equal((await this.bridge.balanceOf(alice)).valueOf(), '1000');
        });

        it('multi-decimal test', async () => {
            this.chef = await BridgeMiner.new(this.bridge.address, dev, '100', '1500', '1500', '1600', '1700', { from: alice });
            await this.bridge.transferOwnership(this.chef.address, { from: alice });
            await this.lp.approve(this.chef.address, '10000000000', { from: alice });
            await this.lp3.approve(this.chef.address, '10000000000', { from: bob });
            await this.lp4.approve(this.chef.address, '10000000000', { from: carol });
            await this.lp4.approve(this.chef.address, '10000000000', { from: dev });

            await this.chef.add('10', this.lp.address, true);
            await this.chef.add('10', this.lp3.address, true);
            await this.chef.add('10', this.lp4.address, true);
            await this.chef.add('10', this.lp2.address, true);


            await this.lp.transfer(alice, '1000000000', { from: minter });
            await this.lp3.transfer(bob, '1000000000', { from: minter });
            await this.lp4.transfer(carol, '1000000000', { from: minter });
            await this.lp4.transfer(dev, '1000000000', { from: minter });


            await time.advanceBlockTo('1499');
            // Alice deposits 10 LPs at block 1390
            await this.chef.deposit(0, '1000000', { from: alice }); //1500
            await this.chef.deposit(1, '10000', { from: bob }); //1501
            await this.chef.deposit(2, '10', { from: carol });  //1502
            await this.chef.deposit(2, '10', { from: dev });    //1503


            // she should have 100*1000 = 100000 pending.
            await time.advanceBlockTo('1600');
            assert.equal((await this.chef.pendingBridge(0, alice)).valueOf(), '25000');
            assert.equal((await this.chef.pendingBridge(1, bob)).valueOf(), '24750');
            assert.equal((await this.chef.pendingBridge(2, carol)).valueOf(), '12375');
            assert.equal((await this.chef.pendingBridge(2, dev)).valueOf(), '12125');
        });
    });
});
