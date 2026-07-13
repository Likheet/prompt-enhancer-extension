import subscriptionManager from './subscription-manager.js';
import browserCompat from '../shared/browser-compat.js';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants.js';
import { resolveSitePreferences } from '../shared/site-preferences.js';
import EnhancementPresets from '../content/enhancement-presets.js';
import {
  mergeEnhancementSettings,
  normalizeEnhancementContext
} from './enhancement-context.js';

const enhancementPresets = new EnhancementPresets();
const activeEnhancements = new Map();
const activeEnhancementBySource = new Map();

void restrictStorageAccessToTrustedExtensionContexts();

browserCompat.api.runtime.onInstalled.addListener(async (details) => {
  await restrictStorageAccessToTrustedExtensionContexts();
  await subscriptionManager.initialize();
  if (details.reason === 'install') {
    await setDefaultSettings();
  }
});

// Content scripts keep this port open only to notice an extension reload.
// Registering a receiver prevents Chrome from immediately disconnecting it.
browserCompat.runtime.onConnect.addListener((port) => {
  if (port.name === 'ape-context-lifecycle') {
    port.onDisconnect.addListener(() => undefined);
  }
});

async function setDefaultSettings() {
  const stored = await browserCompat.storageGet([STORAGE_KEYS.SETTINGS]);
  const existing = stored[STORAGE_KEYS.SETTINGS] || {};
  await browserCompat.storageSet({
    [STORAGE_KEYS.SETTINGS]: {
      ...DEFAULT_SETTINGS,
      ...existing,
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        ...(existing.shortcuts || {})
      }
    }
  });
}

browserCompat.onMessage((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(error => {
      if (globalThis.__APE_DEBUG__ === true) {
        console.error('[APE] Message handler error:', {
          action: request?.action,
          code: error?.code || 'internal',
          message: error?.message
        });
      }
      sendResponse({
        success: false,
        error: error?.message || 'Extension request failed',
        errorCode: error?.code || 'internal'
      });
    });
  return true;
});

