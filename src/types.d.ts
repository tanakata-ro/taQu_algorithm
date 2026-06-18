export type RuleEventName =
  | 'initialization'
  | 'push'
  | 'correct'
  | 'wrong'
  | 'through'
  | 'next'
  | 'judge';

export type PlayerStatus = 'playing' | 'win' | 'lose';

export interface PlayerState {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  z?: number;
  w?: number;
  miss?: number;
  status?: PlayerStatus;
  isLocked?: boolean;
  isTeamLocked?: boolean;
  isAnswerer?: boolean;
  isPressed?: boolean;
  delay?: number;
  time?: number;
  mt?: number;
  customData?: Record<string, number | string | boolean>;
  [key: string]: unknown;
}

export interface StatConfig {
  label: string | null;
  sync: boolean;
  color: string | null;
  size: 'normal' | 'small';
  keep: boolean;
}

export interface RuleConfig {
  x: StatConfig;
  y: StatConfig;
  z: StatConfig;
  w: StatConfig;
  maxAns: number;
  missMark: string;
  missKeep: boolean;
  winText: string | null;
  showWinRank: boolean;
  sortByWinRank: boolean;
  sortByPressOrder: boolean;
}

export interface RuleEngineOptions {
  maxExecutionSteps?: number;
}

export class CustomRuleEngine {
  ruleName: string;
  description: string;
  config: RuleConfig;
  constants: Record<string, number>;
  initialState: Record<string, number>;
  constructor(options?: RuleEngineOptions);
  parse(code: string): void;
  execute(actionName: RuleEventName | string, user: PlayerState): PlayerState;
  executeContinuation(user: PlayerState, commands: unknown[]): PlayerState;
  parseExpression(expression: string): unknown[];
  evaluateRPN(rpnQueue: unknown[], user: PlayerState, sender?: PlayerState | null): number;
}

export const DEFAULT_RULE_CODE: string;
export function createRuleEngine(code?: string, options?: RuleEngineOptions): CustomRuleEngine;
export function createPlayerState(overrides?: PlayerState): PlayerState;
export function finalizeRuleResult(result: PlayerState): PlayerState;
export function applyAction(code: string, action: RuleEventName | string, playerState: PlayerState, options?: RuleEngineOptions): PlayerState;
