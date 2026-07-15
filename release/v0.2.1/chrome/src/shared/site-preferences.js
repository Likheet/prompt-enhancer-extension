import { SITE_PLACEMENTS, SUPPORTED_AI_DOMAINS } from './constants.js';
import { matchesHostname } from './utils.js';

export const NATIVE_AI_DOMAINS = [
  'chatgpt.com',
  'chat.openai.com',
  'claude.ai',
  'gemini.google.com',
  'perplexity.ai',
  'aistudio.google.com'
];

const AI_TITLE_KEYWORDS = [
  'ai chat',
  'chatbot',
  'llm',
  'gpt',
  'language model',
  'artificial intelligence'
];

export function isConfigurableUrl(urlValue) {
  try {
    const url = urlValue instanceof URL ? urlValue : new URL(urlValue);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch (_error) {
    return false;
  }
}

export function findManagedSite(hostname, managedSites = []) {
  return managedSites
    .filter((site) => site?.hostname && matchesHostname(hostname, site.hostname))
    .sort((a, b) => b.hostname.length - a.hostname.length)[0] || null;
}

export function resolveSitePreferences({ hostname, title = '', managedSites = [] }) {
  const managedSite = findManagedSite(hostname, managedSites);
  const placement = Object.values(SITE_PLACEMENTS).includes(managedSite?.placement)
    ? managedSite.placement
    : SITE_PLACEMENTS.AUTO;

  if (managedSite) {
    return {
      enabled: Boolean(managedSite.enabled),
      placement,
      explicit: true,
      managedSite
    };
  }

  const native = NATIVE_AI_DOMAINS.some((domain) => matchesHostname(hostname, domain));
  const supported = SUPPORTED_AI_DOMAINS.some((domain) => matchesHostname(hostname, domain));
  const normalizedTitle = String(title).toLowerCase();
  const heuristic = AI_TITLE_KEYWORDS.some((keyword) => normalizedTitle.includes(keyword));

  return {
    enabled: native || supported || heuristic,
    placement: SITE_PLACEMENTS.AUTO,
    explicit: false,
    managedSite: null
  };
}

export function upsertSitePreference(managedSites, hostname, updates, name = hostname) {
  const nextSites = [...managedSites];
  const exactIndex = nextSites.findIndex((site) => site.hostname === hostname);
  const previous = exactIndex >= 0 ? nextSites[exactIndex] : null;
  const next = {
    hostname,
    name: previous?.name || name,
    enabled: previous?.enabled ?? true,
    placement: previous?.placement || SITE_PLACEMENTS.AUTO,
    addedAt: previous?.addedAt || Date.now(),
    ...updates
  };

  if (exactIndex >= 0) nextSites[exactIndex] = next;
  else nextSites.push(next);
  return nextSites;
}
