import { DEFAULT_SETTINGS } from '../shared/constants.js';

export const MAX_CONTEXT_CHARACTERS = 12000;
export const MAX_MESSAGE_CHARACTERS = 2000;

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function clipMessage(content, limit = MAX_MESSAGE_CHARACTERS) {
  if (content.length <= limit) return content;

  const separator = '\n…\n';
  const available = Math.max(0, limit - separator.length);
  const headLength = Math.ceil(available * 0.65);
  return `${content.slice(0, headLength)}${separator}${content.slice(-(available - headLength))}`;
}

function getContextWindow(value) {
  const configured = Number(value);
  if (!Number.isFinite(configured)) return DEFAULT_SETTINGS.contextWindow;
  return Math.max(1, Math.min(20, Math.floor(configured)));
}

export function mergeEnhancementSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings && typeof settings === 'object' ? settings : {})
  };
}

export function normalizeEnhancementContext(rawContext = {}, rawSettings = {}) {
  const settings = mergeEnhancementSettings(rawSettings);
  const currentPrompt = String(rawContext?.currentPrompt ?? '').trim();
  if (!currentPrompt) {
    const error = new Error('No prompt to enhance');
    error.code = 'prompt_empty';
    throw error;
  }

  const awarenessEnabled = settings.conversationAwareness !== false;
  const contextWindow = getContextWindow(settings.contextWindow);
  const currentPromptKey = normalizeText(currentPrompt);
  const sourceMessages = awarenessEnabled && Array.isArray(rawContext?.conversationHistory)
    ? rawContext.conversationHistory.slice(-contextWindow)
    : [];
  let trailingDraftIndex = -1;

  for (let index = sourceMessages.length - 1; index >= 0; index -= 1) {
    const message = sourceMessages[index];
    if (message?.role !== 'user' && message?.role !== 'assistant') continue;

    const content = String(message?.content ?? '').trim();
    if (!content) continue;
    if (message.role === 'user' && normalizeText(content) === currentPromptKey) {
      trailingDraftIndex = index;
    }
    break;
  }

  let remaining = MAX_CONTEXT_CHARACTERS;
  const newestFirst = [];

  for (let index = sourceMessages.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = sourceMessages[index];
    if (message?.role !== 'user' && message?.role !== 'assistant') continue;

    const content = String(message?.content ?? '').trim();
    if (!content || index === trailingDraftIndex) continue;

    const clipped = clipMessage(content);
    if (clipped.length > remaining) {
      if (newestFirst.length === 0) {
        newestFirst.push({ role: message.role, content: clipMessage(clipped, remaining) });
      }
      continue;
    }

    newestFirst.push({ role: message.role, content: clipped });
    remaining -= clipped.length;
  }

  return {
    ...rawContext,
    currentPrompt,
    conversationHistory: newestFirst.reverse(),
    metadata: rawContext?.metadata && typeof rawContext.metadata === 'object'
      ? rawContext.metadata
      : {}
  };
}