async function handleMessage(request, sender) {
  const { action, data } = request;

  switch (action) {
    case 'getSubscription':
      return await subscriptionManager.getSubscriptionInfo();
    case 'activateBYOK':
      return await subscriptionManager.activateBYOK(data.apiKey);
    case 'saveProviderKey':
      return await subscriptionManager.saveProviderKey(data.provider, data.apiKey);
    case 'deactivateBYOK':
      return await subscriptionManager.deactivateBYOK();
    case 'clearProviderKey':
      return await subscriptionManager.clearProviderKey(data.provider);
    case 'setProviderMode':
      return await subscriptionManager.setProviderMode(data.providerMode);
    case 'updateAPIKey':
      return await subscriptionManager.updateAPIKey(data.apiKey);
    case 'getSubscriptionInfo':
      return await subscriptionManager.getSubscriptionInfo();
    case 'trackEvent':
      await subscriptionManager.trackEvent(data.eventName, data.eventData);
      return { success: true };
    case 'getUsageStats':
      return await subscriptionManager.getUsageStats();
    case 'getSettings':
      return await getSettings();
    case 'getSitePreferences':
      return await getSitePreferences(data);
    case 'enhancePrompt':
      return await enhancePrompt(data, sender);
    case 'cancelEnhancement':
      return cancelEnhancement(data, sender);
    case 'saveSettings':
      return await saveSettings(data.settings);
    case 'openOptions':
      await browserCompat.runtime.openOptionsPage();
      return { success: true };
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function getSettings() {
  const settings = await getStoredSettings();
  const publicSettings = { ...settings };
  delete publicSettings.geminiKey;
  delete publicSettings.geminiApiKey;
  delete publicSettings.groqApiKey;
  return publicSettings;
}

async function getStoredSettings() {
  const result = await browserCompat.storageGet([STORAGE_KEYS.SETTINGS]);
  const stored = result[STORAGE_KEYS.SETTINGS];
  const settings = mergeEnhancementSettings(stored);
  return {
    ...settings,
    shortcuts: {
      ...DEFAULT_SETTINGS.shortcuts,
      ...(stored?.shortcuts || {})
    }
  };
}

async function saveSettings(settings = {}) {
  const existing = await getStoredSettings();
  const publicSettings = { ...settings };
  delete publicSettings.geminiKey;
  delete publicSettings.geminiApiKey;
  delete publicSettings.groqApiKey;

  await browserCompat.storageSet({
    // Preserve legacy keys only inside extension storage while existing users
    // move to the subscription-backed BYOK flow. They are never sent back to
    // a content script or popup through getSettings.
    [STORAGE_KEYS.SETTINGS]: {
      ...existing,
      ...publicSettings
    }
  });
  return { success: true };
}

async function getSitePreferences(data = {}) {
  const hostname = String(data.hostname || '').toLowerCase();
  const result = await browserCompat.storageGet(['managedSites']);
  return resolveSitePreferences({
    hostname,
    title: String(data.title || ''),
    managedSites: result.managedSites || []
  });
}

async function restrictStorageAccessToTrustedExtensionContexts() {
  const localStorage = browserCompat.api?.storage?.local;
  if (typeof localStorage?.setAccessLevel !== 'function') return;

  try {
    await localStorage.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  } catch (error) {
    // Firefox and older Chromium versions do not support this hardening API.
    console.warn('[APE] Could not restrict storage access to trusted contexts:', error);
  }
}

async function enhancePrompt(data = {}, sender = {}) {
  const startedAt = performance.now();
  const requestId = String(data.requestId || createRequestId());
  const sourceKey = getSourceKey(sender);
  const controller = new AbortController();

  const previousRequestId = activeEnhancementBySource.get(sourceKey);
  if (previousRequestId && previousRequestId !== requestId) {
    activeEnhancements.get(previousRequestId)?.controller.abort();
  }

  activeEnhancements.set(requestId, { controller, sourceKey });
  activeEnhancementBySource.set(sourceKey, requestId);

  try {
    const settingsStartedAt = performance.now();
    const [settings, providerConfiguration] = await Promise.all([
      getStoredSettings(),
      subscriptionManager.getProviderConfiguration()
    ]);
    const settingsAndSubscriptionMs = performance.now() - settingsStartedAt;

    if (controller.signal.aborted) throw createCancellationError();

    const contextStartedAt = performance.now();
    const context = normalizeEnhancementContext(data.context, settings);
    const workerContextPreparationMs = performance.now() - contextStartedAt;
    logDevelopmentEvent('context_normalized', {
      sourceHistoryCount: Array.isArray(data.context?.conversationHistory)
        ? data.context.conversationHistory.length
        : 0,
      normalizedHistoryCount: context.conversationHistory.length,
      sourceHistoryDiagnostics: data.context?.historyDiagnostics || null
    });
    if (!providerConfiguration.provider || !providerConfiguration.apiKey) {
      const missingKeyError = new Error('Add either a Gemini or Groq API key in Settings before enhancing.');
      missingKeyError.code = 'provider_key_required';
      throw missingKeyError;
    }

    const enhancementStartedAt = performance.now();
    const result = await enhancementPresets.enhanceWithPreset(
      context,
      data.enhancementType || settings.currentEnhancementType || 'balanced',
      data.customPrompt || null,
      {
        settings,
        provider: providerConfiguration.provider,
        apiKey: providerConfiguration.apiKey,
        returnResult: true,
        signal: controller.signal
      }
    );
    const enhancementMs = performance.now() - enhancementStartedAt;

    return {
      success: true,
      requestId,
      enhanced: result.enhanced,
      method: result.method,
      usedFallback: result.fallback,
      fallbackReason: result.fallbackReason,
      selectedProvider: providerConfiguration.selectedProvider,
      providerUsed: result.provider,
      modelUsed: result.model,
      usage: result.usage || null,
      attempts: result.attempts,
      timings: {
        settingsAndSubscriptionMs,
        workerContextPreparationMs,
        enhancementMs,
        ...result.timings,
        totalMs: performance.now() - startedAt
      }
    };
  } finally {
    activeEnhancements.delete(requestId);
    if (activeEnhancementBySource.get(sourceKey) === requestId) {
      activeEnhancementBySource.delete(sourceKey);
    }
  }
}

function logDevelopmentEvent(event, details) {
  if (globalThis.__APE_DEBUG__ === true) {
    console.warn(`[APE Worker] ${event}`, details);
  }
}

function cancelEnhancement(data = {}, sender = {}) {
  const requestId = String(data.requestId || '');
  const activeRequest = activeEnhancements.get(requestId);
  if (!activeRequest || activeRequest.sourceKey !== getSourceKey(sender)) {
    return { success: true, cancelled: false, requestId };
  }

  activeRequest.controller.abort();
  return { success: true, cancelled: true, requestId };
}

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ||
    `ape-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSourceKey(sender = {}) {
  return `${sender?.tab?.id ?? 'extension'}:${sender?.frameId ?? 0}`;
}

function createCancellationError() {
  const error = new Error('Enhancement was cancelled');
  error.code = 'cancelled';
  return error;
}
