# AI Prompt Enhancer Extension ✨

A powerful Chrome extension that intelligently enhances AI prompts by analyzing conversation context and optimizing user inputs across multiple AI chat platforms (ChatGPT, Claude, and more).

## 🎯 Key Features

### 🚀 **Inline Enhancement**
- **Seamless Integration**: Button appears inline beside the chat input (not floating)
- **Platform-Aware**: Automatically adapts to ChatGPT and Claude AI
- **One-Click Enhancement**: Instant prompt improvement with visual feedback
- **Smart Context**: Analyzes conversation history for relevant context

### 🎨 **6 Enhancement Presets**
Choose the perfect enhancement style for your needs:
- **🎯 Concise & Clear**: Direct, specific prompts with minimal fluff
- **📋 Detailed & Comprehensive**: Thorough prompts with full context
- **⚖️ Balanced Enhancement**: Optimal clarity and completeness (default)
- **💻 Technical Optimization**: Perfect for coding and technical tasks
- **✨ Creative Enhancement**: Optimized for writing and creative work
- **🔧 Custom Enhancement**: Use your own enhancement instructions

### ⌨️ **Powerful Keyboard Shortcuts**
- **Alt+E**: Enhance current prompt instantly
- **Alt+1/2/3**: Quick-switch between your configured presets
- **Alt+C**: Open quick custom prompt editor
- **Visual Feedback**: Clear notifications for every action

### ⚙️ **Comprehensive Settings**
- **Enhancement Presets**: Visual cards to select your preferred style
- **Custom Instructions**: Write your own enhancement rules
- **Keyboard Shortcuts**: Configure Alt+1/2/3 to your favorite presets
- **BYOK Support**: Use your own Gemini API key for AI-powered enhancements
- **Usage Statistics**: Track your enhancement count

