// SessionGateway: the only interface the UI uses to reach the case engine and the session record.
// LocalGateway runs the engine in the browser (single-file and Artifact builds, tests).
// RemoteGateway sends named commands to the server engine (pilot build); hidden case content
// then never reaches the participant's browser.
import type { CommandInput, CommandName } from '../engine/commandTypes.ts';
import type { AnyEvent, EventDraft, SessionState } from '../engine/types.ts';
import type { DispatchResult } from './controller.ts';
import type { SessionMeta } from './repository.ts';

export type GatewaySaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'memory_only' | 'conflict' | 'offline';

export interface GatewayCapabilities {
  /** Where committed entries are stored, for interface copy. */
  storage: 'browser' | 'server';
  /** Prefilled demonstration session available. */
  demo: boolean;
  /** Developer review tools (storage-failure simulation). */
  devTools: boolean;
  /** Participant code is assigned by the personal link rather than typed. */
  assignedCode: boolean;
  /** The participant may type an optional code and choose the imaging route on the start screen. */
  chooseRoute: boolean;
}

export interface SessionGateway {
  readonly mode: 'local' | 'remote';
  readonly capabilities: GatewayCapabilities;
  readonly state: SessionState;
  readonly log: readonly AnyEvent[];
  readonly saveStatus: GatewaySaveStatus;
  readonly lastError: string | null;
  readonly readOnly: boolean;
  readonly drafts: Record<string, unknown>;
  /** Participant code fixed by a personal link (remote) or null. */
  readonly assignedParticipantCode: string | null;
  subscribe(fn: () => void): () => void;
  /** Run a named engine command. Learner commands are serialised; a second one while busy is refused. */
  run<N extends CommandName>(name: N, input: CommandInput<N>): Promise<DispatchResult>;
  /** Tutor events computed from the latest committed state; queued after pending commands. */
  appendTutorWith(build: (state: SessionState) => EventDraft[] | null): Promise<DispatchResult | null>;
  listSessions(): Promise<SessionMeta[]>;
  open(sessionId: string, force?: boolean): Promise<{ lockedElsewhere: boolean }>;
  /** Prepared demonstration session (local only). */
  startDemo?(): Promise<void>;
  reset(): void;
  setDraft(key: string, value: unknown): void;
  clearDraft(key: string): void;
  /** Developer tool (local only). */
  armStorageFailure?(): void;
  readonly storageFailureArmed?: boolean;
}
