# AI Prompt Enhancer Extension

A cross-browser extension that intelligently enhances AI prompts by analyzing conversation context and optimizing user inputs across multiple AI chat platforms (ChatGPT, Claude, etc.).

## Features

- **Context-Aware Enhancement**: Analyzes conversation history to provide relevant context
- **Multiple Enhancement Strategies**: Rule-based (free) and AI-powered (BYOK with Gemini)
- **Platform Support**: Works with ChatGPT and Claude AI (more platforms coming soon)
- **Resilient DOM Detection**: Advanced selectors that adapt to platform UI changes
- **Inline Diff View**: See exactly what changes were made to your prompt
- **Two Subscription Tiers**:
  - **Free**: Rule-based prompt enhancement with intelligent strategies
  - **BYOK (Bring Your Own Key)**: AI-powered enhancement using your Gemini API key

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/prompt-enhancer-extension.git
   cd prompt-enhancer-extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `prompt-enhancer-extension` directory

### From Chrome Web Store

*(Coming soon)*

## Usage

### Basic Usage (Free Tier)

1. Visit ChatGPT or Claude AI
2. Start typing a prompt in the input field
3. Click the floating ✨ button that appears in the bottom-right corner
4. Click "Enhance" to improve your prompt using rule-based strategies
5. Review the enhanced version and click "Apply" or "Copy"

### BYOK Tier (AI-Powered)

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click the extension icon in your browser toolbar
3. Click "Setup" in the BYOK section
4. Paste your API key and click "Save Key"
5. Now your prompts will be enhanced using Gemini AI!

## Enhancement Strategies

The extension uses different enhancement strategies based on your prompt characteristics:

### Rule-Based Strategies (Free Tier)

- **Clarification**: Adds context for vague prompts with pronouns or short queries
- **Contextual**: Incorporates relevant conversation history
- **Structured**: Organizes prompts into clear sections (Background, Goal, Requirements)
- **Technical**: Adds technical specifications for code-related prompts
- **Creative**: Adds creative guidelines for writing tasks
- **General**: Balanced enhancement for general queries

### AI-Powered Enhancement (BYOK)

Uses Google's Gemini API to provide intelligent, context-aware enhancements that:
- Maintain your original intent
- Add necessary context from conversation
- Structure prompts optimally for the target AI
- Remove ambiguity while staying concise

## Settings

Access settings by clicking the extension icon:

- **Enhancement Level**: Choose Light, Moderate, or Aggressive enhancement
- **Context Window**: Number of previous messages to consider (1-20)
- **Auto-enhance**: Automatically enhance when you focus on the input (coming soon)
- **Show Diff**: Display changes made to your prompt

## Architecture

```
prompt-enhancer-extension/
├── manifest.json               # Extension manifest (Chrome v3)
├── src/
│   ├── background/
│   │   ├── service-worker.js  # Background service worker
│   │   └── subscription-manager.js # Subscription handling
│   ├── content/
│   │   ├── main.js            # Content script entry point
│   │   ├── dom-observer.js    # Resilient DOM manipulation
│   │   ├── context-extractor.js # Conversation analysis
│   │   ├── prompt-enhancer.js # Enhancement engine
│   │   └── floating-ui.js     # UI components
│   ├── popup/
│   │   ├── popup.html         # Settings popup
│   │   ├── popup.js           # Popup logic
│   │   └── popup.css          # Popup styles
│   └── shared/
│       ├── browser-compat.js  # Cross-browser compatibility
│       ├── constants.js       # Application constants
│       └── utils.js           # Utility functions
├── assets/
│   ├── icons/                 # Extension icons
│   └── styles/
│       └── floating-ui.css    # Floating UI styles
└── tests/                     # Test files
```

## Platform Support

| Platform | Support Status | Notes |
|----------|---------------|-------|
| ChatGPT  | ✅ Full       | Both `chat.openai.com` and `chatgpt.com` |
| Claude AI | ✅ Full      | Works with Claude Pro and Free |
| Gemini   | 🚧 Planned    | Coming in v0.2.0 |
| Poe      | 🚧 Planned    | Coming in v0.3.0 |
| Perplexity | 🚧 Planned  | Coming in v0.3.0 |

## Privacy & Security

- **No Data Collection**: We don't collect or store your prompts or conversations
- **Local Processing**: Free tier enhancement happens entirely in your browser
- **Secure API Calls**: BYOK tier uses HTTPS for all API communications
- **API Key Storage**: Your Gemini API key is stored locally using Chrome's secure storage API
- **XSS Protection**: All prompt injections are sanitized to prevent XSS attacks

## Development

### Prerequisites

- Node.js 16+ and npm
- Chrome/Chromium browser

### Building

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run watch

# Production build
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

### Testing

1. Make changes to the code
2. The extension will auto-reload if using `npm run watch`
3. Otherwise, click the refresh icon on the extension card in `chrome://extensions/`
4. Test on ChatGPT or Claude

### Project Structure

- `src/content/*` - Runs on AI chat pages
- `src/background/*` - Service worker (persistent background script)
- `src/popup/*` - Extension popup UI
- `src/shared/*` - Shared utilities and constants

## Troubleshooting

### Extension not showing up

- Make sure you're on a supported platform (ChatGPT or Claude)
- Check that you've typed something in the input field
- Refresh the page

### Enhancement not working

- Check the browser console for errors (F12)
- Verify your API key if using BYOK tier
- Try the Free tier to rule out API issues

### DOM selectors breaking

The extension uses resilient multi-strategy selectors, but if platforms make major changes:

1. Check for updates to the extension
2. Report the issue on GitHub
3. The extension will attempt fallback strategies automatically

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

### v0.2.0 (Q1 2025)
- [ ] Gemini web app support
- [ ] Firefox extension variant
- [ ] Prompt templates library
- [ ] Enhancement history

### v0.3.0 (Q2 2025)
- [ ] Poe and Perplexity support
- [ ] Team sharing features
- [ ] Custom enhancement rules
- [ ] Advanced analytics

### v1.0.0 (Q3 2025)
- [ ] Premium tier with dedicated API
- [ ] Multi-language support
- [ ] Browser action shortcuts
- [ ] Export/import settings

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- 📖 [Documentation](https://github.com/yourusername/prompt-enhancer-extension/wiki)
- 🐛 [Report Issues](https://github.com/yourusername/prompt-enhancer-extension/issues)
- 💬 [Discussions](https://github.com/yourusername/prompt-enhancer-extension/discussions)

## Acknowledgments

- Built with insights from the AI prompt engineering community
- Inspired by Grammarly's approach to writing assistance
- Uses Google's Gemini API for AI-powered enhancement (BYOK tier)

---

Made with ❤️ for better AI interactions
