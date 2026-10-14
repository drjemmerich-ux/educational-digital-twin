// LocalGateway: the in-browser engine. Used by the single-file and Artifact builds and by tests.
import type { CommandInput, CommandName } from '../engine/commandTypes.ts';
import { COMMANDS } from '../engine/registry.ts';
import type { CommandContext, CommandResult } from '../engine/commands.ts';
import type { EventDraft, SessionState } from '../engine/types.ts';
import type { DispatchResult, SessionController } from './controller.ts';
import { SessionController as Controller } from './controller.ts';
import type { GatewayCapabilities, GatewaySaveStatus, SessionGateway } from './gateway.ts';
import { MemorySessionRepository } from './memoryRepository.ts';
import type { SessionMeta } from './repository.ts';
import { REFERENCE_JOURNEY, runJourney } from './scriptedJourney.ts';

type AnyCommand = (s: SessionState, input: unknown, ctx: CommandContext) => CommandResult;

export class LocalGateway implements SessionGateway {
  readonly mode = 'local' as const;
  readonly capabilities: GatewayCapabilities = { storage: 'browser', demo: true, devTools: true, assignedCode: false, chooseRoute: true };
  readonly assignedParticipantCode = null;

  constructor(readonly controller: SessionController) {}

  get state() {
    return this.controller.state;
  }
  get log() {
    return this.controller.log;
  }
  get saveStatus(): GatewaySaveStatus {
    return this.controller.saveStatus;
  }
  get lastError() {
    return this.controller.lastError;
  }
  get readOnly() {
    return this.controller.readOnly;
  }
  get drafts() {
    return this.controller.drafts;
  }
  get storageFailureArmed() {
    return this.controller.repo.failNextWrites > 0;
  }

  subscribe(fn: () => void) {
    return this.controller.subscribe(fn);
  }

  /** Synchronous form, for code paths that need the result immediately (tests, scripted journeys). */
  runSync<N extends CommandName>(name: N, input: CommandInput<N>): DispatchResult {
    const cmd = COMMANDS[name] as unknown as AnyCommand;
    let sid: string | undefined;
    if (name === 'startSession') {
      const kind = (input as { session_kind?: string }).session_kind;
      sid = this.controller.ids.newId(kind === 'demonstration' ? 'demo' : 'session');
    }
    return this.controller.dispatch(cmd, input as unknown, sid);
  }

  run<N extends CommandName>(name: N, input: CommandInput<N>): Promise<DispatchResult> {
    return Promise.resolve(this.runSync(name, input));
  }

  appendTutorWith(build: (state: SessionState) => EventDraft[] | null): Promise<DispatchResult | null> {
    return Promise.resolve(this.controller.appendTutorWith(build));
  }

  listSessions(): Promise<SessionMeta[]> {
    try {
      return Promise.resolve(this.controller.repo.listSessions().sort((a, b) => b.updated_at_utc.localeCompare(a.updated_at_utc)));
    } catch {
      return Promise.resolve([]);
    }
  }

  open(sessionId: string, force = false): Promise<{ lockedElsewhere: boolean }> {
    try {
      return Promise.resolve(this.controller.load(sessionId, force));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  startDemo(): Promise<void> {
    // Build the demonstration log in memory, then store it as its own clearly labelled session.
    const scratch = new Controller(new MemorySessionRepository(), this.controller.ids);
    const id = this.controller.ids.newId('demo');
    runJourney(scratch, { ...REFERENCE_JOURNEY, sessionId: id, kind: 'demonstration', stopAt: 'debrief' });
    try {
      this.controller.loadPrepared([...scratch.log]);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  reset() {
    this.controller.reset();
  }
  setDraft(key: string, value: unknown) {
    this.controller.setDraft(key, value);
  }
  clearDraft(key: string) {
    this.controller.clearDraft(key);
  }
  armStorageFailure() {
    this.controller.repo.failNextWrites = 1;
  }
}
