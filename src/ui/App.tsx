// Application shell: start screen or the three-column clinical workspace.
import * as React from 'react';
import { stageLabel } from '../case/publicCatalogue.ts';
import { useController, useSession, useUi } from './session.tsx';
import { ChartPanel, ExportDialog, HelpDialog, RecordDialog, TopBar, TutorPanel } from '../components/Shell.tsx';
import { Dialog } from '../components/forms.tsx';
import { RequestDrawer } from '../components/RequestDrawer.tsx';
import { StartScreen } from '../screens/StartScreen.tsx';
import { InitialAssessment } from '../screens/InitialAssessment.tsx';
import { Workup } from '../screens/Workup.tsx';
import { CanonicalAck, Management } from '../screens/Management.tsx';
import { Procedure } from '../screens/Procedure.tsx';
import { Postop } from '../screens/Postop.tsx';
import { Branch } from '../screens/Branch.tsx';
import { Review } from '../screens/Review.tsx';
import { FollowUp } from '../screens/FollowUp.tsx';
import { Debrief } from '../screens/Debrief.tsx';

function CenterScreen() {
  const stage = useSession().stage;
  if (stage === 'N1.assessment') return <InitialAssessment />;
  if (stage === 'N2.workup') return <Workup />;
  if (stage === 'N3.recommendation') return <Management />;
  if (stage === 'N3.canonical_ack') return <CanonicalAck />;
  if (['N4.procedure', 'N4.durotomy_proposal', 'N4.durotomy_proposal_committed', 'N4.repair_revealed', 'N4.pod1'].includes(stage)) return <Procedure />;
  if (['N4.pod3_reassessment', 'N4.postop_workup', 'N4.branch_selection'].includes(stage)) return <Postop />;
  if (stage.startsWith('N4.B')) return <Branch />;
  if (stage === 'REVIEW.pause') return <Review />;
  if (stage === 'N5.followup') return <FollowUp />;
  if (stage === 'N5.debrief') return <Debrief />;
  return null;
}

export function App(props: { restoreError: string | null }) {
  const state = useSession();
  const controller = useController();
  const [ui, setUi] = useUi();
  const [restoreError, setRestoreError] = React.useState(props.restoreError);
  const centerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    document.title = 'Educational Digital Twin · Lumbar Spine Patient Encounter';
  }, []);

  // Move focus to the center workspace when the clinical stage changes.
  const prevStage = React.useRef(state.stage);
  React.useEffect(() => {
    if (prevStage.current !== state.stage) {
      prevStage.current = state.stage;
      setUi({ activeStudy: null });
      centerRef.current?.scrollTo?.({ top: 0 });
      centerRef.current?.querySelector<HTMLElement>('h2, h3')?.setAttribute('tabindex', '-1');
      centerRef.current?.querySelector<HTMLElement>('h2, h3')?.focus({ preventScroll: true });
    }
  }, [state.stage, setUi]);

  if (state.stage === 'START') {
    return (
      <div className="app">
        <TopBar onExit={() => undefined} />
        <StartScreen restoreError={restoreError} onRestoreErrorCleared={() => setRestoreError(null)} />
        {ui.dialog === 'help' ? <HelpDialog /> : null}
      </div>
    );
  }

  const layoutClass = ['workspace', ui.tutorCollapsed ? 'tutor-collapsed' : '', ui.chartOpen ? 'chart-open' : '', ui.tutorOpen ? 'tutor-open' : ''].join(' ');
  return (
    <div className="app">
      <a className="skip-link" href="#center">
        Skip to clinical task
      </a>
      <TopBar onExit={() => setUi({ dialog: 'exit' })} />
      {state.sessionKind === 'demonstration' ? (
        <div className="banner banner-demo" role="note">
          Demonstration session: prefilled sample reasoning for reviewers. This is not a participant record.
        </div>
      ) : null}
      {controller.saveStatus === 'memory_only' ? (
        <div className="banner banner-boundary" role="alert">
          Browser storage is unavailable, so this session is held in memory only and will be lost on reload. Export regularly.
        </div>
      ) : null}
      {controller.saveStatus === 'conflict' ? (
        <div className="banner banner-boundary" role="alert">
          This encounter was changed in another tab, so this tab has stopped saving. Reload the page to continue with the latest record.
        </div>
      ) : null}
      {controller.saveStatus === 'offline' ? (
        <div className="banner banner-boundary" role="alert">
          The study server could not be reached, so your last entry was not saved and nothing was released. Check your connection and try again. {controller.lastError ?? ''}
        </div>
      ) : null}
      {controller.saveStatus === 'failed' && controller.lastError ? (
        <div className="banner banner-boundary" role="alert">
          The last entry could not be saved and nothing was released. {controller.lastError} Try again.
        </div>
      ) : null}
      <div className="banner banner-phone" role="note">
        Full case completion has not been validated on phones. A desktop or a tablet in landscape is recommended.
      </div>
      <div className={layoutClass}>
        <div className="col col-chart" id="chart-panel">
          <ChartPanel />
        </div>
        <main className="col col-center" id="center" ref={centerRef} aria-label={`Clinical task: ${stageLabel(state.stage)}`}>
          <CenterScreen />
          <RequestDrawer />
        </main>
        <div className="col col-tutor" id="tutor-panel">
          <TutorPanel />
        </div>
        {ui.chartOpen || ui.tutorOpen ? <div className="scrim" onClick={() => setUi({ chartOpen: false, tutorOpen: false })} aria-hidden="true" /> : null}
      </div>
      {ui.dialog === 'help' ? <HelpDialog /> : null}
      {ui.dialog === 'export' ? <ExportDialog /> : null}
      {ui.dialog === 'exit' ? (
        <Dialog title="Leave this encounter?" onClose={() => setUi({ dialog: null })}>
          <p>
            {controller.capabilities.storage === 'server'
              ? 'Your progress is saved on the study server. You can continue later with your personal link. Export first if you want your own copy.'
              : 'Your progress is saved in this browser. You can resume it from the start screen. Export first if you need a copy elsewhere.'}
          </p>
          <div className="row">
            <button type="button" className="btn-secondary" onClick={() => setUi({ dialog: 'export' })}>
              Export first
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setUi({ dialog: null, activeStudy: null });
                controller.reset();
              }}
            >
              Leave encounter
            </button>
          </div>
        </Dialog>
      ) : null}
      {ui.dialog === 'restart' ? (
        <Dialog title="Start a new encounter?" onClose={() => setUi({ dialog: null })}>
          <p>
            {controller.capabilities.storage === 'server'
              ? 'This session stays saved on the study server and remains available to open or export. A new encounter starts as a separate session.'
              : 'This session stays saved in this browser and remains available to resume or export. A new encounter starts as a separate session.'}
          </p>
          <div className="row">
            <button type="button" className="btn-secondary" onClick={() => setUi({ dialog: 'export' })}>
              Export this session first
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setUi({ dialog: null, activeStudy: null });
                controller.reset();
              }}
            >
              Start new encounter
            </button>
          </div>
        </Dialog>
      ) : null}
      <RecordDialog />
    </div>
  );
}
