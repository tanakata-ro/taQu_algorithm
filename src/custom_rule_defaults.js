const EVENT_NAMES = ['initialization', 'correct', 'wrong', 'through', 'push', 'next'];

const PROTECTED_NAMES = [
    'id', 'name', 'socketId', 'flavorText', 'customData', 'status', 'winRank',
    'sessionId', 'isPressed', 'delay', 'isAnswerer', 'time', 'isLocked',
    'isTeamLocked', 'joinTime', 'lastOrder', 'mt', 'isReach', 'isSpectator',
    'cardColor', 'managementNumber', 'constructor', 'prototype'
];

const RESERVED_WORDS = [
    'def', 'if', 'elif', 'else', 'scope', 'repeat', 'switch', 'case',
    'default', 'const', 'pass', 'true', 'false', 'True', 'False',
    'and', 'or', 'not', 'win', 'lose', 'lock', 'unlock', 'tLock',
    'tUnlock', 'tlock', 'tunlock', 'throughAns'
];

const RESERVED_FUNCTION_NAMES = [
    ...EVENT_NAMES,
    'win', 'lose', 'lock', 'unlock', 'tLock', 'tUnlock', 'tlock', 'tunlock', 'throughAns',
    'othersAdd', 'othersSet', 'others_add', 'others_set', 'uAdd', 'uSet', 'tAdd', 'tSet',
    'giveAns', 'setBorderColor', 'resetBorderColor', 'flashBorderColor',
    'setX', 'setY', 'setZ', 'addX', 'addY', 'addZ',
    'broadcast', 'resetVar', 'setFlavorText', 'resetFlavorText',
    'floor', 'ceil', 'round', 'abs', 'sqrt', 'pow', 'sign', 'max', 'min', 'clamp',
    'rand', 'random', 'not', 'tProd', 'tSum', 'tMax', 'tMin', 'tCount',
    'rankVal', 'countIf', 'getPushRank', 'sync'
];

function createDefaultConfig() {
    return {
        x: { label: null, sync: false, color: null },
        y: { label: null, sync: false, color: null },
        z: { label: null, sync: false, color: null },
        maxAns: 1,
        winText: null,
        showWinRank: true,
        sortByWinRank: false,
        sortByPressOrder: true
    };
}

function createEmptyAst() {
    return Object.fromEntries(EVENT_NAMES.map(eventName => [eventName, []]));
}

module.exports = {
    EVENT_NAMES,
    PROTECTED_NAMES,
    RESERVED_WORDS,
    RESERVED_FUNCTION_NAMES,
    createDefaultConfig,
    createEmptyAst
};
