/* custom_rule.js */
// 1回の execute で許容する命令ステップ数の上限。
// repeat のネスト等で無限ループ的にイベントループを占有するDoSを防ぐ。
const MAX_EXECUTION_STEPS = 10000000;
const CustomRuleDefaults = (() => {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
        return require('./custom_rule_defaults.js');
    }

    const EVENT_NAMES = ['initialization', 'correct', 'wrong', 'through', 'push', 'next', 'judge'];
    const PROTECTED_NAMES = [
        'id', 'name', 'socketId', 'flavorText', 'customData', 'status', 'winRank',
        'sessionId', 'isPressed', 'delay', 'isAnswerer', 'time', 'isLocked',
        'isTeamLocked', 'joinTime', 'lastOrder', 'mt', 'isReach', 'isLoseReach', 'isSpectator',
        'cardColor', 'managementNumber', 'buzzDelayMs'
    ];
    const RESERVED_WORDS = [
        'def', 'if', 'elif', 'else', 'scope', 'repeat', 'switch', 'case',
        'default', 'const', 'pass', 'true', 'false', 'True', 'False',
        'and', 'or', 'not', 'win', 'lose', 'lock', 'unlock', 'tLock',
        'tUnlock', 'tlock', 'tunlock', 'throughAns', 'mark'
    ];
    const RESERVED_FUNCTION_NAMES = [
        ...EVENT_NAMES,
        'win', 'lose', 'lock', 'unlock', 'tLock', 'tUnlock', 'tlock', 'tunlock', 'throughAns',
        'othersAdd', 'othersSet', 'others_add', 'others_set', 'uAdd', 'uSet', 'tAdd', 'tSet',
        'giveAns', 'setBorderColor', 'resetBorderColor', 'flashBorderColor',
        'setW', 'setX', 'setY', 'setZ', 'addW', 'addX', 'addY', 'addZ',
        'broadcast', 'resetVar', 'setFlavorText', 'resetFlavorText',
        'floor', 'ceil', 'round', 'abs', 'sqrt', 'pow', 'sign', 'max', 'min', 'clamp',
        'rand', 'random', 'not', 'tProd', 'tSum', 'tMax', 'tMin', 'tCount',
        'rankVal', 'countIf', 'getPushRank', 'sync', 'keep'
    ];
    function createDefaultConfig() {
        return {
            x: { label: null, sync: false, color: null, size: 'normal', keep: false },
            y: { label: null, sync: false, color: null, size: 'normal', keep: false },
            z: { label: null, sync: false, color: null, size: 'normal', keep: false },
            w: { label: null, sync: false, color: null, size: 'normal', keep: false },
            maxAns: 1,
            missMark: '×',
            missKeep: false,
            winText: null,
            showWinRank: true,
            sortByWinRank: false,
            sortByPressOrder: true
        };
    }
    function createEmptyAst() {
        return Object.fromEntries(EVENT_NAMES.map(eventName => [eventName, []]));
    }
    return {
        EVENT_NAMES,
        PROTECTED_NAMES,
        RESERVED_WORDS,
        RESERVED_FUNCTION_NAMES,
        createDefaultConfig,
        createEmptyAst
    };
})();
const {
    EVENT_NAMES,
    PROTECTED_NAMES,
    RESERVED_WORDS,
    RESERVED_FUNCTION_NAMES,
    createDefaultConfig,
    createEmptyAst
} = CustomRuleDefaults;

class CustomRuleEngine {
    constructor() {
        this.config = createDefaultConfig();
        this.initialState = {};
        this.constants = {};
        this.constantDescriptions = {};
        this.userFunctions = {};
        this.eventParams = {};
        this._steps = 0; // execute ごとにリセットする実行ステップカウンタ
        this.description = "";
        this.ruleName = "";

        this.ast = createEmptyAst();

        this.protectedNames = new Set(PROTECTED_NAMES);
        this.reservedWords = new Set(RESERVED_WORDS);
        this.eventNames = new Set(EVENT_NAMES);
        this.reservedFunctionNames = new Set(RESERVED_FUNCTION_NAMES);
    }

