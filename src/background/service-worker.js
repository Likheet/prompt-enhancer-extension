import subscriptionManager from './subscription-manager.js';
import browserCompat from '../shared/browser-compat.js';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants.js';

browserCompat.api.runtime.onInstalled.addListener(async (details) => {
  console.log('[APE] Extension installed:', details.reason);
  await subscriptionManager.initialize();
  if (details.reason === 'install') {
    await setDefaultSettings();
  }
});

async function setDefaultSettings() {
  await browserCompat.storageSet({
    [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
  });
  console.log('[APE] Default settings initialized');
}

browserCompat.onMessage((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('[APE] Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });
  return true;
});

async function handleMessage(request) {
  const { action, data } = request;

  switch (action) {
    case 'getSubscription':
      return await subscriptionManager.getActiveSubscription();
    case 'activateBYOK':
      return await subscriptionManager.activateBYOK(data.apiKey);
    case 'deactivateBYOK':
      return await subscriptionManager.deactivateBYOK();
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
  const result = await browserCompat.storageGet([STORAGE_KEYS.SETTINGS]);
  return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
}

async function saveSettings(settings) {
  await browserCompat.storageSet({
    [STORAGE_KEYS.SETTINGS]: settings
  });
  return { success: true };
}

console.log('[APE] Background service worker loaded');
