const { applyAction } = require('../../src');

const rule = `
rule = "Two Correct"
description = "Win after two correct answers."
x.label = "Correct"

def correct():
  x += 1
  if x >= 2:
    win()
`;

let player = { id: 'alice', name: 'Alice' };
player = applyAction(rule, 'correct', player);
player = applyAction(rule, 'correct', player);

console.log({
    name: player.name,
    x: player.x,
    status: player.status
});
