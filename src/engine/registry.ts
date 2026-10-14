// Named command registry. The UI refers to engine commands by name only, so a participant bundle
// can run every command on the server without shipping this module (or the hidden case content
// that commands.ts reads). Local builds, tests and the server import this registry directly.
import * as C from './commands.ts';

export const COMMANDS = {
  startSession: C.startSession,
  commitInitialAssessment: C.commitInitialAssessment,
  reviseWorkingModel: C.reviseWorkingModel,
  commitRequest: C.commitRequest,
  switchStudyToTextOnly: C.switchStudyToTextOnly,
  commitInterpretation: C.commitInterpretation,
  addInterpretationAddendum: C.addInterpretationAddendum,
  commitModelUpdate: C.commitModelUpdate,
  openStudy: C.openStudy,
  openAnnotations: C.openAnnotations,
  requestRepeat: C.requestRepeat,
  requestUnsupported: C.requestUnsupported,
  recordAssetNotice: C.recordAssetNotice,
  concludeWorkup: C.concludeWorkup,
  commitRecommendation: C.commitRecommendation,
  acknowledgeCanonical: C.acknowledgeCanonical,
  continueProcedure: C.continueProcedure,
  commitIntraopProposal: C.commitIntraopProposal,
  revealTeamAction: C.revealTeamAction,
  advanceToPod1: C.advanceToPod1,
  advanceToPod3: C.advanceToPod3,
  commitPostopReassessment: C.commitPostopReassessment,
  commitPostopPlan: C.commitPostopPlan,
  confirmBranchSelection: C.confirmBranchSelection,
  advanceBranch: C.advanceBranch,
  commitSecondDecision: C.commitSecondDecision,
  advanceToFollowUp: C.advanceToFollowUp,
  enterDebrief: C.enterDebrief,
  commitReflection: C.commitReflection,
  completeSession: C.completeSession,
} as const;

export function isCommandName(name: unknown): name is keyof typeof COMMANDS {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(COMMANDS, name);
}
