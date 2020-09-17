const { expectRevert } = require('@openzeppelin/test-helpers');
const BridgeToken = artifacts.require('BridgeToken');

contract('BridgeToken', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.bridge = await BridgeToken.new({ from: alice });
    });

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.bridge.name();
        const symbol = await this.bridge.symbol();
        const decimals = await this.bridge.decimals();
        assert.equal(name.valueOf(), 'BridgeToken');
        assert.equal(symbol.valueOf(), 'BRIDGE');
        assert.equal(decimals.valueOf(), '18');
    });

    it('should only allow owner to mint token', async () => {
        await this.bridge.mint(alice, '100', { from: alice });
        await this.bridge.mint(bob, '1000', { from: alice });
        await expectRevert(
            this.bridge.mint(carol, '1000', { from: bob }),
            'Ownable: caller is not the owner',
        );
        const totalSupply = await this.bridge.totalSupply();
        const aliceBal = await this.bridge.balanceOf(alice);
        const bobBal = await this.bridge.balanceOf(bob);
        const carolBal = await this.bridge.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '100');
        assert.equal(bobBal.valueOf(), '1000');
        assert.equal(carolBal.valueOf(), '0');
    });

    it('should supply token transfers properly', async () => {
        await this.bridge.mint(alice, '100', { from: alice });
        await this.bridge.mint(bob, '1000', { from: alice });
        await this.bridge.transfer(carol, '10', { from: alice });
        await this.bridge.transfer(carol, '100', { from: bob });
        const totalSupply = await this.bridge.totalSupply();
        const aliceBal = await this.bridge.balanceOf(alice);
        const bobBal = await this.bridge.balanceOf(bob);
        const carolBal = await this.bridge.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '90');
        assert.equal(bobBal.valueOf(), '900');
        assert.equal(carolBal.valueOf(), '110');
    });

    it('should fail if you try to do bad transfers', async () => {
        await this.bridge.mint(alice, '100', { from: alice });
        await expectRevert(
            this.bridge.transfer(carol, '110', { from: alice }),
            'ERC20: transfer amount exceeds balance',
        );
        await expectRevert(
            this.bridge.transfer(carol, '1', { from: bob }),
            'ERC20: transfer amount exceeds balance',
        );
    });
  });
