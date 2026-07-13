const { loadBundledModule } = require('./helpers/load-module');

const {
  findManagedSite,
  isConfigurableUrl,
  resolveSitePreferences,
  upsertSitePreference
} = loadBundledModule('src/shared/site-preferences.js');

describe('site preferences', () => {
  test('uses the most specific matching site rule', () => {
    const sites = [
      { hostname: 'example.com', enabled: false },
      { hostname: 'chat.example.com', enabled: true, placement: 'before-send' }
    ];

    expect(findManagedSite('chat.example.com', sites).hostname).toBe('chat.example.com');
    expect(resolveSitePreferences({ hostname: 'chat.example.com', managedSites: sites })).toMatchObject({
      enabled: true,
      placement: 'before-send',
      explicit: true
    });
  });

  test('keeps popup defaults aligned with supported and heuristic sites', () => {
    expect(resolveSitePreferences({ hostname: 'poe.com' }).enabled).toBe(true);
    expect(resolveSitePreferences({ hostname: 'commandcode.ai' }).enabled).toBe(true);
    expect(resolveSitePreferences({ hostname: 'example.test', title: 'Helpful AI Chat' }).enabled).toBe(true);
    expect(resolveSitePreferences({ hostname: 'example.test', title: 'News' }).enabled).toBe(false);
  });

  test('upserts placement without losing the enabled state', () => {
    const updated = upsertSitePreference(
      [{ hostname: 'claude.ai', name: 'Claude', enabled: false, addedAt: 1 }],
      'claude.ai',
      { placement: 'after-attach' }
    );

    expect(updated[0]).toMatchObject({
      enabled: false,
      placement: 'after-attach',
      addedAt: 1
    });
  });

  test('allows only normal web page protocols', () => {
    expect(isConfigurableUrl('https://chatgpt.com/')).toBe(true);
    expect(isConfigurableUrl('chrome://extensions/')).toBe(false);
    expect(isConfigurableUrl('about:blank')).toBe(false);
  });
});
