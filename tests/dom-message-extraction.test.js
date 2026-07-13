const { loadBundledModule } = require('./helpers/load-module');

function createElement({
  text,
  visibleText = text,
  classes = [],
  attributes = {},
  hidden = false,
  order = 0
}) {
  const className = classes.join(' ');
  const element = {
    tagName: 'DIV',
    className,
    textContent: text,
    innerText: hidden ? '' : visibleText,
    hidden,
    isConnected: true,
    isContentEditable: attributes.contenteditable === 'true',
    order,
    parentElement: null,
    attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })),
    getAttribute: jest.fn((name) => attributes[name] ?? null),
    hasAttribute: jest.fn((name) => Object.prototype.hasOwnProperty.call(attributes, name)),
    matches: jest.fn((selector) => {
      if (selector === '.message') return classes.includes('message');
      if (selector === '.user') return classes.includes('user');
      if (selector === '.assistant') return classes.includes('assistant');
      if (selector === '[data-message-author-role="user"]') {
        return attributes['data-message-author-role'] === 'user';
      }
      if (selector === '[data-message-author-role="assistant"]') {
        return attributes['data-message-author-role'] === 'assistant';
      }
      return false;
    }),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    contains(other) {
      let current = other;
      while (current) {
        if (current === this) return true;
        current = current.parentElement;
      }
      return false;
    },
    compareDocumentPosition(other) {
      if (this.order < other.order) return 4;
      if (this.order > other.order) return 2;
      return 0;
    }
  };

  return element;
}

function createObserverFixture(messageElements) {
  const body = {
    tagName: 'BODY',
    className: '',
    querySelectorAll: jest.fn(() => messageElements)
  };
  messageElements.forEach((element) => {
    element.parentElement = body;
  });

  const document = {
    body,
    activeElement: null
  };
  const window = {
    location: { hostname: 'example.test' },
    getComputedStyle: (element) => ({
      display: element.hidden ? 'none' : 'block',
      visibility: 'visible',
      opacity: '1'
    })
  };
  const Node = {
    DOCUMENT_POSITION_PRECEDING: 2,
    DOCUMENT_POSITION_FOLLOWING: 4
  };
  const { default: ResilientDOMObserver } = loadBundledModule(
    'src/content/dom-observer.js',
    { document, window, Node }
  );
  const observer = Object.create(ResilientDOMObserver.prototype);
  observer.platform = 'generic';
  observer.selectors = {
    conversationArea: ['body'],
    messageContainer: ['.message'],
    userMessage: ['.user', '[data-message-author-role="user"]'],
    assistantMessage: ['.assistant', '[data-message-author-role="assistant"]']
  };
  observer.findElement = jest.fn(() => body);

  return { document, observer };
}

