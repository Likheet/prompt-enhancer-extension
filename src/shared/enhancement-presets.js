/**
 * Enhancement Presets
 * Provides preset configurations for prompt enhancement
 */

import { ENHANCEMENT_PRESETS } from './constants.js';

class EnhancementPresets {
    constructor() {
        this.presets = [
            {
                key: ENHANCEMENT_PRESETS.CONCISE,
                name: 'Concise',
                emoji: '⚡',
                description: 'Brief, focused enhancements that preserve your original intent'
            },
            {
                key: ENHANCEMENT_PRESETS.BALANCED,
                name: 'Balanced',
                emoji: '⚖️',
                description: 'Moderate improvements with good detail additions'
            },
            {
                key: ENHANCEMENT_PRESETS.DETAILED,
                name: 'Detailed',
                emoji: '📝',
                description: 'Comprehensive enhancements with full context'
            },
            {
                key: ENHANCEMENT_PRESETS.TECHNICAL,
                name: 'Technical',
                emoji: '💻',
                description: 'Optimized for coding and technical questions'
            },
            {
                key: ENHANCEMENT_PRESETS.CREATIVE,
                name: 'Creative',
                emoji: '🎨',
                description: 'Enhanced for creative writing and artistic prompts'
            },
            {
                key: ENHANCEMENT_PRESETS.CUSTOM,
                name: 'Custom',
                emoji: '✏️',
                description: 'Use your own custom enhancement prompt'
            }
        ];
    }

    /**
     * Get all presets
     */
    getAllPresets() {
        return this.presets;
    }

    /**
     * Get a preset by key
     */
    getPreset(key) {
        return this.presets.find(p => p.key === key);
    }

    /**
     * Get default preset
     */
    getDefaultPreset() {
        return this.getPreset(ENHANCEMENT_PRESETS.BALANCED);
    }
}

export default EnhancementPresets;
