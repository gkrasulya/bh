function BH() {
    this._lastMatchId = 0;
    this._matchers = [];
    this._dirtyEnv = false;
    for (var i in {}) {
        this._dirtyEnv = true;
        break;
    }
    this._infiniteLoopDetection = false;
    this._selfCloseHtmlTags = {
        area: 1,
        base: 1,
        br: 1,
        col: 1,
        command: 1,
        embed: 1,
        hr: 1,
        img: 1,
        input: 1,
        keygen: 1,
        link: 1,
        meta: 1,
        param: 1,
        source: 1,
        wbr: 1
    };
    /**
     * External libs namespace.
     * @type {Object}
     */
    this.lib = {};
    this.utils = {
        _lastGenId: 0,
        bh: this,
        extend: function(target) {
            typeof target !== 'object' && (target = {});
            for(var i = 1, len = arguments.length; i < len; i++) {
                var obj = arguments[i];
                if(obj) {
                    for(var key in obj) {
                        obj.hasOwnProperty(key) && (target[key] = obj[key]);
                    }
                }
            }
            return target;
        },
        isArray: function (obj) {
            return Array.isArray(obj);
        },
        position: function () {
            var node = this.node;
            return node.index === 'content' ? 0 : node.index;
        },
        isFirst: function () {
            var node = this.node;
            return node.index === 'content' || node.index === 0;
        },
        isLast: function () {
            var node = this.node;
            return node.index === 'content' || node.index === node.arr.length - 1;
        },
        tParam: function (key, value) {
            var keyName = '__tp_' + key;
            if (arguments.length === 2) {
                this.node[keyName] = value;
            } else {
                var node = this.node;
                while (node) {
                    if (node.hasOwnProperty(keyName)) {
                        return node[keyName];
                    }
                    node = node.parentNode;
                }
            }
        },
        apply: function (bemjson) {
            return this.bh.processBemjson(bemjson);
        },
        generateId: function () {
            return 'uniq' + (this._lastGenId++);
        }
    };
}

