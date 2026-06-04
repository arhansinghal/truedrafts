// Sandbox PDF-import lab — shared types and constants.
//
// ISOLATION NOTE: this module is deliberately self-contained. The Common App
// prompts are copied (not imported) from ApplicationUploadWizard.tsx so the
// lab never touches production code. Keep the two lists in sync manually if
// the official prompts ever change.

export const COMMON_APP_PROMPTS = [
  "Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.",
  "The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?",
  "Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?",
  "Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?",
  "Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.",
  "Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?",
  "Share an essay on any topic of your choice. It can be one you've already written, one that responds to a different prompt, or one of your own design.",
];

export const COMMON_APP_WORD_LIMIT = 700; // display-only, mirrors the real wizard

// ─── Extraction output ────────────────────────────────────────────────────────

export interface ExtractedActivity {
  position: string; // position / leadership role
  organization: string;
  description: string;
  gradeLevels: string; // e.g. "11, 12"
  hoursPerWeek: string;
  weeksPerYear: string;
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
  // Extras — not part of the real submission schema, surfaced in the preview.
  activities: ExtractedActivity[];
  honorsAwards: string[];
  intendedMajor: string;
  testScores: string; // e.g. "SAT 1520" or ""
  notes: string; // extraction caveats / anything else useful
}

// ─── Sandbox submission ───────────────────────────────────────────────────────

// Mirrors the payload the real wizard POSTs to /api/writer/applications,
// plus the extracted extras (kept separate under `extras`).
export interface SandboxSubmission {
  universityId: string;
  universityName: string; // denormalized for the saved JSON's readability
  admittedYear: number;
  admissionProofUrl: string; // "sandbox://<filename>" stand-in
  submittedCommonApp: boolean;
  commonAppPrompt: string | null;
  commonAppContent: string | null;
  commonAppScreenshotUrl: null; // consciously dropped in sandbox
  supplementals: ExtractedSupplemental[];
  numSupplementals: number;
  extras: {
    activities: ExtractedActivity[];
    honorsAwards: string[];
    intendedMajor: string;
    testScores: string;
    notes: string;
  };
}
