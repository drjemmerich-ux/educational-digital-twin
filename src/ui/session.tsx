// React bindings for the SessionController. UI code calls `run(command, input)`; this is also
// where educational tutor triggers are derived from released events (the tutor never sees
// commands or hidden content).
import * as React from 'react';
import type { CommandContext, CommandResult } from '../engine/commands.ts';
import type { AnyEvent, SessionState } from '../engine/types.ts';
import type { DispatchResult, SessionController } from '../session/controller.ts';
import type { TutorAdapter } from '../tutor/contract.ts';
import { runTutor } from '../tutor/tutorService.ts';

interface Ctx {
  controller: SessionController;
  tutor: TutorAdapter;
  ui: UiState;
  setUi: (patch: Partial<UiState>) => void;
}

export interface UiState {
  activeStudy: string | null;
  drawerStudy: string | null;
  drawerMode: 'request' | 'repeat' | 'unsupported' | null;
  recordStudy: string | null;
  dialog: 'help' | 'export' | 'exit' | 'restart' | null;
  chartOpen: boolean;
  tutorOpen: boolean;
  tutorCollapsed: boolean;
  toast: string | null;
}

export const initialUi: UiState = {
  activeStudy: null,
  drawerStudy: null,
  drawerMode: null,
  recordStudy: null,
  dialog: null,
  chartOpen: false,
  tutorOpen: false,
  tutorCollapsed: false,
  toast: null,
};

const SessionCtx = React.createContext<Ctx | null>(null);

export function SessionProvider(props: { controller: SessionController; tutor: TutorAdapter; children: React.ReactNode }) {
  const [ui, setUiState] = React.useState<UiState>(initialUi);
  const setUi = React.useCallback((patch: Partial<UiState>) => setUiState((u) => ({ ...u, ...patch })), []);
  const value = React.useMemo(() => ({ controller: props.controller, tutor: props.tutor, ui, setUi }), [props.controller, props.tutor, ui, setUi]);
  return <SessionCtx.Provider value={value}>{props.children}</SessionCtx.Provider>;
}

function useCtx(): Ctx {
  const c = React.useContext(SessionCtx);
  if (!c) throw new Error('SessionProvider missing');
  return c;
}

export function useSession(): SessionState {
  const { controller } = useCtx();
  return React.useSyncExternalStore(
    (fn) => controller.subscribe(fn),
    () => controller.state,
  );
}

export function useController(): SessionController {
  useSession(); // re-render on change
  return useCtx().controller;
}

export function useUi(): [UiState, (patch: Partial<UiState>) => void] {
  const c = useCtx();
  return [c.ui, c.setUi];
}

export function useTutor(): TutorAdapter {
  return useCtx().tutor;
}

/** Derive tutor triggers from events just committed. */
function tutorTriggersFor(events: AnyEvent[], controller: SessionController, tutor: TutorAdapter) {
  for (const e of events) {
    if (e.event_type === 'report_released') {
      runTutor(controller, tutor, { kind: 'report_released', investigationId: e.payload.investigation_id, variant: e.payload.variant });
    } else if (e.event_type === 'boundary_response') {
      runTutor(controller, tutor, { kind: 'boundary', relatedTo: e.payload.related_to });
    } else if (e.event_type === 'stage_transition' && e.payload.to !== e.payload.from) {
      runTutor(controller, tutor, { kind: 'stage_entered', stage: e.payload.to });
    } else if (e.event_type === 'session_started') {
      runTutor(controller, tutor, { kind: 'session_started' });
    }
  }
}

export function useRun() {
  const { controller, tutor } = useCtx();
  return React.useCallback(
    <I,>(command: (s: SessionState, input: I, ctx: CommandContext) => CommandResult, input: I, sessionIdForStart?: string): DispatchResult => {
      const r = controller.dispatch(command, input, sessionIdForStart);
      if (r.ok) tutorTriggersFor(r.events, controller, tutor);
      return r;
    },
    [controller, tutor],
  );
}

/** Draft text persisted separately from committed events, restored on refresh. */
export function useDraft<T>(key: string, initial: T): [T, (v: T) => void, () => void] {
  const { controller } = useCtx();
  const stored = controller.drafts[key] as T | undefined;
  const [value, setValue] = React.useState<T>(stored !== undefined ? stored : initial);
  const set = React.useCallback(
    (v: T) => {
      setValue(v);
      controller.setDraft(key, v);
    },
    [controller, key],
  );
  const clear = React.useCallback(() => {
    controller.clearDraft(key);
    setValue(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, key]);
  return [value, set, clear];
}