BH.prototype = {

    /**
     * Enables or disables infinite loop detection.
     * @param {Boolean} enable
     */
    enableInfiniteLoopDetection: function(enable) {
        this._infiniteLoopDetection = enable;
    },

    /**
     * Converts BEMJSON to HTML code.
     * @param {Object|Array|String} bemjson
     */
    apply: function (bemjson) {
        return this.toHtml(this.processBemjson(bemjson));
    },

    /**
     * Declares matcher.
     * @example
     *
     *      bh.match('b-page', function(ctx) {
     *          ctx.mix.push({ block: 'i-ua' });
     *          ctx.cls = ctx.cls || 'i-ua_js_no i-ua_css_standard';
     *      });
     *
     *      bh.match('block_mod_modVal', function(ctx) {
     *          ctx.tag = ctx.tag || 'span';
     *      });
     *
     *      bh.match('block__elem', function(ctx) {
     *          ctx.attrs.disabled = 'disabled';
     *      });
     *
     *      bh.match('block__elem_elemMod_elemModVal', function(ctx) {
     *          ctx.mods.active = ctx.mods.active || 'yes';
     *      });
     *
     *      bh.match('block_blockMod_blockModVal__elem', function(ctx) {
     *          ctx.content = {
     *              elem: 'wrapper',
     *              content: ctx
     *          };
     *      });
     *
     * @param {String} expr
     * @param {Function} matcher
     */
    match: function (expr, matcher) {
        matcher.__id = '__func' + (this._lastMatchId++);
        this._matchers.push([expr, matcher]);
    },

    buildMatcher: function () {
        var i;
        var res = ['(function() {'];
        var vars = ['ms = this._matchers', 'bh = this'];
        var allMatchers = this._matchers;
        var currentBlock;
        var prevExpr;
        for (i = allMatchers.length - 1; i >= 0; i--) {
            vars.push('_m' + i + ' = ms[' + i + '][1]');
        }
        res.push('var ' + vars.join(', ') + ';');
        res.push('function applyMatchers(ctx) {');
        res.push('var subRes;');
        for (i = allMatchers.length - 1; i >= 0; i--) {
            var mi = allMatchers[i];
            var expr = mi[0];
            var decl = {};
            var exprBits;
            var blockExprBits;
            var jsCond = '';
            if (expr) {
                if (~expr.indexOf('__')) {
                    exprBits = expr.split('__');
                    blockExprBits = exprBits[0].split('_');
                    decl.block = blockExprBits[0];
                    if (blockExprBits.length > 1) {
                        decl.blockMod = blockExprBits[1];
                        decl.blockModVal = blockExprBits[2];
                    }
                    exprBits = exprBits[1].split('_');
                    decl.elem = exprBits[0];
                    if (exprBits.length > 1) {
                        decl.mod = exprBits[1];
                        decl.modVal = exprBits[2];
                    }
                } else {
                    exprBits = expr.split('_');
                    decl.block = exprBits[0];
                    if (exprBits.length > 1) {
                        decl.mod = exprBits[1];
                        decl.modVal = exprBits[2];
                    }
                }
            }
            if (currentBlock !== decl.block) {
                if (currentBlock) {
                    res.push('}');
                }
                currentBlock = decl.block;
                if (currentBlock) {
                    res.push('if (ctx.block === "' + currentBlock + '") {');
                }
            }
            var conds = [];
            decl.elem && conds.push('ctx.elem === "' + decl.elem + '"');
            decl.block && !decl.elem && conds.push('!ctx.elem');
            decl.mod && conds.push('ctx.mods && ctx.mods.' + decl.mod + ' === "' + decl.modVal + '"');
            if (decl.block && decl.blockMod) {
                conds.push('ctx.blockMods.' + decl.blockMod + ' === "' + decl.blockModVal + '"');
            }
            jsCond && conds.push(jsCond);
            conds.push('!ctx.' + mi[1].__id);
            res.push('if (' + conds.join(' && ') + ') {');
            res.push('ctx.' + mi[1].__id + ' = true;');
            var strFn = mi[1].toString();
            if (~strFn.indexOf('attrs')) {
                res.push('ctx.attrs = ctx.attrs || {};');
            }
            if (~strFn.indexOf('mods')) {
                res.push('ctx.mods = ctx.mods || {};');
            }
            if (~strFn.indexOf('mix')) {
                res.push('ctx.mix = ctx.mix || [];');
            }
            res.push('subRes = _m' + i + '(ctx);');
            res.push('if (subRes) { return subRes; }');
            res.push('}');
            prevExpr = expr;
        }
        if (currentBlock) {
            res.push('}');
        }
        res.push('};');
        res.push('return applyMatchers;');
        res.push('})');
        return res.join('\n');
    },

    processBemjson: function (bemjson, blockName) {
        var utils = this.utils;
        var resultArr = [bemjson];
        var nodes = [{ json: bemjson, arr: resultArr, index: 0, blockName: blockName, blockMods: bemjson.mods || {} }];
        var node, json, block, blockMods, i, l, p, child, subRes;
        var compiledMatcher = (this._fastMatcher || (this._fastMatcher = eval(this.buildMatcher()).call(this)));
        while (node = nodes.shift()) {
            json = node.json;
            block = node.blockName;
            blockMods = node.blockMods;
            if (Array.isArray(json)) {
                for (i = 0, l = json.length; i < l; i++) {
                    child = json[i];
                    if (child !== false && child != null && typeof child !== 'string') {
                        nodes.push({ json: child, arr: json, index: i, blockName: block, blockMods: blockMods, parentNode: node });
                    }
                }
            } else {
                var content, stopProcess = false;
                if (json.elem) {
                    block = json.block = json.block || block;
                    blockMods = json.blockMods = json.blockMods || blockMods;
                } else if (json.block) {
                    block = json.block;
                    blockMods = json.mods || (json.mods = {});
                }

                if (json.block) {

                    if (this._infiniteLoopDetection) {
                        json.__processCounter = (json.__processCounter || 0) + 1;
                        if (json.__processCounter > 100) {
                            throw new Error('Infinite loop detected at "' + json.block + (json.elem ? '__' + json.elem : '') + '".');
                        }
                    }

                    subRes = null;

                    utils.node = node;

                    subRes = compiledMatcher(json);

                    if (subRes) {
                        json = subRes;
                        node.json = json;
                        node.blockName = block;
                        node.blockMods = blockMods;
                        nodes.push(node);
                        stopProcess = true;
                    }
                }
                if (!stopProcess) {
                    if (Array.isArray(json)) {
                        node.json = json;
                        node.blockName = block;
                        node.blockMods = blockMods;
                        nodes.push(node);
                    } else {
                        if (content = json.content) {
                            if (Array.isArray(content)) {
                                do {
                                    var flatten = false;
                                    for (i = 0, l = content.length; i < l; i++) {
                                        if (Array.isArray(content[i])) {
                                            flatten = true;
                                            break;
                                        }
                                    }
                                    if (flatten) {
                                        var res = [];
                                        for (i = 0, l = content.length; i < l; i++) {
                                            res = res.concat(content[i]);
                                        }
                                        json.content = content = res;
                                    }
                                } while (flatten);
                                for (i = 0, l = content.length, p = l - 1; i < l; i++) {
                                    child = content[i];
                                    if (child !== false && child != null && typeof child !== 'string') {
                                        nodes.push({ json: child, arr: content, index: i, blockName: block, blockMods: blockMods, parentNode: node });
                                    }
                                }
                            } else {
                                nodes.push({ json: content, arr: json, index: 'content', blockName: block, blockMods: blockMods, parentNode: node });
                            }
                        }
                    }
                }
            }
            node.arr[node.index] = json;
        }
        return resultArr[0];
    },

    escapeAttr: function (attrVal) {
        return (attrVal + '').replace(/&/g, '&amp;')
               .replace(/"/g, '&quot;');
    },

    toHtml: function (json) {
        var res, i, l, item;
        if (json === false || json == null) return '';
        if (typeof json === 'string') {
            return json;
        }
        else if (Array.isArray(json)) {
            res = '';
            for (i = 0, l = json.length; i < l; i++) {
                item = json[i];
                if (item !== false && item != null) {
                    res += this.toHtml(item);
                }
            }
            return res;
        } else {
            var cls = json.bem !== false && json.block ? this.toBEMCssClasses(json, json.block) : '',
                jattr, attrs = '', jsParams, hasMixJsParams = false;

            if (jattr = json.attrs) {
                if (this._dirtyEnv) {
                    for (i in jattr) {
                        jattr.hasOwnProperty(i) && (attrs += ' ' + i + '="' + this.escapeAttr(jattr[i]) + '"');
                    }
                } else {
                    for (i in jattr) {
                        attrs += ' ' + i + '="' + this.escapeAttr(jattr[i]) + '"';
                    }
                }
            }

            if (json.js) {
                (jsParams = {})[json.block + (json.elem ? '__' + json.elem : '')] = json.js === true ? {} : json.js;
            }

            var mixes = json.mix;
            if (mixes && mixes.length) {
                for (i = 0, l = mixes.length; i < l; i++) {
                    var mix = mixes[i];
                    if (mix.js) {
                        (jsParams = jsParams || {})[(mix.block || json.block) + (mix.elem ? '__' + mix.elem : '')] = mix.js === true ? {} : mix.js;
                        hasMixJsParams = true;
                    }
                }
            }

            if (jsParams) {
                if (json.bem !== false) {
                    cls = cls + ' i-bem';
                }
            }

            if (jsParams) {
                attrs += (json.jsAttr || 'onclick') + '="return ' +
                    (!hasMixJsParams && json.js === true
                        ? '{&quot;' + json.block + (json.elem ? '__' + json.elem : '') + '&quot;:{}}'
                        : this.escapeAttr(JSON.stringify(jsParams))) + ';"';
            }

            json.cls && (cls = cls ? cls + ' ' + json.cls : json.cls);

            var content, tag = (json.tag || 'div');
            res = '<' + tag + (cls ? ' class="' + cls + '"' : '') + (attrs ? attrs : '');

            if (this._selfCloseHtmlTags[tag]) {
                res += '/>';
            } else {
                res += '>';
                if (content = json.content) {
                    if (Array.isArray(content)) {
                        for (i = 0, l = content.length; i < l; i++) {
                            item = content[i];
                            if (item !== false && item != null) {
                                res += this.toHtml(item);
                            }
                        }
                    } else {
                        res += this.toHtml(content);
                    }
                }
                res += '</' + tag + '>';
            }
            return res;
        }
    },

    toBEMCssClasses: function (json, blockName) {
        var mods, res, base = (json.block || blockName)
            + (json.elem ? '__' + json.elem : ''), mix, i, l;
        res = base;
        if (mods = json.mods) {
            if (this._dirtyEnv) {
                for (i in mods) {
                    mods.hasOwnProperty(i) && (res += ' ' + base + '_' + i + '_' + mods[i]);
                }
            } else {
                for (i in mods) {
                    res += ' ' + base + '_' + i + '_' + mods[i];
                }
            }
        }
        if ((mix = json.mix) && (l = mix.length)) {
            for (i = 0; i < l; i++) {
                res += ' ' + this.toBEMCssClasses(mix[i], blockName);
            }
        }
        return res;
    }

};

module.exports = BH;