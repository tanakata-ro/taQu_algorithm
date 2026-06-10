'use strict';


module.exports = {
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
                    tokens.push({ type: 'tProd', varName: targetVar });
                } else if (word === 'rankVal') {
                    const args = this.splitArgs(argsContent);
                    const varName = args[0]?.trim();
                    this.assertReadableVariableName(varName, 'rankVal');
                    const rankExpr = this.parseExpression(args[1] || '1');
                    tokens.push({ type: 'rankVal', varName, rankExpr });
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
                    tokens.push({ type: 'tAdd', varName: targetVar });
                } else if (word === 'tMax') {
                    const targetVar = argsContent.trim();
                    this.assertReadableVariableName(targetVar, 'tMax');
                    tokens.push({ type: 'tMax', varName: targetVar });
                } else if (word === 'tMin') {
                    const targetVar = argsContent.trim();
                    this.assertReadableVariableName(targetVar, 'tMin');
                    tokens.push({ type: 'tMin', varName: targetVar });
                } else if (word === 'tCount') {
                    const targetVar = argsContent.trim();
                    this.assertReadableVariableName(targetVar, 'tCount');
                    tokens.push({ type: 'tCount', varName: targetVar });
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
},

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
},

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
};
