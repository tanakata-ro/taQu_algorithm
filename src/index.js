const CustomRuleEngine = require('./custom_rule.js');

const DEFAULT_RULE_CODE = `rule="Free"
description = "Correct answers add one point. Wrong answers add one miss."
maxAns = 1
x.label = "Correct"
y.label = "Wrong"

def correct():
  x += 1

def wrong():
  y += 1

def through():
  pass`;

function createRuleEngine(code = DEFAULT_RULE_CODE, options = {}) {
    const engine = new CustomRuleEngine(options);
    engine.parse(code);
    return engine;
}

function createPlayerState(overrides = {}) {
    return {
        id: overrides.id || 'player-1',
        name: overrides.name || 'Player 1',
        x: Number(overrides.x) || 0,
        y: Number(overrides.y) || 0,
        z: Number(overrides.z) || 0,
        status: overrides.status || 'playing',
        isLocked: !!overrides.isLocked,
        isTeamLocked: !!overrides.isTeamLocked,
        isAnswerer: !!overrides.isAnswerer,
        isPressed: !!overrides.isPressed,
        delay: Number(overrides.delay) || 0,
        time: Number(overrides.time) || 0,
        mt: Number(overrides.mt) || 0,
        customData: { ...(overrides.customData || {}) }
    };
}

function finalizeRuleResult(result) {
    if (result && result._status) result.status = result._status;
    return result;
}

function applyAction(code, action, playerState, options = {}) {
    const engine = createRuleEngine(code, options);
    return finalizeRuleResult(engine.execute(action, createPlayerState(playerState)));
}

module.exports = {
    CustomRuleEngine,
    DEFAULT_RULE_CODE,
    createRuleEngine,
    createPlayerState,
    finalizeRuleResult,
    applyAction
};
