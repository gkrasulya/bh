var BH = require('../lib/bh');
require('chai').should();

// Standart: http://ru.bem.info/technology/bemjson/

describe('bh.processBemJson', function() {
    var bh;
    beforeEach(function() {
        bh = new BH();
    });

    it('should return standart bemjson', function() {
        bh.processBemJson({
            block: 'button',
            mods: { disabled: true },
            content: {
                elem: 'inner',
                mods: { valid: true }
            }
        }).should.deep.equal({
            block: 'button',
            mods: { disabled: true },
            content: {
                block: 'button',
                elem: 'inner',
                mods: { valid: true }
            }
        });
    });

    it('should replace elemMods with mods if collision', function() {
        bh.processBemJson({
            block: 'button',
            elem: 'inner',
            elemMods: { disabled: 'yes' },
            mods: { valid: true }
        }).should.deep.equal({
            block: 'button',
            elem: 'inner',
            mods: { disabled: 'yes' }
        });
    });
});
