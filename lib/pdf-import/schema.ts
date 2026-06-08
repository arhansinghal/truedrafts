// PDF-import — shared types for the AI extraction pipeline.
// Slimmed from the original sandbox: activities are position/organization/
// description only (no grades/hours/weeks), and there are no test scores.

export interface ExtractedActivity {
  position: string; // position / leadership role
  organization: string;
  description: string;
}

export interface ExtractedSupplemental {
  prompt: string;
  content: string;
}

export interface ExtractionResult {
  universityName: string;
  admittedYear: string; // 4-digit string or ""
  submittedCommonApp: boolean;
  caPromptIndex: number; // 0–6 mapped to COMMON_APP_PROMPTS, or -1
  caContent: string; // VERBATIM personal statement
  supplementals: ExtractedSupplemental[]; // exact wizard shape {prompt, content}
  // Writer-level extras surfaced in the prefilled wizard's "Profile & Major" step.
  activities: ExtractedActivity[];
  honorsAwards: string[];
  intendedMajor: string;
  notes: string; // extraction caveats / anything else useful
}
