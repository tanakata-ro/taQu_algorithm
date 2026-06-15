const EVENT_NAMES = ['initialization', 'correct', 'wrong', 'through', 'push', 'next'];

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

module.exports = {
    EVENT_NAMES,
    PROTECTED_NAMES,
    RESERVED_WORDS,
    RESERVED_FUNCTION_NAMES,
    createDefaultConfig,
    createEmptyAst
};