describe('ResilientDOMObserver message extraction contracts', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('keeps short and Unicode-only conversation messages', () => {
    const shortUser = createElement({
      text: 'Why?',
      classes: ['message', 'user'],
      order: 1
    });
    const unicodeAssistant = createElement({
      text: '请保留现有的公开接口。',
      classes: ['message', 'assistant'],
      order: 2
    });
    const { observer } = createObserverFixture([shortUser, unicodeAssistant]);

    expect(observer.extractMessages().map(({ role, content }) => ({ role, content }))).toEqual([
      { role: 'user', content: 'Why?' },
      { role: 'assistant', content: '请保留现有的公开接口。' }
    ]);
  });

  test('excludes hidden, streaming, composer, and unknown-role elements', () => {
    const validUser = createElement({
      text: 'Use the earlier API decision.',
      classes: ['message', 'user'],
      order: 1
    });
    const hiddenAssistant = createElement({
      text: 'Hidden private instruction',
      classes: ['message', 'assistant'],
      attributes: { 'aria-hidden': 'true' },
      hidden: true,
      order: 2
    });
    const streamingAssistant = createElement({
      text: 'Incomplete response still streaming',
      classes: ['message', 'assistant'],
      attributes: { 'data-is-streaming': 'true' },
      order: 3
    });
    const composer = createElement({
      text: 'Current unsent draft',
      classes: ['message', 'composer', 'user'],
      attributes: { contenteditable: 'true', role: 'textbox' },
      order: 4
    });
    const unknown = createElement({
      text: 'Unrelated message-shaped page content',
      classes: ['message'],
      order: 5
    });
    const validAssistant = createElement({
      text: 'The earlier API decision was to preserve compatibility. Hidden feedback control',
      visibleText: 'The earlier API decision was to preserve compatibility.',
      classes: ['message', 'assistant'],
      attributes: { 'data-is-streaming': 'false' },
      order: 6
    });
    const { document, observer } = createObserverFixture([
      validUser,
      hiddenAssistant,
      streamingAssistant,
      composer,
      unknown,
      validAssistant
    ]);
    document.activeElement = composer;

    expect(observer.extractMessages().map(({ role, content }) => ({ role, content }))).toEqual([
      { role: 'user', content: 'Use the earlier API decision.' },
      { role: 'assistant', content: 'The earlier API decision was to preserve compatibility.' }
    ]);
  });

  test('bounds extraction work to the newest requested messages', () => {
    const elements = Array.from({ length: 100 }, (_, index) => createElement({
      text: `Conversation turn ${index + 1}`,
      classes: ['message', index % 2 === 0 ? 'user' : 'assistant'],
      order: index
    }));
    const { observer } = createObserverFixture(elements);

    const messages = observer.extractMessages(6);

    expect(messages.map(message => message.content)).toEqual([
      'Conversation turn 95',
      'Conversation turn 96',
      'Conversation turn 97',
      'Conversation turn 98',
      'Conversation turn 99',
      'Conversation turn 100'
    ]);
    expect(elements[0].matches).not.toHaveBeenCalled();
  });

  test('excludes a nested Claude response while an ancestor is streaming', () => {
    const streamingWrapper = createElement({
      text: 'Partial wrapper response',
      classes: ['message', 'assistant'],
      attributes: { 'data-is-streaming': '' },
      order: 1
    });
    const nestedResponse = createElement({
      text: 'Partial nested response',
      classes: ['message', 'assistant'],
      order: 2
    });
    const completedResponse = createElement({
      text: 'Completed response',
      classes: ['message', 'assistant'],
      attributes: { 'data-is-streaming': 'false' },
      order: 3
    });
    const { document, observer } = createObserverFixture([
      streamingWrapper,
      nestedResponse,
      completedResponse
    ]);
    nestedResponse.parentElement = streamingWrapper;
    streamingWrapper.parentElement = document.body;

    expect(observer.extractMessages().map(message => message.content)).toEqual([
      'Completed response'
    ]);
  });

  test('removes nested control text from a visible assistant message', () => {
    const assistant = createElement({
      text: 'Use the stable API. Copy',
      classes: ['message', 'assistant'],
      order: 1
    });
    assistant.querySelectorAll.mockReturnValue([{ innerText: 'Copy', textContent: 'Copy' }]);
    const { observer } = createObserverFixture([assistant]);

    expect(observer.extractMessages().map(message => message.content)).toEqual([
      'Use the stable API.'
    ]);
  });

  test('uses a single nested role marker to recover a canonical chat turn', () => {
    const roleMarker = createElement({
      text: '',
      attributes: { 'data-message-author-role': 'user' },
      order: 2
    });
    const wrapper = createElement({
      text: 'Preserve the API choice from earlier.',
      classes: ['message', 'chat-turn'],
      order: 1
    });
    wrapper.querySelectorAll.mockImplementation((selector) => (
      selector.includes('[data-message-author-role="user"]') ? [roleMarker] : []
    ));
    roleMarker.parentElement = wrapper;

    const { observer } = createObserverFixture([wrapper]);

    expect(observer.extractMessages()).toMatchObject([
      { role: 'user', content: 'Preserve the API choice from earlier.' }
    ]);
    expect(observer.getMessageExtractionDiagnostics()).toMatchObject({
      candidateCount: 1,
      canonicalTurnCount: 1,
      returnedMessageCount: 1
    });
  });
});
