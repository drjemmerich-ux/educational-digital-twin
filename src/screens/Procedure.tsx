// S06: canonical procedure, intraoperative checkpoint, participant proposal before the team's action,
// then postoperative day 1.
import * as React from 'react';
import * as C from '../engine/commands.ts';
import { useDraft, useRun, useSession } from '../ui/session.tsx';
import { COMMIT_NOTE, CommitBar, ConfidenceInput, ErrorNote, TextField } from '../components/forms.tsx';
import type { ClinicalUpdate } from '../case/types.ts';

export function PlaceholderPicture(props: { assetId: string; title: string; caption?: string }) {
  return (
    <figure className="picture-placeholder">
      <div className="picture-box" role="img" aria-label={`${props.title}: technical placeholder (${props.assetId}), no image content`}>
        <span>Technical placeholder</span>
        <span className="small">
          {props.assetId} · synthetic image pending production and review
        </span>
      </div>
      <figcaption>
        <strong>{props.title}.</strong> {props.caption ?? ''}
      </figcaption>
    </figure>
  );
}

export function UpdateCard(props: { update: ClinicalUpdate; tone?: 'clinical' | 'alert' }) {
  const u = props.update;
  return (
    <section className={`update-card ${props.tone ?? 'clinical'}`} aria-labelledby={`upd-${u.id}`}>
      <p className="eyebrow">{u.time.label}</p>
      <h3 id={`upd-${u.id}`}>{u.title}</h3>
      <ul>
        {u.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {u.images?.map((i) => (
        <PlaceholderPicture key={i.assetId} assetId={i.assetId} title={i.title} caption={i.caption} />
      ))}
      {u.notes?.length ? (
        <div className="note-box">
          {u.notes.map((n, i) => (
            <p key={i}>
              <span className="note-time">{n.time}</span> {n.author}: {n.text}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Advance(props: { label: string; onClick: () => void }) {
  return (
    <div className="continue-block">
      <button type="button" className="btn-primary" onClick={props.onClick}>
        {props.label}
      </button>
    </div>
  );
}

export function Procedure() {
  const state = useSession();
  const run = useRun();
  const [error, setError] = React.useState<string | null>(null);
  const [imm, setImm, clearI] = useDraft('n4:immediate', '');
  const [checks, setChecks, clearCh] = useDraft('n4:checks', '');
  const [post, setPost, clearP] = useDraft('n4:post', '');
  const [conf, setConf, clearC] = useDraft<number | null>('n4:conf', null);
  const go = (cmd: (s: typeof state) => C.CommandResult) => {
    const r = run(cmd, undefined);
    setError(r.ok ? null : r.message);
  };
  const stage = state.stage;
  const pod1 = state.clinicalUpdates.find((u) => u.id === 'pod1');

  return (
    <div className="screen">
      <section className="update-card" aria-labelledby="proc-title">
        <p className="eyebrow">Operative day · day 28 after case entry</p>
        <h2 id="proc-title">Procedure</h2>
        {state.procedureDescription?.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <PlaceholderPicture assetId="OR-N4-001" title="Operative field" caption="Synthetic operative illustration pending production." />
      </section>

      {stage === 'N4.procedure' ? <Advance label="Continue the procedure" onClick={() => go(C.continueProcedure)} /> : null}

      {state.intraopCheckpoint ? <UpdateCard update={state.intraopCheckpoint} tone="alert" /> : null}

      {stage === 'N4.durotomy_proposal' ? (
        <section className="task-block" aria-labelledby="dur-task">
          <p className="eyebrow">Your task</p>
          <h3 id="dur-task">Your proposal before the team acts</h3>
          <TextField id="n4-immediate" label="Immediate management" value={imm} onChange={setImm} rows={3} required />
          <TextField id="n4-checks" label="Checks before closure" value={checks} onChange={setChecks} rows={2} />
          <TextField id="n4-post" label="Postoperative considerations" value={post} onChange={setPost} rows={2} />
          <ConfidenceInput id="n4-conf" value={conf} onChange={setConf} />
          <CommitBar
            label="Commit proposal"
            confirmText={`${COMMIT_NOTE} The simulated team's action is shown only after this.`}
            error={error}
            onCommit={() => {
              const r = run(C.commitIntraopProposal, { immediate: imm, checks, postop_considerations: post, confidence: conf });
              if (!r.ok) setError(r.message);
              else [clearI, clearCh, clearP, clearC].forEach((f) => f());
            }}
          />
        </section>
      ) : null}

      {state.intraopProposal ? (
        <section className="committed-block" aria-labelledby="your-prop">
          <h3 id="your-prop">Your proposal</h3>
          <dl className="kv">
            <dt>Immediate management</dt>
            <dd>{state.intraopProposal.immediate}</dd>
            <dt>Checks before closure</dt>
            <dd>{state.intraopProposal.checks || 'Not recorded'}</dd>
            <dt>Postoperative considerations</dt>
            <dd>{state.intraopProposal.postop_considerations || 'Not recorded'}</dd>
          </dl>
        </section>
      ) : null}

      {stage === 'N4.durotomy_proposal_committed' ? <Advance label="Show the team's action" onClick={() => go(C.revealTeamAction)} /> : null}

      {state.teamAction ? (
        <section className="update-card" aria-labelledby="team-title">
          <p className="eyebrow">Simulated team action (predefined course)</p>
          <h3 id="team-title">What the team did</h3>
          <ul>
            {state.teamAction.team_action.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="muted small">Your proposal and the team's action are recorded separately. The operative report is now in the chart.</p>
        </section>
      ) : null}

      {stage === 'N4.repair_revealed' ? <Advance label="Advance to postoperative day 1" onClick={() => go(C.advanceToPod1)} /> : null}
      {pod1 ? <UpdateCard update={pod1} /> : null}
      {stage === 'N4.pod1' ? <Advance label="Advance to postoperative day 3" onClick={() => go(C.advanceToPod3)} /> : null}
      <ErrorNote message={error} />
    </div>
  );
}
