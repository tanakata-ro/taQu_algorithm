'use strict';


module.exports = {
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
},

stripComment(line) {
    const idx = this.findCommentIndex(line);
    return idx >= 0 ? line.substring(0, idx) : line;
},

extractComment(line) {
    const idx = this.findCommentIndex(line);
    return idx >= 0 ? line.substring(idx + 1).trim() : "";
},

parseSingleCommand(content) {
    content = content.trim();
    if (!content) return null;

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
};