    isSafeColorValue(value) {
        return /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla)\([^)]*\))$/.test(value || '');
    }

    normalizeSpecialVariable(name, value) {
        const key = this.canonicalVariableName(name);
        if (key === 'miss') return Math.max(0, Math.floor(Number(value) || 0));
        if (key === 'buzzDelayMs') return Math.max(0, Math.min(60000, Math.floor(Number(value) || 0)));
        return value;
    }

    canonicalVariableName(name) {
        if (name === 'mark') return 'miss';
        if (name === 'buttonDelay') return 'buzzDelayMs';
        return name;
    }

    isProtectedName(name) {
        if (!name) return true;
        if (name.startsWith('_')) return true;
        if (this.protectedNames.has(name)) return true;
        if (this.reservedWords.has(name)) return true;
        return false;
    }

    assertWritableName(name, context = 'assignment') {
        const rawName = name && name.startsWith('my_') ? name.slice(3) : name;
        const actual = this.canonicalVariableName(rawName);
        if (rawName === 'buttonDelay') return;
        if (this.isProtectedName(actual)) {
            throw new Error(`${context}: "${name}" is reserved and cannot be written`);
        }
    }

    assertReadableVariableName(name, context = 'function') {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name || '')) {
            throw new Error(`${context}: invalid variable name "${name || ''}"`);
        }
    }

    assertCustomFunctionName(name) {
        this.assertReadableVariableName(name, 'def');
        if (this.reservedFunctionNames.has(name) || this.reservedWords.has(name)) {
            throw new Error(`def: "${name}" is reserved and cannot be defined as a custom function`);
        }
    }

    assertEventParamName(name, context = 'event parameter') {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name || '')) {
            throw new Error(`${context}: invalid parameter name "${name}"`);
        }
        this.assertWritableName(name, context);
    }

    tokenize(str) {
        const tokens = [];
        let i = 0;
        const expression = String(str || '');
        while (i < expression.length) {
            const char = expression[i];
            if (/\s/.test(char)) { i++; continue; }

            if (expression.startsWith('&&', i)) { tokens.push('and'); i += 2; continue; }
            if (expression.startsWith('||', i)) { tokens.push('or'); i += 2; continue; }
            if (expression.startsWith('==', i)) { tokens.push('=='); i += 2; continue; }
            if (expression.startsWith('!=', i)) { tokens.push('!='); i += 2; continue; }
            if (expression.startsWith('>=', i)) { tokens.push('>='); i += 2; continue; }
            if (expression.startsWith('<=', i)) { tokens.push('<='); i += 2; continue; }

            if (char === '"' || char === "'") {
                const quote = char;
                let value = '';
                i++;
                while (i < expression.length) {
                    const ch = expression[i];
                    if (ch === '\\') {
                        const next = expression[i + 1];
                        if (next === 'n') value += '\n';
                        else if (next === 't') value += '\t';
                        else if (next === quote || next === '\\') value += next;
                        else value += next ?? '';
                        i += 2;
                        continue;
                    }
                    if (ch === quote) {
                        i++;
                        tokens.push({ type: 'str', val: value });
                        value = null;
                        break;
                    }
                    value += ch;
                    i++;
                }
                if (value !== null) throw new Error(`Unclosed string literal in expression "${expression}"`);
                continue;
            }

            if (/[\d.]/.test(char)) {
                let numStr = char;
                i++;
                while (i < expression.length && /[\d.]/.test(expression[i])) { numStr += expression[i]; i++; }
                if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(numStr)) {
                    throw new Error(`Invalid number "${numStr}" in expression "${expression}"`);
                }
                tokens.push({ type: 'num', val: Number(numStr) });
                continue;
            }
            if (/[a-zA-Z_]/.test(char)) {
                let word = char;
                i++;
                while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) { word += expression[i]; i++; }

                if (word === 'and' || word === 'or') {
                    tokens.push(word);
                    continue;
                }
                if (word === 'true' || word === 'True') {
                    tokens.push({ type: 'num', val: 1 });
                    continue;
                }
                if (word === 'false' || word === 'False') {
                    tokens.push({ type: 'num', val: 0 });
                    continue;
                }

                let tempI = i;
                while (tempI < expression.length && /\s/.test(expression[tempI])) { tempI++; }

                if (tempI < expression.length && expression[tempI] === '(') {
                    let depth = 1, start = tempI + 1, j = tempI + 1;
                    while (j < expression.length && depth > 0) {
                        if (expression[j] === '(') depth++;
                        if (expression[j] === ')') depth--;
                        j++;
                    }
                    if (depth !== 0) {
                        throw new Error(`Unclosed function call "${word}(...)" in expression "${expression}"`);
                    }
                    const argsContent = expression.substring(start, j - 1);
                    i = j;
                    if (word === 'floor') {
                        tokens.push({ type: 'floor', value: this.parseExpression(argsContent) });
                    } else if (word === 'sqrt') {
                        tokens.push({ type: 'sqrt', value: this.parseExpression(argsContent) });
                    } else if (word === 'round') {
                        tokens.push({ type: 'round', value: this.parseExpression(argsContent) });
                    } else if (word === 'pow') {
                        const args = this.splitArgs(argsContent);
                        tokens.push({ type: 'pow', left: this.parseExpression(args[0] || "0"), right: this.parseExpression(args[1] || "0") });
                    } else if (word === 'rand') {
                        const args = this.splitArgs(argsContent);
                        tokens.push({ type: 'rand', min: this.parseExpression(args[0] || "0"), max: this.parseExpression(args[1] || "0") });
                    } else if (word === 'random') {
                        tokens.push({ type: 'random', max: this.parseExpression(argsContent || "0") });
                    } else if (word === 'tProd') {
                        const targetVar = argsContent.trim();
                        this.assertReadableVariableName(targetVar, 'tProd');
                        tokens.push({ type: 'tProd', varName: this.canonicalVariableName(targetVar) });
                    } else if (word === 'rankVal') {
                        const args = this.splitArgs(argsContent);
                        const varName = args[0]?.trim();
                        this.assertReadableVariableName(varName, 'rankVal');
                        const rankExpr = this.parseExpression(args[1] || '1');
                        tokens.push({ type: 'rankVal', varName: this.canonicalVariableName(varName), rankExpr });
                    } else if (word === 'abs') {
                        tokens.push({ type: 'abs', value: this.parseExpression(argsContent) });
                    } else if (word === 'ceil') {
                        tokens.push({ type: 'ceil', value: this.parseExpression(argsContent) });
                    } else if (word === 'sign') {
                        tokens.push({ type: 'sign', value: this.parseExpression(argsContent) });
                    } else if (word === 'not') {
                        tokens.push({ type: 'not', value: this.parseExpression(argsContent) });
                    } else if (word === 'max') {
                        const args = this.splitArgs(argsContent);
                        tokens.push({ type: 'max', left: this.parseExpression(args[0] || "0"), right: this.parseExpression(args[1] || "0") });
                    } else if (word === 'min') {
                        const args = this.splitArgs(argsContent);
                        tokens.push({ type: 'min', left: this.parseExpression(args[0] || "0"), right: this.parseExpression(args[1] || "0") });
                    } else if (word === 'clamp') {
                        const args = this.splitArgs(argsContent);
                        tokens.push({ type: 'clamp', value: this.parseExpression(args[0] || "0"), lo: this.parseExpression(args[1] || "0"), hi: this.parseExpression(args[2] || "0") });
                    } else if (word === 'tSum') {
                        const targetVar = argsContent.trim();
                        this.assertReadableVariableName(targetVar, 'tSum');
                        tokens.push({ type: 'tAdd', varName: this.canonicalVariableName(targetVar) });
                    } else if (word === 'tMax') {
                        const targetVar = argsContent.trim();
                        this.assertReadableVariableName(targetVar, 'tMax');
                        tokens.push({ type: 'tMax', varName: this.canonicalVariableName(targetVar) });
                    } else if (word === 'tMin') {
                        const targetVar = argsContent.trim();
                        this.assertReadableVariableName(targetVar, 'tMin');
                        tokens.push({ type: 'tMin', varName: this.canonicalVariableName(targetVar) });
                    } else if (word === 'tCount') {
                        const targetVar = argsContent.trim();
                        this.assertReadableVariableName(targetVar, 'tCount');
                        tokens.push({ type: 'tCount', varName: this.canonicalVariableName(targetVar) });
                    } else if (word === 'countIf') {
                        tokens.push({ type: 'countIf', condition: this.parseExpression(argsContent) });
                    } else if (word === 'getPushRank') {
                        tokens.push({ type: 'getPushRank' });
                    } else {
                        throw new Error(`Unknown function "${word}" in expression "${expression}"`);
                    }
                } else {
                    tokens.push({ type: 'var', name: word });
                }
                continue;
            }
            if ('>'.includes(char)) { tokens.push('>'); i++; continue; }
            if ('<'.includes(char)) { tokens.push('<'); i++; continue; }
            if ('+-*/%^()'.includes(char)) { tokens.push(char); i++; continue; }
            throw new Error(`Unexpected character "${char}" in expression "${expression}"`);
        }
        return tokens;
    }

    parseExpression(str) {
        if (str === undefined || str === null || String(str).trim() === '') return [];
        const tokens = this.tokenize(str);
        const outputQueue = [];
        const operatorStack = [];

        const precedence = {
            'u+': 7, 'u-': 7,
            '^': 6,
            '*': 5, '/': 5, '%': 5,
            '+': 4, '-': 4,
            '>': 3, '<': 3, '>=': 3, '<=': 3, '==': 3, '!=': 3,
            'and': 2,
            'or': 1
        };
        const associativity = { '^': 'Right', 'u+': 'Right', 'u-': 'Right' };

        let expectOperand = true;
        tokens.forEach(token => {
            if (typeof token === 'object') {
                if (!expectOperand) throw new Error(`Missing operator before value in expression "${str}"`);
                outputQueue.push(token);
                expectOperand = false;
            }
            else if (token === '(') {
                if (!expectOperand) throw new Error(`Missing operator before "(" in expression "${str}"`);
                operatorStack.push(token);
                expectOperand = true;
            }
            else if (token === ')') {
                if (expectOperand) throw new Error(`Missing value before ")" in expression "${str}"`);
                while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') { outputQueue.push(operatorStack.pop()); }
                if (operatorStack.length === 0) throw new Error(`Unmatched ")" in expression "${str}"`);
                operatorStack.pop();
                expectOperand = false;
            } else if (precedence[token]) {
                if (expectOperand) {
                    if (token === '+') token = 'u+';
                    else if (token === '-') token = 'u-';
                    else throw new Error(`Missing value before "${token}" in expression "${str}"`);
                }
                while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(' &&
                    (precedence[token] < precedence[operatorStack[operatorStack.length - 1]] ||
                        (precedence[token] === precedence[operatorStack[operatorStack.length - 1]] && associativity[token] !== 'Right'))) {
                    outputQueue.push(operatorStack.pop());
                }
                operatorStack.push(token);
                expectOperand = true;
            }
        });
        if (expectOperand && tokens.length > 0) throw new Error(`Expression ends with an operator: "${str}"`);
        while (operatorStack.length > 0) {
            const op = operatorStack.pop();
            if (op === '(') throw new Error(`Unclosed "(" in expression "${str}"`);
            outputQueue.push(op);
        }
        return outputQueue;
    }

    splitArgs(str) {
        const args = [];
        let depth = 0, start = 0;
        for (let i = 0; i < str.length; i++) {
            if (str[i] === '(') depth++;
            if (str[i] === ')') {
                depth--;
                if (depth < 0) throw new Error(`Unmatched ")" in argument list "${str}"`);
            }
            if (str[i] === ',' && depth === 0) {
                args.push(str.substring(start, i));
                start = i + 1;
            }
        }
        if (depth !== 0) throw new Error(`Unclosed "(" in argument list "${str}"`);
        args.push(str.substring(start));
        return args;
    }

    findCommentIndex(line) {
        let quote = null;
        let escaped = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (quote) {
                if (ch === quote) quote = null;
                continue;
            }
            if (ch === '"' || ch === "'") {
                quote = ch;
                continue;
            }
            if (ch === '#') return i;
        }
        return -1;
    }

    stripComment(line) {
        const idx = this.findCommentIndex(line);
        return idx >= 0 ? line.substring(0, idx) : line;
    }

    extractComment(line) {
        const idx = this.findCommentIndex(line);
        return idx >= 0 ? line.substring(idx + 1).trim() : "";
    }

    parseSingleCommand(content) {
        content = content.trim();
        if (!content) return null;

        const winTextMatch = content.match(/^winText\s*(=|\+=)\s*(.+)$/);
        if (winTextMatch) {
            return {
                type: 'setWinText',
                op: winTextMatch[1],
                value: this.parseMetadataTextExpression(winTextMatch[2])
            };
        }

        const showWinRankMatch = content.match(/^showWinRank\s*=\s*(true|false|True|False)$/);
        if (showWinRankMatch) {
            return {
                type: 'setShowWinRank',
                value: showWinRankMatch[1].toLowerCase() === 'true'
            };
        }

        const lockWithValueMatch = content.match(/^lock\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)$/);
            if (lockWithValueMatch) {
                return { type: 'call', func: 'lock', lockDisplayKey: this.canonicalVariableName(lockWithValueMatch[1]) };
        }

        if (['win()', 'lose()', 'pass', 'lock()', 'unlock()', 'tLock()', 'tUnlock()', 'tlock()', 'tunlock()', 'throughAns()'].includes(content.replace(/\s/g, ''))) {
            if (content === 'pass') return { type: 'pass' };
            return { type: 'call', func: content.replace(/\s*\(\s*\)/, '') };
        }

        const othersMatch =
            content.match(/^others(Add|Set)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*(.+)\s*\)$/) ||
            content.match(/^others_(add|set)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*(.+)\s*\)$/);
        if (othersMatch) {
            this.assertWritableName(othersMatch[2], 'others');
            return { type: 'others', mode: othersMatch[1].toLowerCase(), target: this.canonicalVariableName(othersMatch[2]), value: this.parseExpression(othersMatch[3]) };
        }

        const uMatch = content.match(/^u(Add|Set)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*(.+)\s*\)$/);
        if (uMatch) {
            this.assertWritableName(uMatch[2], 'uAdd/uSet');
            const mode = uMatch[1] === 'Add' ? 'add' : 'set';
            return { type: 'others', mode: mode, target: this.canonicalVariableName(uMatch[2]), value: this.parseExpression(uMatch[3]) };
        }

        const tMatch = content.match(/^t(Add|Set)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*(.+)\s*\)$/);
        if (tMatch) {
            this.assertWritableName(tMatch[2], 'tAdd/tSet');
            const mode = tMatch[1] === 'Add' ? 'add' : 'set';
            return { type: 'team', mode: mode, target: this.canonicalVariableName(tMatch[2]), value: this.parseExpression(tMatch[3]) };
        }

        const giveAnsMatch = content.match(/^giveAns\s*\(\s*(.+)\s*\)$/);
        if (giveAnsMatch) {
            return { type: 'giveAns', condition: this.parseExpression(giveAnsMatch[1]) };
        }

        const assignMatch = content.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(\+=|-=|\*=|(=))\s*(.+)$/);
        if (assignMatch) {
                const [_, v, op, eq, exprStr] = assignMatch;
                this.assertWritableName(v, 'assignment');
                return { type: 'assign', var: this.canonicalVariableName(v), op: eq || op, expr: this.parseExpression(exprStr) };
        }

        const statSizeCommandMatch = content.match(/^([wxyz])\.size\s*=\s*(?:"(normal|small|通常|小さめ)"|'(normal|small|通常|小さめ)'|(normal|small|通常|小さめ))$/);
        if (statSizeCommandMatch) {
            const sizeValue = statSizeCommandMatch[2] || statSizeCommandMatch[3] || statSizeCommandMatch[4];
            return { type: 'setStatSize', key: statSizeCommandMatch[1], size: (sizeValue === 'small' || sizeValue === '小さめ') ? 'small' : 'normal' };
        }

        const statColorCommandMatch = content.match(/^([wxyz])\.color\s*=\s*["'](.*?)["']$/);
        if (statColorCommandMatch) {
            const color = statColorCommandMatch[2].trim();
            if (color && !this.isSafeColorValue(color)) {
                throw new Error(`color: invalid color value "${color}"`);
            }
            return { type: 'setStatColor', key: statColorCommandMatch[1], color: color || null };
        }

        const setBorderColorMatch = content.match(/^setBorderColor\s*\(\s*['"]((#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla)\([^)]*\)))['"]\s*\)$/);
        if (setBorderColorMatch) {
            return { type: 'setBorderColor', color: setBorderColorMatch[1] };
        }
        if (content.replace(/\s/g, '') === 'resetBorderColor()') {
            return { type: 'resetBorderColor' };
        }

        const flashBorderColorMatch = content.match(/^flashBorderColor\s*\(\s*['"]((#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla)\([^)]*\)))['"]\s*(?:,\s*(\d+))?\s*\)$/);
        if (flashBorderColorMatch) {
            return { type: 'flashBorderColor', color: flashBorderColorMatch[1], duration: flashBorderColorMatch[3] ? parseInt(flashBorderColorMatch[3]) : 1000 };
        }

        const setAddXYZMatch = content.match(/^(set|add)(W|X|Y|Z)\s*\(\s*(.+)\s*\)$/);
        if (setAddXYZMatch) {
            return { type: 'assign', var: setAddXYZMatch[2].toLowerCase(), op: setAddXYZMatch[1] === 'set' ? '=' : '+=', expr: this.parseExpression(setAddXYZMatch[3]) };
        }

        const broadcastMatch = content.match(/^broadcast\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*(.+)\s*\)$/);
        if (broadcastMatch) {
            this.assertWritableName(broadcastMatch[1], 'broadcast');
            return { type: 'broadcast', target: this.canonicalVariableName(broadcastMatch[1]), value: this.parseExpression(broadcastMatch[2]) };
        }

        const resetVarMatch = content.match(/^resetVar\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)$/);
        if (resetVarMatch) {
                this.assertWritableName(resetVarMatch[1], 'resetVar');
                return { type: 'resetVar', var: this.canonicalVariableName(resetVarMatch[1]) };
        }

        const setFlavorTextMatch = content.match(/^setFlavorText\s*\(\s*["'](.*)["']\s*\)$/);
        if (setFlavorTextMatch) {
            return { type: 'setFlavorText', text: setFlavorTextMatch[1] };
        }
        if (content.replace(/\s/g, '') === 'resetFlavorText()') {
            return { type: 'resetFlavorText' };
        }

        const userFunctionCallMatch = content.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)$/);
        if (userFunctionCallMatch) {
            const funcName = userFunctionCallMatch[1];
            if (this.reservedFunctionNames.has(funcName)) return null;
            return { type: 'userFunc', name: funcName };
        }

        return null;
    }

    parseMetadataTextExpression(expr, lineNo = 0) {
        const parts = [];
        let current = '';
        let quote = null;
        let escape = false;
        let depth = 0;
        const text = String(expr || '');
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (quote) {
                current += ch;
                if (escape) {
                    escape = false;
                } else if (ch === '\\') {
                    escape = true;
                } else if (ch === quote) {
                    quote = null;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                quote = ch;
                current += ch;
                continue;
            }
            if (ch === '(') depth++;
            else if (ch === ')' && depth > 0) depth--;
            if (ch === '+' && depth === 0) {
                parts.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        if (quote) throw new Error(`Line ${lineNo}: unclosed string in metadata expression`);
        parts.push(current.trim());

        const evalContext = {
            ...this.initialState,
            ...this.constants,
            maxAns: this.config.maxAns
        };
        const parseStringLiteral = (part) => {
            const q = part[0];
            let out = '';
            for (let i = 1; i < part.length - 1; i++) {
                const ch = part[i];
                if (ch !== '\\') {
                    out += ch;
                    continue;
                }
                i++;
                const next = part[i];
                if (next === 'n') out += '\n';
                else if (next === 't') out += '\t';
                else if (next === 'r') out += '\r';
                else if (next === q || next === '\\') out += next;
                else out += next ?? '';
            }
            return out;
        };

        return parts.map(part => {
            if (!part) throw new Error(`Line ${lineNo}: empty part in metadata expression`);
            if ((part[0] === '"' || part[0] === "'") && part[part.length - 1] === part[0]) {
                return parseStringLiteral(part);
            }
            if (part === 'rule' || part === 'name') return this.ruleName || '';
            if (part === 'description' || part === 'desc') return this.description || '';
            try {
                return String(this.evaluateRPN(this.parseExpression(part), evalContext));
            } catch (e) {
                throw new Error(`Line ${lineNo}: invalid metadata expression "${part}": ${e.message}`);
            }
        }).join('');
    }

    parse(code) {
        const lines = code.split(/\r?\n/);
        this.initialState = {};
        this.constants = {};
        this.constantDescriptions = {};
        this.userFunctions = {};
        this.eventParams = {};
        this.ast = createEmptyAst();
        this.config = createDefaultConfig();
        this.description = "";
        this.ruleName = "";
        this._configChanged = false;
        delete this._previousWinText;

        let currentDef = 'initialization';
        let stack = [{ indent: -1, commands: this.ast[currentDef] }];
        let pendingConstDescription = null;
        let lastConstName = null;
        let lastConstAcceptsDescription = false;
        let parseTimeMetadataBranch = null;

        const evalParseTimeCondition = (conditionStr, lineNo) => {
            try {
                return !!this.evaluateRPN(this.parseExpression(conditionStr), {
                    ...this.initialState,
                    ...this.constants,
                    maxAns: this.config.maxAns
                });
            } catch (e) {
                throw new Error(`Line ${lineNo}: invalid parse-time if condition "${conditionStr}": ${e.message}`);
            }
        };

        const applyMetadataAssignment = (content, shouldApply, lineNo = 0) => {
            const metadataMatch = content.match(/^(description|desc|rule|name|winText)\s*(=|\+=)\s*(.+)$/);
            if (metadataMatch) {
                const [, key, op, expr] = metadataMatch;
                if (shouldApply) {
                    const value = this.parseMetadataTextExpression(expr, lineNo);
                    if (key === 'description' || key === 'desc') {
                        this.description = op === '+=' ? (this.description || '') + value : value;
                    } else if (key === 'winText') {
                        this.config.winText = op === '+=' ? (this.config.winText || '') + value : value;
                    } else {
                        this.ruleName = op === '+=' ? (this.ruleName || '') + value : value;
                    }
                }
                return true;
            }
            return false;
        };

        lines.forEach((rawLine, index) => {
            const comment = this.extractComment(rawLine);
            let line = this.stripComment(rawLine);
            if (!line.trim()) {
                if (comment) {
                    const taggedDesc = comment.match(/^@?const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?::|=|-)?\s*(.+)$/i);
                    const namedDesc = comment.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*(.+)$/);
                    if (taggedDesc) {
                        const text = (taggedDesc[2] || "").trim();
                        if (text) this.constantDescriptions[taggedDesc[1]] = text;
                        pendingConstDescription = text ? { name: taggedDesc[1], text } : null;
                        if (lastConstAcceptsDescription && lastConstName === taggedDesc[1] && text) {
                            this.constantDescriptions[lastConstName] = text;
                            lastConstAcceptsDescription = false;
                        }
                    } else if (namedDesc && lastConstAcceptsDescription && namedDesc[1] === lastConstName) {
                        const text = namedDesc[2].trim();
                        if (text) this.constantDescriptions[lastConstName] = text;
                        lastConstAcceptsDescription = false;
                        pendingConstDescription = null;
                    } else if (lastConstAcceptsDescription && lastConstName) {
                        this.constantDescriptions[lastConstName] = comment;
                        lastConstAcceptsDescription = false;
                        pendingConstDescription = null;
                    } else {
                        pendingConstDescription = { name: null, text: comment };
                    }
                }
                return;
            }

            const indentMatch = line.match(/^(\s*)/);
            const indentLevel = indentMatch ? indentMatch[1].length : 0;
            const content = line.trim();

            if (currentDef === 'initialization') {
                if (indentLevel === 0) {
                    const parseIfMatch = content.match(/^if\s+(.+):\s*(.*)$/);
                    const parseElifMatch = content.match(/^elif\s+(.+):\s*(.*)$/);
                    const parseElseMatch = content.match(/^else:\s*(.*)$/);
                    if (parseIfMatch) {
                        const branchActive = evalParseTimeCondition(parseIfMatch[1], index + 1);
                        parseTimeMetadataBranch = {
                            active: branchActive,
                            branchTaken: branchActive,
                            bodyIndent: null
                        };
                        const inlineCmd = parseIfMatch[2] ? parseIfMatch[2].trim() : '';
                        if (inlineCmd && applyMetadataAssignment(inlineCmd, branchActive, index + 1)) return;
                    } else if (parseElifMatch && parseTimeMetadataBranch) {
                        const branchActive = !parseTimeMetadataBranch.branchTaken && evalParseTimeCondition(parseElifMatch[1], index + 1);
                        parseTimeMetadataBranch.active = branchActive;
                        parseTimeMetadataBranch.branchTaken = parseTimeMetadataBranch.branchTaken || branchActive;
                        parseTimeMetadataBranch.bodyIndent = null;
                        const inlineCmd = parseElifMatch[2] ? parseElifMatch[2].trim() : '';
                        if (inlineCmd && applyMetadataAssignment(inlineCmd, branchActive, index + 1)) return;
                    } else if (parseElseMatch && parseTimeMetadataBranch) {
                        const branchActive = !parseTimeMetadataBranch.branchTaken;
                        parseTimeMetadataBranch.active = branchActive;
                        parseTimeMetadataBranch.branchTaken = true;
                        parseTimeMetadataBranch.bodyIndent = null;
                        const inlineCmd = parseElseMatch[1] ? parseElseMatch[1].trim() : '';
                        if (inlineCmd && applyMetadataAssignment(inlineCmd, branchActive, index + 1)) return;
                    } else {
                        parseTimeMetadataBranch = null;
                    }
                } else if (parseTimeMetadataBranch && parseTimeMetadataBranch.bodyIndent === null) {
                    parseTimeMetadataBranch.bodyIndent = indentLevel;
                }
            }

            while (stack.length > 1 && indentLevel <= stack[stack.length - 1].indent) {
                stack.pop();
            }
            const currentCommandList = stack[stack.length - 1].commands;

            const defMatch = content.match(/^def\s+(correct|wrong|through|push|next|judge)\(([^)]*)\):$/);
            if (defMatch) {
                currentDef = defMatch[1];
                const params = defMatch[2].trim()
                    ? defMatch[2].split(',').map(v => v.trim()).filter(Boolean)
                    : [];
                params.forEach(param => this.assertEventParamName(param, `Line ${index + 1}`));
                this.eventParams[currentDef] = params;
                stack = [{ indent: -1, commands: this.ast[currentDef] }];
                return;
            }

            const customDefMatch = content.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\(\):$/);
            if (customDefMatch) {
                const funcName = customDefMatch[1];
                this.assertCustomFunctionName(funcName);
                if (this.userFunctions[funcName]) {
                    throw new Error(`Line ${index + 1}: function "${funcName}" is already defined`);
                }
                this.userFunctions[funcName] = [];
                currentDef = `function:${funcName}`;
                stack = [{ indent: -1, commands: this.userFunctions[funcName] }];
                return;
            }

            const constMatch = content.match(/^const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
            if (constMatch) {
                const [_, name, exprStr] = constMatch;
                this.assertWritableName(name, 'const');
                const val = this.evaluateRPN(this.parseExpression(exprStr), { ...this.constants });
                this.constants[name] = val;
                this.initialState[name] = val;
                const pendingMatches = pendingConstDescription && (!pendingConstDescription.name || pendingConstDescription.name === name);
                const description = comment || (pendingMatches ? pendingConstDescription.text : "") || this.constantDescriptions[name] || "";
                if (description) this.constantDescriptions[name] = description;
                pendingConstDescription = null;
                lastConstName = name;
                lastConstAcceptsDescription = !description;
                return;
            }

            pendingConstDescription = null;
            lastConstAcceptsDescription = false;
            lastConstName = null;

            if (indentLevel === 0) {
                const labelMatch = content.match(/^([wxyz])\.label\s*=\s*["'](.*)["']$/);
                if (labelMatch) { this.config[labelMatch[1]].label = labelMatch[2]; return; }

                const colorMatch = content.match(/^([wxyz])\.color\s*=\s*["'](.*?)["']$/);
                if (colorMatch) {
                    const color = colorMatch[2].trim();
                    if (color && !this.isSafeColorValue(color)) throw new Error(`Line ${index + 1}: invalid color value "${color}"`);
                    this.config[colorMatch[1]].color = color || null;
                    return;
                }

                const sizeMatch = content.match(/^([wxyz])\.size\s*=\s*(?:"(normal|small|通常|小さめ)"|'(normal|small|通常|小さめ)'|(normal|small|通常|小さめ))$/);
                if (sizeMatch) {
                    const sizeValue = sizeMatch[2] || sizeMatch[3] || sizeMatch[4];
                    this.config[sizeMatch[1]].size = (sizeValue === 'small' || sizeValue === '小さめ') ? 'small' : 'normal';
                    return;
                }

                const markSymbolMatch = content.match(/^(?:mark\.symbol|miss\.mark)\s*=\s*["'](.{1,8})["']$/);
                if (markSymbolMatch) {
                    this.config.missMark = markSymbolMatch[1] || '×';
                    return;
                }
            }

            const syncMatch = content.match(/^sync\(([wxyz])\)$/);
            if (syncMatch) {
                this.config[syncMatch[1]].sync = true;
                return;
            }

            const keepMatch = content.match(/^keep\((w|x|y|z|mark|miss)\)$/);
            if (keepMatch) {
                const keepKey = this.canonicalVariableName(keepMatch[1]);
                if (keepKey === 'miss') this.config.missKeep = true;
                else this.config[keepKey].keep = true;
                return;
            }

            const isParseTimeMetadataChild = currentDef === 'initialization'
                && parseTimeMetadataBranch
                && indentLevel > 0
                && indentLevel === parseTimeMetadataBranch.bodyIndent;
            const isInsideParseTimeMetadataBranch = currentDef === 'initialization'
                && parseTimeMetadataBranch
                && indentLevel > 0;
            const metadataShouldApply = !isInsideParseTimeMetadataBranch
                || (isParseTimeMetadataChild && parseTimeMetadataBranch.active);
            if (currentDef === 'initialization' && applyMetadataAssignment(content, metadataShouldApply, index + 1)) return;

            const maxAnsMatch = content.match(/^maxAns\s*=\s*(-?\d+)$/);
            if (maxAnsMatch) {
                let ma = parseInt(maxAnsMatch[1], 10);
                if (isNaN(ma)) ma = 1;
                this.config.maxAns = ma;
                return;
            }

            const showWinRankMatch = content.match(/^showWinRank\s*=\s*(true|false|True|False)$/);
            if (showWinRankMatch && currentDef === 'initialization') { this.config.showWinRank = showWinRankMatch[1].toLowerCase() === 'true'; return; }

            const sortByWinRankMatch = content.match(/^sortByWinRank\s*=\s*(true|false|True|False)$/);
            if (sortByWinRankMatch) { this.config.sortByWinRank = sortByWinRankMatch[1].toLowerCase() === 'true'; return; }

            const sortByPressOrderMatch = content.match(/^sortByPressOrder\s*=\s*(true|false|True|False)$/);
            if (sortByPressOrderMatch) { this.config.sortByPressOrder = sortByPressOrderMatch[1].toLowerCase() === 'true'; return; }

            const switchMatch = content.match(/^switch\s+(.+):$/);
            if (switchMatch) {
                if (!currentCommandList) throw new Error(`Line ${index + 1}: switch文はcase/defaultブロックの直下には記述できません。`);
                const switchNode = { type: 'switch', expr: this.parseExpression(switchMatch[1]), cases: [], default: [] };
                currentCommandList.push(switchNode);
                stack.push({ indent: indentLevel, commands: null, switchNode });
                return;
            }

            const caseMatch = content.match(/^case\s+(.+):$/);
            if (caseMatch) {
                let switchEntry = null;
                for (let si = stack.length - 1; si >= 0; si--) {
                    if (stack[si].switchNode) { switchEntry = stack[si]; break; }
                }
                if (!switchEntry) throw new Error(`Line ${index + 1}: caseに対応するswitchが見つかりません。`);
                const caseObj = { value: this.parseExpression(caseMatch[1]), commands: [] };
                switchEntry.switchNode.cases.push(caseObj);
                stack.push({ indent: indentLevel, commands: caseObj.commands });
                return;
            }

            if (content === 'default:') {
                let switchEntry = null;
                for (let si = stack.length - 1; si >= 0; si--) {
                    if (stack[si].switchNode) { switchEntry = stack[si]; break; }
                }
                if (!switchEntry) throw new Error(`Line ${index + 1}: defaultに対応するswitchが見つかりません。`);
                stack.push({ indent: indentLevel, commands: switchEntry.switchNode.default });
                return;
            }

            if (!currentCommandList) throw new Error(`Line ${index + 1}: switch文の直下にはcase/defaultのみ記述できます。\n"${content}"`);

            if (content === 'else:') {
                const lastCmd = currentCommandList.length > 0 ? currentCommandList[currentCommandList.length - 1] : null;
                let _targetIfElse = lastCmd;
                while (_targetIfElse && _targetIfElse.type === 'if' && _targetIfElse.else && _targetIfElse.else.length === 1 && _targetIfElse.else[0].type === 'if') {
                    _targetIfElse = _targetIfElse.else[0];
                }
                if (_targetIfElse && _targetIfElse.type === 'if') {
                    _targetIfElse.else = [];
                    stack.push({ indent: indentLevel, commands: _targetIfElse.else });
                    return;
                }
                throw new Error(`Line ${index + 1}: elseに対応するifが見つかりません。`);
            }

            const elifMatch = content.match(/^elif\s+(.+):\s*(.*)$/);
            if (elifMatch) {
                const [_, conditionStr, inlineCmd] = elifMatch;
                const lastCmdElif = currentCommandList.length > 0 ? currentCommandList[currentCommandList.length - 1] : null;
                let _targetIfElif = lastCmdElif;
                while (_targetIfElif && _targetIfElif.type === 'if' && _targetIfElif.else && _targetIfElif.else.length === 1 && _targetIfElif.else[0].type === 'if') {
                    _targetIfElif = _targetIfElif.else[0];
                }
                if (!_targetIfElif || _targetIfElif.type !== 'if') {
                    throw new Error(`Line ${index + 1}: elifに対応するifが見つかりません。`);
                }
                const newIfNode = { type: 'if', condition: this.parseExpression(conditionStr), then: [], else: [] };
                _targetIfElif.else = [newIfNode];
                if (inlineCmd && inlineCmd.trim()) {
                    const cmdNode = this.parseSingleCommand(inlineCmd.trim());
                    if (cmdNode) { newIfNode.then.push(cmdNode); }
                    else { throw new Error(`Line ${index + 1}: elif文の後のコマンド "${inlineCmd}" が解析できませんでした。`); }
                } else {
                    stack.push({ indent: indentLevel, commands: newIfNode.then });
                }
                return;
            }

            const scopeMatch = content.match(/^scope\s*\((.+)\):$/);
            if (scopeMatch) {
                const conditionStr = scopeMatch[1];
                const scopeNode = {
                    type: 'scope',
                    condition: this.parseExpression(conditionStr),
                    commands: []
                };
                currentCommandList.push(scopeNode);
                stack.push({ indent: indentLevel, commands: scopeNode.commands });
                return;
            }

            const repeatMatch = content.match(/^repeat\s+(.+):$/);
            if (repeatMatch) {
                const repeatNode = { type: 'repeat', count: this.parseExpression(repeatMatch[1]), commands: [] };
                currentCommandList.push(repeatNode);
                stack.push({ indent: indentLevel, commands: repeatNode.commands });
                return;
            }

            const ifMatch = content.match(/^if\s+(.+):\s*(.*)$/);
            if (ifMatch) {
                const [_, conditionStr, inlineCmd] = ifMatch;
                const ifNode = {
                    type: 'if',
                    condition: this.parseExpression(conditionStr),
                    then: [],
                    else: []
                };
                currentCommandList.push(ifNode);

                if (inlineCmd && inlineCmd.trim()) {
                    const cmdNode = this.parseSingleCommand(inlineCmd);
                    if (cmdNode) { ifNode.then.push(cmdNode); }
                    else { throw new Error(`Line ${index + 1}: if文の後のコマンド "${inlineCmd}" が解析できませんでした。`); }
                } else {
                    stack.push({ indent: indentLevel, commands: ifNode.then });
                }
                return;
            }

            const cmdNode = this.parseSingleCommand(content);
            if (cmdNode) {
                currentCommandList.push(cmdNode);
                if (currentDef === 'initialization' && cmdNode.type === 'assign' && cmdNode.op === '=') {
                    try {
                        const val = this.evaluateRPN(cmdNode.expr, { ...this.initialState, ...this.constants });
                        this.initialState[cmdNode.var] = val;
                    } catch (e) {
                        throw new Error(`Line ${index + 1}: invalid initialization expression for "${cmdNode.var}": ${e.message}`);
                    }
                }
                return;
            }

            throw new Error(`Line ${index + 1}: 不明な構文です。\n"${content}"`);
        });

        if (this.description) this.description = this.formatText(this.description);
        if (this.ruleName) this.ruleName = this.formatText(this.ruleName);
        if (typeof this.config.maxAns !== 'number' || this.config.maxAns < -1) { this.config.maxAns = 1; }
        this.validateUserFunctionReferences();

        return this;
    }

    validateUserFunctionReferences() {
        const walk = (commands, context) => {
            for (const cmd of commands || []) {
                if (cmd.type === 'userFunc' && !this.userFunctions[cmd.name]) {
                    throw new Error(`${context}: function "${cmd.name}" is not defined`);
                }
                if (cmd.type === 'if') {
                    walk(cmd.then, context);
                    walk(cmd.else, context);
                } else if (cmd.type === 'switch') {
                    for (const c of cmd.cases || []) walk(c.commands, context);
                    walk(cmd.default, context);
                } else if (cmd.type === 'repeat' || cmd.type === 'scope') {
                    walk(cmd.commands, context);
                }
            }
        };
        for (const [eventName, commands] of Object.entries(this.ast)) {
            walk(commands, `def ${eventName}()`);
        }
        for (const [funcName, commands] of Object.entries(this.userFunctions)) {
            walk(commands, `def ${funcName}()`);
        }
    }

    formatText(text) {
        if (!text) return "";
        return text.replace(/\[(.*?)\]/g, (match, expression) => {
            try {
                return String(this.evaluateRPN(this.parseExpression(expression), { ...this.constants }));
            } catch (e) {
                return match;
            }
        });
    }

    resolveVal(token, u, sender) {
        if (typeof token === 'number') return token;
        if (token.type === 'num') return token.val;
        if (token.type === 'str') return token.val;
        if (token.type === 'var') {
            if (token.name.startsWith('my_')) {
                const key = this.canonicalVariableName(token.name.substring(3));
                if (sender) {
                    return (sender[key] !== undefined) ? parseFloat(sender[key]) : 0;
                }
                return 0;
            }
            const name = this.canonicalVariableName(token.name);
            if (this.constants[name] !== undefined) return this.constants[name];
            if (u[name] === undefined) return 0;
            if (typeof u[name] === 'string') return u[name];
            return parseFloat(u[name]);
        }

        if (token.type === 'tProd') {
            const myVal = (u[token.varName] !== undefined) ? parseFloat(u[token.varName]) : 0;
            let othersVal = 1;

            if (u._teamOtherProds && u._teamOtherProds[token.varName] !== undefined) {
                othersVal = u._teamOtherProds[token.varName];
            } else {
                othersVal = 1;
            }
            return othersVal * myVal;
        }

        if (token.type === 'tAdd') {
            const myVal = parseFloat(u[token.varName]) || 0;
            const othersVal = (u._teamOtherSums && u._teamOtherSums[token.varName]) || 0;
            return othersVal + myVal;
        }

        if (token.type === 'rankVal') {
            const n = Math.round(this.evaluateRPN(token.rankExpr, u, sender));
            const arr = u._rankVals?.[token.varName];
            if (!arr || n < 1) return 0;
            return arr[n - 1] ?? 0;
        }

        if (token.type === 'floor') return Math.floor(this.evaluateRPN(token.value, u, sender));
        if (token.type === 'sqrt') return Math.sqrt(this.evaluateRPN(token.value, u, sender));
        if (token.type === 'round') return Math.round(this.evaluateRPN(token.value, u, sender));
        if (token.type === 'pow') return Math.pow(this.evaluateRPN(token.left, u, sender), this.evaluateRPN(token.right, u, sender));
        if (token.type === 'rand') {
            const min = this.evaluateRPN(token.min, u, sender);
            const max = this.evaluateRPN(token.max, u, sender);
            return Math.floor(Math.random() * (max - min) + min);
        }
        if (token.type === 'random') {
            const max = Math.floor(this.evaluateRPN(token.max, u, sender));
            if (max <= 0) return 0;
            return Math.floor(Math.random() * max);
        }
        if (token.type === 'abs') return Math.abs(this.evaluateRPN(token.value, u, sender));
        if (token.type === 'ceil') return Math.ceil(this.evaluateRPN(token.value, u, sender));
        if (token.type === 'sign') {
            const v = this.evaluateRPN(token.value, u, sender);
            return v > 0 ? 1 : v < 0 ? -1 : 0;
        }
        if (token.type === 'not') return this.evaluateRPN(token.value, u, sender) ? 0 : 1;
        if (token.type === 'max') return Math.max(this.evaluateRPN(token.left, u, sender), this.evaluateRPN(token.right, u, sender));
        if (token.type === 'min') return Math.min(this.evaluateRPN(token.left, u, sender), this.evaluateRPN(token.right, u, sender));
        if (token.type === 'clamp') {
            const v = this.evaluateRPN(token.value, u, sender);
            const lo = this.evaluateRPN(token.lo, u, sender);
            const hi = this.evaluateRPN(token.hi, u, sender);
            return Math.max(lo, Math.min(hi, v));
        }
        if (token.type === 'tMax') {
            const myVal = parseFloat(u[token.varName]) || 0;
            if (!u._teamOtherMaxes || u._teamOtherMaxes[token.varName] === undefined) return myVal;
            return Math.max(myVal, u._teamOtherMaxes[token.varName]);
        }
        if (token.type === 'tMin') {
            const myVal = parseFloat(u[token.varName]) || 0;
            if (!u._teamOtherMins || u._teamOtherMins[token.varName] === undefined) return myVal;
            return Math.min(myVal, u._teamOtherMins[token.varName]);
        }
        if (token.type === 'tCount') {
            const myVal = parseFloat(u[token.varName]) || 0;
            const myCount = myVal !== 0 ? 1 : 0;
            return myCount + ((u._teamOtherCounts && u._teamOtherCounts[token.varName]) || 0);
        }
        if (token.type === 'getPushRank') {
            return (u._pushRank !== undefined) ? u._pushRank : -1;
        }
        if (token.type === 'countIf') {
            const snap = u._allUsersSnapshot;
            if (!snap) return 0;
            let count = 0;
            for (const pu of snap) {
                // 自分自身のエントリは live な u の状態を使う（ルール内変更を反映させるため）
                const target = (u._uid && pu._uid && pu._uid === u._uid) ? u : pu;
                if (this.evaluateRPN(token.condition, target)) count++;
            }
            return count;
        }
        return 0;
    }

    evaluateRPN(rpnQueue, u, sender = null) {
        if (!Array.isArray(rpnQueue)) return 0;
        this._tick();
        const stack = [];
        rpnQueue.forEach(token => {
            if (typeof token === 'object') { stack.push(this.resolveVal(token, u, sender)); }
            else {
                if (token === 'u+' || token === 'u-') {
                    if (stack.length < 1) throw new Error(`Invalid expression: missing value for "${token}"`);
                    const v = stack.pop();
                    stack.push(token === 'u-' ? -v : v);
                    return;
                }
                if (stack.length < 2) throw new Error(`Invalid expression: missing operand for "${token}"`);
                const b = stack.pop(); const a = stack.pop(); let res;
                switch (token) {
                    case '+': res = a + b; break; case '-': res = (a !== undefined ? a : 0) - b; break;
                    case '*': res = a * b; break; case '/': res = (b !== 0) ? Math.floor(a / b) : 0; break;
                    case '%': res = (b !== 0) ? a % b : 0; break; case '^': res = Math.pow(a, b); break;
                    case '>': res = (a > b) ? 1 : 0; break;
                    case '<': res = (a < b) ? 1 : 0; break;
                    case '>=': res = (a >= b) ? 1 : 0; break;
                    case '<=': res = (a <= b) ? 1 : 0; break;
                    case '==': res = (a === b) ? 1 : 0; break;
                    case '!=': res = (a !== b) ? 1 : 0; break;
                    case 'and': res = (a && b) ? 1 : 0; break;
                    case 'or': res = (a || b) ? 1 : 0; break;
                    default: throw new Error(`Invalid expression: unknown operator "${token}"`);
                }
                stack.push(res);
            }
        });
        if (stack.length === 0) return 0;
        if (stack.length !== 1) throw new Error('Invalid expression: leftover values after evaluation');
        return stack[0];
    }

    // 実行ステップを1つ消費する。上限超過で例外を投げてDoSを防ぐ。
    _tick() {
        if (++this._steps > MAX_EXECUTION_STEPS) {
            throw new Error('実行ステップ数の上限を超えました（ループが大きすぎる可能性があります）');
        }
    }

    runCommands(commands, u, sender = null, callStack = []) {
        for (let cmdIndex = 0; cmdIndex < commands.length; cmdIndex++) {
            this._tick();
            const cmd = commands[cmdIndex];
            if (u._status || u._scopePending) break;
            if (cmd.type === 'pass') continue;

            if (cmd.type === 'call') {
                if (cmd.func === 'win') u._status = 'win';
                else if (cmd.func === 'lose') u._status = 'lose';
                else if (cmd.func === 'lock') {
                    u.isLocked = true;
                    if (cmd.lockDisplayKey) u.lockDisplayKey = cmd.lockDisplayKey;
                    else delete u.lockDisplayKey;
                }
                else if (cmd.func === 'unlock') {
                    u.isLocked = false;
                    delete u.lockDisplayKey;
                }
                else if (cmd.func === 'tLock'   || cmd.func === 'tlock')   u.isTeamLocked = true;
                else if (cmd.func === 'tUnlock' || cmd.func === 'tunlock') u.isTeamLocked = false;
                else if (cmd.func === 'throughAns') u._throughAns = true;
            }
            else if (cmd.type === 'userFunc') {
                const fnCommands = this.userFunctions[cmd.name];
                if (!fnCommands) throw new Error(`function "${cmd.name}" is not defined`);
                if (callStack.includes(cmd.name)) {
                    throw new Error(`Recursive custom function call is not allowed: ${callStack.concat(cmd.name).join(' -> ')}`);
                }
                this.runCommands(fnCommands, u, sender, callStack.concat(cmd.name));
            }
            else if (cmd.type === 'setBorderColor') {
                u.borderColor = cmd.color;
            }
            else if (cmd.type === 'resetBorderColor') {
                u.borderColor = '';
            }
            else if (cmd.type === 'flashBorderColor') {
                u._flashBorderColor = { color: cmd.color, duration: cmd.duration };
            }
            else if (cmd.type === 'setStatColor') {
                const colors = (u.displayStatColors && typeof u.displayStatColors === 'object')
                    ? { ...u.displayStatColors }
                    : {};
                if (cmd.color) colors[cmd.key] = cmd.color;
                else delete colors[cmd.key];
                u.displayStatColors = colors;
            }
            else if (cmd.type === 'setStatSize') {
                this.config[cmd.key].size = cmd.size === 'small' ? 'small' : 'normal';
                this._configChanged = true;
            }
            else if (cmd.type === 'setWinText') {
                u.displayWinText = cmd.op === '+='
                    ? ((u.displayWinText ?? this.config.winText ?? '') + cmd.value)
                    : cmd.value;
            }
            else if (cmd.type === 'setShowWinRank') {
                u.displayShowWinRank = !!cmd.value;
            }
            else if (cmd.type === 'repeat') {
                const count = Math.min(1000, Math.max(0, Math.floor(this.evaluateRPN(cmd.count, u, sender))));
                for (let i = 0; i < count; i++) {
                    this._tick();
                    this.runCommands(cmd.commands, u, sender, callStack);
                    if (u._status || u._scopePending) break;
                }
            }
            else if (cmd.type === 'broadcast') {
                if (!u._global_queue) u._global_queue = [];
                u._global_queue.push({ type: 'broadcast', target: cmd.target, expr: cmd.value });
            }
            else if (cmd.type === 'resetVar') {
                const key = this.canonicalVariableName(cmd.var);
                u[key] = this.normalizeSpecialVariable(key, this.initialState[key] ?? 0);
            }
            else if (cmd.type === 'setFlavorText') {
                u._flavorText = cmd.text;
            }
            else if (cmd.type === 'resetFlavorText') {
                u._resetFlavorText = true;
            }
            else if (cmd.type === 'others') {
                if (!u._others_queue) u._others_queue = [];
                u._others_queue.push({ mode: cmd.mode, target: cmd.target, expr: cmd.value });
            }
            else if (cmd.type === 'team') {
                if (!u._team_queue) u._team_queue = [];
                u._team_queue.push({ mode: cmd.mode, target: cmd.target, expr: cmd.value });
            }
            else if (cmd.type === 'giveAns') {
                if (!u._giveAns_queue) u._giveAns_queue = [];
                u._giveAns_queue.push({ condition: cmd.condition });
            }
            else if (cmd.type === 'scope') {
                if (!u._global_queue) u._global_queue = [];
                // Snapshot actor state at the point scope() is encountered
                const _snap = {};
                const _skipKeys = new Set(['_global_queue','_others_queue','_team_queue','_giveAns_queue','_throughAns','_teamProds','_mutatedKeys','_scopePending']);
                for (const k in u) {
                    if (_skipKeys.has(k) || typeof u[k] === 'function') continue;
                    _snap[k] = u[k];
                }
                const _afterCmds = commands.slice(cmdIndex + 1);
                u._global_queue.push({
                    type: 'scope_exec',
                    condition: cmd.condition,
                    commands: cmd.commands,
                    actorSnapshot: _snap,
                    continuation: _afterCmds.length ? _afterCmds : null
                });
                u._scopePending = true;
                break;
            }
            else if (cmd.type === 'assign') {
                const _isMy = cmd.var.startsWith('my_') && sender !== null;
                const _target = _isMy ? sender : u;
                const _key = this.canonicalVariableName(_isMy ? cmd.var.slice(3) : cmd.var);
                const val = this.evaluateRPN(cmd.expr, u, sender);
                if (_target[_key] === undefined) _target[_key] = 0;
                if (cmd.op === '=') _target[_key] = val;
                else if (cmd.op === '+=') _target[_key] += val;
                else if (cmd.op === '-=') _target[_key] -= val;
                else if (cmd.op === '*=') _target[_key] *= val;
                _target[_key] = this.normalizeSpecialVariable(_key, _target[_key]);
                if (_isMy) {
                    if (!sender._mutatedKeys) sender._mutatedKeys = new Set();
                    sender._mutatedKeys.add(_key);
                }
            }
            else if (cmd.type === 'if') {
                const condVal = this.evaluateRPN(cmd.condition, u, sender);
                if (condVal) this.runCommands(cmd.then, u, sender, callStack);
                else if (cmd.else && cmd.else.length > 0) this.runCommands(cmd.else, u, sender, callStack);
            }
            else if (cmd.type === 'switch') {
                const val = this.evaluateRPN(cmd.expr, u, sender);
                let matched = false;
                for (const c of cmd.cases) {
                    if (val === this.evaluateRPN(c.value, u, sender)) {
                        this.runCommands(c.commands, u, sender, callStack);
                        matched = true;
                        break;
                    }
                }
                if (!matched && cmd.default.length > 0) this.runCommands(cmd.default, u, sender, callStack);
            }
        }
        return u._status || null;
    }

    prepareExecutionUser(user) {
        const u = { ...user };
        [
            '_global_queue', '_others_queue', '_team_queue', '_giveAns_queue', '_throughAns',
            '_flavorText', '_resetFlavorText', '_mutatedKeys', '_scopePending'
        ].forEach(key => { delete u[key]; });
        ['w', 'x', 'y', 'z'].forEach(k => { u[k] = parseFloat(u[k] || 0); });
        if (u.customData) {
            for (const [key, value] of Object.entries(u.customData)) {
                if (this.isProtectedName(key)) continue;
                u[key] = value;
            }
        }
        for (const key in this.initialState) if (u[key] === undefined) u[key] = this.initialState[key];
        for (const key in this.constants) u[key] = this.constants[key];
        return u;
    }

    execute(actionName, user, eventArgs = {}) {
        const commands = this.ast[actionName];
        if (!commands) return user;
        this._steps = 0;
        let u = this.prepareExecutionUser(user);
        const params = this.eventParams?.[actionName] || [];
        const previousParamValues = {};
        params.forEach(param => {
            previousParamValues[param] = {
                exists: Object.prototype.hasOwnProperty.call(u, param),
                value: u[param]
            };
            u[param] = Object.prototype.hasOwnProperty.call(eventArgs || {}, param)
                ? eventArgs[param]
                : '';
        });
        this.runCommands(commands, u);
        params.forEach(param => {
            if (previousParamValues[param].exists) u[param] = previousParamValues[param].value;
            else delete u[param];
        });
        delete u._scopePending;
        return u;
    }

    executeContinuation(user, commands) {
        this._steps = 0;
        let u = this.prepareExecutionUser(user);
        this.runCommands(commands, u);
        delete u._scopePending;
        return u;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomRuleEngine;
}
if (typeof window !== 'undefined') {
    window.CustomRuleEngine = CustomRuleEngine;
}