### 🔐 **Flexible Subscription Model**
- **Free Tier**: Intelligent rule-based enhancement
- **BYOK (Bring Your Own Key)**: AI-powered with your Gemini API key
  - Get your free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
  - Pay only for what you use (Google's pricing)
  - Full control of your data

---

## 📦 Installation

### From Source (Developer Mode)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Likheet/prompt-enhancer-extension.git
   cd prompt-enhancer-extension
   ```

2. **Install dependencies and build the extension**:
   ```bash
   npm install
   npm run build
   ```

3. **Load in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `prompt-enhancer-extension` directory

4. **Verify Installation**:
   - Extension icon should appear in toolbar
   - Visit ChatGPT or Claude to see it in action

### From Chrome Web Store

*(Coming soon - In review)*

---

## 🎮 Quick Start

### Basic Usage (Free Tier)

1. **Visit ChatGPT or Claude AI**
2. **Start typing a prompt** in the input field
3. **Click the inline enhance button** (appears beside textarea with gradient background)
4. **See your enhanced prompt** applied instantly!

**Example:**
- **Before**: "fix this code"
- **After**: "Please help me debug this code. Review the error and provide a corrected version with clear comments explaining the fix."

### AI-Powered (BYOK Tier)

1. **Get a Gemini API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Click "Create API Key"
   - Copy your key

2. **Configure Extension**:
   - Right-click extension icon → **Options**
   - Scroll to "API Configuration"
   - Paste your API key
   - Click "Save API Key"

3. **Start Enhancing**:
   - Your prompts now use AI-powered enhancement
   - More intelligent, context-aware improvements
   - Subscription badge shows "BYOK Tier"

### Using Keyboard Shortcuts

1. **Configure Your Shortcuts** (optional):
   - Right-click extension icon → **Options**
   - Find "Keyboard Shortcuts" section
   - Set Alt+1/2/3 to your favorite presets

2. **Use Shortcuts**:
   - Type a prompt
   - Press **Alt+E** to enhance instantly
   - Press **Alt+1/2/3** to switch presets
   - Press **Alt+C** to edit custom instructions

---

## 🎨 Enhancement Presets Explained

### 🎯 Concise & Clear
**Best for**: Quick questions, simple requests
**What it does**: Removes fluff, makes requirements explicit, adds specific details
**Example**: "tell me about python" → "Provide a concise overview of Python programming language, focusing on its key features and primary use cases."

### 📋 Detailed & Comprehensive
**Best for**: Complex questions, research, thorough analysis
**What it does**: Adds context, specifies output format, includes edge cases
**Example**: "compare options" → "Compare the following options in detail: [list from context]. Analyze pros/cons, use cases, and provide a recommendation with reasoning."

### ⚖️ Balanced Enhancement
**Best for**: General use, everyday prompts
**What it does**: Clarifies ambiguity, adds necessary context, structures clearly
**Example**: "how does this work?" → "Explain how [topic from context] works, including the main components and their interactions. Provide a clear, step-by-step explanation suitable for a general audience."

### 💻 Technical Optimization
**Best for**: Coding, debugging, technical questions
**What it does**: Adds language/version specs, error handling, testing requirements
**Example**: "write a function" → "Write a [language] function that [goal]. Include: proper error handling, input validation, clear comments, type hints, and example usage. Follow best practices for [language]."

### ✨ Creative Enhancement
**Best for**: Writing, storytelling, creative work
**What it does**: Adds tone/style, specifies audience, includes creative constraints
**Example**: "write a story" → "Write an engaging short story about [topic]. Tone: [style]. Target audience: [demographic]. Length: [range]. Include vivid descriptions and compelling characters."

### 🔧 Custom Enhancement
**Best for**: Specialized workflows, personal preferences
**What it does**: Applies your own custom enhancement instructions
**Setup**: Press Alt+C or go to Options → Custom Enhancement Instructions

---

## ⚙️ Settings & Configuration

Access full settings: **Right-click extension icon → Options**

### Enhancement Type
- Select from 6 preset cards
- Each preset shows description and emoji
- Custom preset reveals textarea for instructions

### Keyboard Shortcuts
- Configure Alt+1/2/3 to quick-switch presets
- Alt+E always enhances (not configurable)
- Alt+C always opens custom editor (not configurable)

### API Configuration
- **BYOK (Gemini)**: Paste your API key
- Validation on save
- Secure local storage
- Remove anytime

### General Settings
- **Enhancement Level**: Light / Moderate / Aggressive
- **Context Window**: 1-20 previous messages to consider
- **Auto-enhance**: Enable/disable auto-enhancement
- **Show Diff**: Toggle diff view (future feature)

### Platform Support
- ✅ **ChatGPT** (chat.openai.com, chatgpt.com)
- ✅ **Claude AI** (claude.ai)
- ✅ **Gemini** (gemini.google.com)
- ✅ **Perplexity** (perplexity.ai)
- ✅ **Google AI Studio** (aistudio.google.com)
- 🧪 **Other AI sites** through the generic adapter or per-site enablement

### Usage Statistics
- **Total Enhancements**: All-time count
- **BYOK Enhancements**: AI-powered count
- **Free Tier Enhancements**: Rule-based count

---

## 🎯 Use Cases

### For Developers
```
Before: "debug this"
After: "Review this [language] code for bugs. Identify the issue, explain why it's happening, and provide a corrected version with comments explaining the fix."
```

### For Writers
```
Before: "make this better"
After: "Improve this text for clarity, engagement, and flow. Maintain the original tone while enhancing readability. Target audience: [context]. Suggest specific improvements."
```

### For Researchers
```
Before: "explain this topic"
After: "Provide a comprehensive explanation of [topic], including: background, key concepts, current state-of-the-art, practical applications, and areas of ongoing research. Use clear examples."
```

### For Students
```
Before: "help with homework"
After: "Help me understand [topic from context]. Explain the core concepts, provide step-by-step guidance, and include practice examples I can work through independently."
```

---

## 🏗️ Architecture

```
prompt-enhancer-extension/
├── manifest.json                     # Extension manifest (Chrome v3)
├── src/
│   ├── background/
│   │   ├── service-worker.js         # Background service worker
│   │   └── subscription-manager.js   # Subscription handling
│   ├── content/
│   │   ├── main.js                   # Content script entry point
│   │   ├── inline-ui.js              # Inline button UI component
│   │   ├── dom-observer.js           # Platform-aware DOM manipulation
│   │   ├── context-extractor.js      # Conversation analysis
│   │   ├── prompt-enhancer.js        # Enhancement engine
│   │   ├── enhancement-presets.js    # 6 enhancement presets
│   │   └── keyboard-shortcuts.js     # Keyboard controls
│   ├── options/
│   │   ├── options.html              # Settings page
│   │   ├── options.js                # Settings logic
│   │   └── options.css               # Settings styles
│   ├── popup/
│   │   ├── popup.html                # Extension popup
│   │   ├── popup.js                  # Popup logic
│   │   └── popup.css                 # Popup styles
│   └── shared/
│       ├── browser-compat.js         # Cross-browser compatibility
│       ├── constants.js              # Application constants
│       └── utils.js                  # Utility functions
├── assets/
│   ├── icons/                        # Extension icons
│   └── styles/
│       └── inline-ui.css             # Inline UI styles
├── tests/                            # Unit, contract, security, and browser smoke tests
└── TESTING.md                        # Testing guide
```

---

## 🔒 Privacy & Security

- **No Data Collection**: We don't collect, store, or transmit your prompts or conversations
- **Local Processing**: Free tier enhancement happens entirely in your browser
- **Local Storage**: API keys remain in browser extension storage and are masked in the UI
- **HTTPS Only**: All API calls use encrypted connections
- **No Remote Code**: No code is loaded from external servers
- **Open Source**: Full source code available for audit

### BYOK Privacy
- Your API key never leaves your device (except to call Gemini)
- Prompts sent directly to Google's Gemini API (your account)
- We never see your prompts or API usage
- You control your data and billing

---

## 🚀 Roadmap

### v0.2.0 (Coming Soon)
- [ ] Additional platform-specific adapter hardening
- [ ] Diff viewer (show changes made)
- [ ] Enhancement history
- [ ] Export/import settings

### v0.3.0
- [ ] Native Poe support
- [ ] Firefox extension variant
- [ ] Prompt templates library
- [ ] Custom platform configuration tool

### v1.0.0
- [ ] Premium tier with dedicated API
- [ ] Team collaboration features
- [ ] Advanced analytics
- [ ] Multi-language support

---

## 🛠️ Development

### Prerequisites
- Node.js 16+ and npm
- Chrome/Chromium browser

### Setup
```bash
# Clone repository
git clone https://github.com/Likheet/prompt-enhancer-extension.git
cd prompt-enhancer-extension

# Install dependencies
npm install

# Load extension in Chrome (see Installation section)
```

### Testing
```bash
# Run tests
npm test

# Run linter
npm run lint

# Build and run the Chromium extension smoke test
npm run test:e2e
```

See [TESTING.md](./TESTING.md) for comprehensive testing guide.

---

## 📊 Technical Details

### Enhancement Process
1. **Context Extraction**: Analyzes last N messages (configurable)
2. **Intent Detection**: Identifies prompt type (question, code, creative, etc.)
3. **Preset Selection**: Applies selected enhancement preset
4. **Enhancement**: Uses rule-based or AI-powered enhancement
5. **Injection**: Replaces original text in chatbox
6. **Feedback**: Shows success toast with notification

### Supported Platforms
- **ChatGPT**: Both chat.openai.com and chatgpt.com domains
- **Claude AI**: claude.ai (both free and pro)
- Uses resilient multi-strategy selectors
- Adapts to UI changes automatically

### API Usage (BYOK)
- **Provider**: Google Gemini (`gemini-3.5-flash`)
- **Rate Limits**: Governed by your Google account
- **Pricing**: See [Google's pricing](https://ai.google.dev/pricing)
- **Fallback**: Automatic fallback to rule-based on errors

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Test on ChatGPT and Claude

---

## 🐛 Troubleshooting

### Extension not showing up
- Make sure you're on ChatGPT or Claude
- Refresh the page
- Check Chrome DevTools console for errors
- Try reloading the extension

### Enhancement not working
- Check internet connection (for BYOK)
- Verify API key is valid (for BYOK)
- Try free tier to isolate issues
- Check console for error messages

### Button not appearing
- Wait 2 seconds after page load
- Check that you've typed something in the input
- Try refreshing the page
- Ensure extension is enabled

### Keyboard shortcuts not working
- Check you're focused on chat input
- Verify shortcuts configured in Options
- Try clicking enhance button instead
- Check for conflicting browser shortcuts

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with insights from the AI prompt engineering community
- Inspired by Grammarly's approach to writing assistance
- Uses Google's Gemini API for AI-powered enhancement (BYOK tier)
- Special thanks to all contributors and testers

---

## 📞 Support

- **Documentation**: [Wiki](https://github.com/Likheet/prompt-enhancer-extension/wiki)
- **Bug Reports**: [GitHub Issues](https://github.com/Likheet/prompt-enhancer-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Likheet/prompt-enhancer-extension/discussions)
- **Email**: support@example.com *(Update with your email)*

---

## ⭐ Show Your Support

If you find this extension helpful, please:
- ⭐ Star the repository on GitHub
- 🐦 Share on Twitter/X
- 📝 Write a review on Chrome Web Store (when available)
- 🤝 Contribute to the project

---

**Made with ❤️ by the AI Prompt Enhancer Team**

Enhance your AI interactions, one prompt at a time. ✨
