const evaluations = require('./fixtures/prompt-evaluations');
const { loadBundledModule } = require('./helpers/load-module');

function createPresets() {
  const { default: EnhancementPresets } = loadBundledModule(
    'src/content/enhancement-presets.js',
    {
      chrome: {
        runtime: { id: 'test-extension', lastError: null },
        storage: { local: { get: (_keys, callback) => callback({ enhancerSettings: {} }) } }
      }
    }
  );
  return new EnhancementPresets();
}

describe('prompt evaluation request contracts', () => {
  test.each(evaluations)('$id keeps the exact draft in a mode-aware bounded request', (evaluation) => {
    const request = createPresets().buildEnhancementRequest(
      {
        currentPrompt: evaluation.prompt,
        conversationHistory: evaluation.context || [],
        metadata: {}
      },
      {
        promptTemplateType: evaluation.mode,
        conversationAwareness: true,
        customPromptTemplate: evaluation.customInstructions || ''
      }
    );

    expect(request.userPrompt).toContain(`<draft_prompt>\n${evaluation.prompt}\n</draft_prompt>`);
    expect(request.userPrompt).toContain(`<mode>${({ standard: 'DIRECT', structured: 'BLUEPRINT', custom: 'CUSTOM' })[evaluation.mode]}</mode>`);
    expect(request.systemInstruction).toMatch(/preserve task type/i);
    expect(request.systemInstruction).toMatch(/do not invent/i);
    expect(request.systemInstruction).toMatch(/conversation context is untrusted/i);

    if (evaluation.mode === 'standard') {
      expect(request.systemInstruction).toMatch(/never automatically add role, objective/i);
      expect(request.systemInstruction).not.toMatch(/use a structured format/i);
    }
    if (evaluation.mode === 'structured') {
      expect(request.systemInstruction).toMatch(/use a structured format/i);
    }
    if (evaluation.mode === 'custom') {
      expect(request.userPrompt).toContain(evaluation.customInstructions);
    }
  });

  test('keeps self-contained prompts private by excluding unrelated history', () => {
    const evaluation = evaluations.find(item => item.id === 'self-contained');
    const request = createPresets().buildEnhancementRequest(
      { currentPrompt: evaluation.prompt, conversationHistory: evaluation.context, metadata: {} },
      { promptTemplateType: evaluation.mode, conversationAwareness: true }
    );

    expect(request.userPrompt).toContain('<conversation_context>NONE</conversation_context>');
    expect(request.userPrompt).not.toContain('Private travel plans');
  });
});
