'use strict';

const { EVENT_NAMES, createDefaultConfig, createEmptyAst } = require('./custom_rule_defaults.js');


module.exports = {
parse(code) {
    const lines = code.split(/\r?\n/);
    this.initialState = {};
    this.constants = {};
    this.constantDescriptions = {};
    this.userFunctions = {};
    this.ast = createEmptyAst();
    this.config = createDefaultConfig();
    this.description = "";
    this.ruleName = "";
    this._configChanged = false;

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

    const applyMetadataAssignment = (content, shouldApply) => {
        const descMatch = content.match(/^description\s*=\s*["'](.+)["']$/);
        if (descMatch) {
            if (shouldApply) this.description = descMatch[1];
            return true;
        }
        const nameMatch = content.match(/^(?:rule|name)\s*=\s*["'](.+)["']$/);
        if (nameMatch) {
            if (shouldApply) this.ruleName = nameMatch[1];
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
                    if (inlineCmd && applyMetadataAssignment(inlineCmd, branchActive)) return;
                } else if (parseElifMatch && parseTimeMetadataBranch) {
                    const branchActive = !parseTimeMetadataBranch.branchTaken && evalParseTimeCondition(parseElifMatch[1], index + 1);
                    parseTimeMetadataBranch.active = branchActive;
                    parseTimeMetadataBranch.branchTaken = parseTimeMetadataBranch.branchTaken || branchActive;
                    parseTimeMetadataBranch.bodyIndent = null;
                    const inlineCmd = parseElifMatch[2] ? parseElifMatch[2].trim() : '';
                    if (inlineCmd && applyMetadataAssignment(inlineCmd, branchActive)) return;
                } else if (parseElseMatch && parseTimeMetadataBranch) {
                    const branchActive = !parseTimeMetadataBranch.branchTaken;
                    parseTimeMetadataBranch.active = branchActive;
                    parseTimeMetadataBranch.branchTaken = true;
                    parseTimeMetadataBranch.bodyIndent = null;
                    const inlineCmd = parseElseMatch[1] ? parseElseMatch[1].trim() : '';
                    if (inlineCmd && applyMetadataAssignment(inlineCmd, branchActive)) return;
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

        const defMatch = content.match(/^def\s+(correct|wrong|through|push|next)\(\):$/);
        if (defMatch) {
            currentDef = defMatch[1];
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
            const labelMatch = content.match(/^([xyz])\.label\s*=\s*["'](.*)["']$/);
            if (labelMatch) { this.config[labelMatch[1]].label = labelMatch[2]; return; }

            const colorMatch = content.match(/^([xyz])\.color\s*=\s*["'](.*?)["']$/);
            if (colorMatch) {
                const color = colorMatch[2].trim();
                if (color && !this.isSafeColorValue(color)) throw new Error(`Line ${index + 1}: invalid color value "${color}"`);
                this.config[colorMatch[1]].color = color || null;
                return;
            }
        }

        const syncMatch = content.match(/^sync\(([xyz])\)$/);
        if (syncMatch) {
            this.config[syncMatch[1]].sync = true;
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
        if (applyMetadataAssignment(content, metadataShouldApply)) return;

        const maxAnsMatch = content.match(/^maxAns\s*=\s*(-?\d+)$/);
        if (maxAnsMatch) {
            let ma = parseInt(maxAnsMatch[1], 10);
            if (isNaN(ma)) ma = 1;
            this.config.maxAns = ma;
            return;
        }

        const winTextMatch = content.match(/^winText\s*=\s*["'](.*)["']$/);
        if (winTextMatch) { this.config.winText = winTextMatch[1]; return; }

        const showWinRankMatch = content.match(/^showWinRank\s*=\s*(true|false|True|False)$/);
        if (showWinRankMatch) { this.config.showWinRank = showWinRankMatch[1].toLowerCase() === 'true'; return; }

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
},

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
},

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
};
