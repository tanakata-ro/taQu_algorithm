'use strict';

const CustomRuleEngine = require('./rule_engine.js');

if (typeof window !== 'undefined') {
    window.CustomRuleEngine = CustomRuleEngine;
}

module.exports = CustomRuleEngine;
