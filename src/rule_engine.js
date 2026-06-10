'use strict';

const {
    EVENT_NAMES,
    PROTECTED_NAMES,
    RESERVED_WORDS,
    RESERVED_FUNCTION_NAMES,
    createDefaultConfig,
    createEmptyAst
} = require('./custom_rule_defaults.js');

const expressionMethods = require('./rule_expression.js');
const commandParserMethods = require('./rule_command_parser.js');
const parserMethods = require('./rule_parser.js');
const runtimeMethods = require('./rule_runtime.js');

const DEFAULT_MAX_EXECUTION_STEPS = 100000;
const HARD_MAX_EXECUTION_STEPS = 1000000;

function normalizeExecutionStepLimit(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_MAX_EXECUTION_STEPS;
    return Math.min(Math.floor(numeric), HARD_MAX_EXECUTION_STEPS);
}

class CustomRuleEngine {
    constructor(options = {}) {
        this.config = createDefaultConfig();
        this.initialState = {};
        this.constants = {};
        this.constantDescriptions = {};
        this.userFunctions = {};
        this._steps = 0;
        this.maxExecutionSteps = normalizeExecutionStepLimit(options.maxExecutionSteps);
        this.description = '';
        this.ruleName = '';

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
        if (name === 'miss') return Math.max(0, Math.min(5, Math.floor(Number(value) || 0)));
        return value;
    }

    isProtectedName(name) {
        if (!name) return true;
        if (name.startsWith('_')) return true;
        if (this.protectedNames.has(name)) return true;
        if (this.reservedWords.has(name)) return true;
        return false;
    }

    assertWritableName(name, context = 'assignment') {
        const actual = name && name.startsWith('my_') ? name.slice(3) : name;
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
}

Object.assign(
    CustomRuleEngine.prototype,
    expressionMethods,
    commandParserMethods,
    parserMethods,
    runtimeMethods
);

CustomRuleEngine.DEFAULT_MAX_EXECUTION_STEPS = DEFAULT_MAX_EXECUTION_STEPS;
CustomRuleEngine.HARD_MAX_EXECUTION_STEPS = HARD_MAX_EXECUTION_STEPS;

module.exports = CustomRuleEngine;
