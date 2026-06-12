'use strict';


module.exports = {
resolveVal(token, u, sender) {
    if (typeof token === 'number') return token;
    if (token.type === 'num') return token.val;
    if (token.type === 'var') {
        if (token.name.startsWith('my_')) {
            const key = token.name.substring(3);
            if (sender) {
                return (sender[key] !== undefined) ? parseFloat(sender[key]) : 0;
            }
            return 0;
        }
        if (this.constants[token.name] !== undefined) return this.constants[token.name];
        return (u[token.name] !== undefined) ? parseFloat(u[token.name]) : 0;
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
},

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
},

// 実行ステップを1つ消費する。上限超過で例外を投げてDoSを防ぐ。

_tick() {
    if (++this._steps > (this.maxExecutionSteps || 100000)) {
        throw new Error('実行ステップ数の上限を超えました（ループが大きすぎる可能性があります）');
    }
},

runCommands(commands, u, sender = null, callStack = []) {
    for (let cmdIndex = 0; cmdIndex < commands.length; cmdIndex++) {
        this._tick();
        const cmd = commands[cmdIndex];
        if (u._status || u._scopePending) break;
        if (cmd.type === 'pass') continue;

        if (cmd.type === 'call') {
            if (cmd.func === 'win') u._status = 'win';
            else if (cmd.func === 'lose') u._status = 'lose';
            else if (cmd.func === 'lock') u.isLocked = true;
            else if (cmd.func === 'unlock') u.isLocked = false;
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
            this.config[cmd.key].color = cmd.color || null;
            this._configChanged = true;
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
            u[cmd.var] = this.normalizeSpecialVariable(cmd.var, this.initialState[cmd.var] ?? 0);
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
            // 次のコマンドもscopeなら continuationなしで積んでループ継続（複数scope対応）
            const _nextIsScope = _afterCmds.length > 0 && _afterCmds[0].type === 'scope';
            u._global_queue.push({
                type: 'scope_exec',
                condition: cmd.condition,
                commands: cmd.commands,
                actorSnapshot: _snap,
                continuation: _nextIsScope ? null : (_afterCmds.length ? _afterCmds : null)
            });
            if (!_nextIsScope) {
                u._scopePending = true;
                break;
            }
        }
        else if (cmd.type === 'assign') {
            const _isMy = cmd.var.startsWith('my_') && sender !== null;
            const _target = _isMy ? sender : u;
            const _key = _isMy ? cmd.var.slice(3) : cmd.var;
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
},

prepareExecutionUser(user) {
    const u = { ...user };
    ['x', 'y', 'z'].forEach(k => { u[k] = parseFloat(u[k] || 0); });
    if (u.customData) {
        for (const [key, value] of Object.entries(u.customData)) {
            if (this.isProtectedName(key)) continue;
            u[key] = value;
        }
    }
    for (const key in this.initialState) if (u[key] === undefined) u[key] = this.initialState[key];
    for (const key in this.constants) u[key] = this.constants[key];
    return u;
},

execute(actionName, user) {
    const commands = this.ast[actionName];
    if (!commands) return user;
    this._steps = 0;
    let u = this.prepareExecutionUser(user);
    this.runCommands(commands, u);
    delete u._scopePending;
    return u;
},

executeContinuation(user, commands) {
    this._steps = 0;
    let u = this.prepareExecutionUser(user);
    this.runCommands(commands, u);
    delete u._scopePending;
    return u;
}
};
