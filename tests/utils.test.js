const { loadBundledModule } = require('./helpers/load-module');

const { matchesHostname } = loadBundledModule('src/shared/utils.js');

describe('matchesHostname', () => {
  test.each([
    ['chatgpt.com', 'chatgpt.com', true],
    ['sub.chatgpt.com', 'chatgpt.com', true],
    ['notchatgpt.com', 'chatgpt.com', false],
    ['chatgpt.com.example.org', 'chatgpt.com', false],
    ['', 'chatgpt.com', false],
    ['chatgpt.com', '', false]
  ])('matches %s against %s safely', (hostname, domain, expected) => {
    expect(matchesHostname(hostname, domain)).toBe(expected);
  });
});
