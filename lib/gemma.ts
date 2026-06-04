/**
 * Legacy module name — vibe search now uses Anthropic via {@link ./vibe-anthropic}.
 */
export {
  buildVibeSearchText,
  tagApplicationEssays as tagEssay,
  parseVibeSearchQuery as parseSearchQuery,
  getEssayHighlight,
  type EssayVibeMetadata,
  type SearchIntent,
} from "./vibe-anthropic";
