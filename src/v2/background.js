/**
 * Background Service Worker
 * Handles API calls and message passing between content scripts
 */

console.log('[Background] Service worker initialized');

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type);

  if (message.type === 'ENHANCE_PROMPT') {
    // Handle async enhancement
    handleEnhancePrompt(message.text)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({
          ok: false,
          error: error.message || 'Unknown error'
        });
      });

    // Return true to indicate we'll send response asynchronously
    return true;
  }

  // Other message types can be handled here
  if (message.type === 'GET_SETTINGS') {
    handleGetSettings()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    handleSaveSettings(message.settings)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

/**
 * Handle prompt enhancement
 * This is where you'd call your actual API
 */
async function handleEnhancePrompt(text) {
  console.log('[Background] Enhancing prompt:', text.substring(0, 50) + '...');

  try {
    // TODO: Replace this with your actual API call
    // For now, this is a stub that simulates enhancement
    const enhanced = await enhancePrompt(text);

    return {
      ok: true,
      text: enhanced
    };

  } catch (error) {
    console.error('[Background] Enhancement error:', error);
    return {
      ok: false,
      error: error.message || 'Enhancement failed'
    };
  }
}

/**
 * Enhance prompt - STUB IMPLEMENTATION
 * Replace this with your actual API call
 *
 * Example with fetch:
 * async function enhancePrompt(text) {
 *   const response = await fetch('https://your-api.com/enhance', {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'Authorization': 'Bearer YOUR_API_KEY'
 *     },
 *     body: JSON.stringify({ prompt: text })
 *   });
 *
 *   if (!response.ok) {
 *     throw new Error('API request failed');
 *   }
 *
 *   const data = await response.json();
 *   return data.enhanced_prompt;
 * }
 */
async function enhancePrompt(text) {
  // Simulate API delay
  await sleep(1000);

  // Stub enhancement: add some improvements
  // Replace this with your actual API call!
  const enhanced = `${text}

[Enhanced with additional context and clarity]

Please provide a detailed, well-structured response that:
1. Addresses all aspects of the original question
2. Includes relevant examples and explanations
3. Uses clear, concise language
4. Considers edge cases and nuances`;

  return enhanced;
}

/**
 * Get settings from storage
 */
async function handleGetSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['enhancer_settings'], (result) => {
      if (chrome.runtime.lastError) {
        // Fallback to local storage
        chrome.storage.local.get(['enhancer_settings'], (localResult) => {
          resolve(localResult.enhancer_settings || {});
        });
      } else {
        resolve(result.enhancer_settings || {});
      }
    });
  });
}

/**
 * Save settings to storage
 */
async function handleSaveSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ enhancer_settings: settings }, () => {
      if (chrome.runtime.lastError) {
        // Fallback to local storage
        chrome.storage.local.set({ enhancer_settings: settings }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve({ ok: true });
          }
        });
      } else {
        resolve({ ok: true });
      }
    });
  });
}

/**
 * Helper: sleep for ms milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First install - set up default settings
    initializeDefaults();
  } else if (details.reason === 'update') {
    // Extension updated - could migrate settings if needed
    console.log('[Background] Extension updated');
  }
});

/**
 * Initialize default settings on first install
 */
async function initializeDefaults() {
  console.log('[Background] Initializing default settings...');

  const defaultSettings = {
    enabled: true,
    apiKey: '',
    apiEndpoint: '',
    // Add more default settings as needed
  };

  try {
    await handleSaveSettings(defaultSettings);
    console.log('[Background] Default settings initialized');
  } catch (error) {
    console.error('[Background] Failed to initialize defaults:', error);
  }
}

/**
 * Handle extension icon click (optional)
 */
chrome.action.onClicked.addListener((tab) => {
  console.log('[Background] Extension icon clicked on tab:', tab.id);

  // You could open an options page or perform some action
  // For now, just log it
});

// Keep service worker alive (Manifest V3 workaround)
// Service workers can be terminated by the browser, this helps keep it responsive
let keepAliveInterval;

function keepAlive() {
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      // Just a dummy call to keep the service worker alive
    });
  }, 20000); // Every 20 seconds
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
}

// Start keep-alive
keepAlive();

// Clean up on suspend
self.addEventListener('suspend', () => {
  console.log('[Background] Service worker suspending...');
  stopKeepAlive();
});

export { enhancePrompt, handleEnhancePrompt, handleGetSettings, handleSaveSettings };
