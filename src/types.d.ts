export type RuleEventName =
  | 'initialization'
  | 'push'
  | 'correct'
  | 'wrong'
  | 'through'
  | 'next';

export type PlayerStatus = 'playing' | 'win' | 'lose';

export interface PlayerState {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  z?: number;
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
}

export interface RuleConfig {
  x: StatConfig;
  y: StatConfig;
  z: StatConfig;
  maxAns: number;
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
  maxExecutionSteps: number;

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
