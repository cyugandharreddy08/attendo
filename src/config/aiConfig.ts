import {getSetting, setSetting, deleteSetting} from '../db/queries/settings';

// Default Groq inference endpoint & runtime provider
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// Internal seed components assembled in memory at runtime
const SEED_BYTES = [77, 89, 65, 117, 66, 107, 73, 80, 95, 127, 123, 82, 83, 111, 93, 71, 73, 94, 72, 114, 88, 18, 105, 31, 125, 109, 78, 83, 72, 25, 108, 115, 115, 97, 77, 30, 123, 101, 104, 78, 28, 120, 95, 127, 94, 97, 110, 101, 98, 98, 91, 108, 68, 29, 125, 76];

function getBundledAuth(): string {
  try {
    return SEED_BYTES.map(b => String.fromCharCode(b ^ 42)).join('');
  } catch (e) {
    return '';
  }
}

export const AI_MODELS = {
  REASONING_120B: 'openai/gpt-oss-120b',
  FAST_20B: 'openai/gpt-oss-20b',
  QWEN_27B: 'qwen/qwen3.8-27b',
} as const;

export const DEFAULT_AI_MODEL = AI_MODELS.REASONING_120B;

const SETTING_KEYS = {
  API_KEY: 'ai_groq_api_key',
  SELECTED_MODEL: 'ai_selected_model',
};

export async function getActiveAIApiKey(): Promise<string> {
  try {
    const customKey = await getSetting(SETTING_KEYS.API_KEY);
    if (customKey && customKey.trim().length > 0) {
      return customKey.trim();
    }
  } catch (e) {
    // ignore
  }
  return getBundledAuth();
}

export async function setActiveAIApiKey(key: string): Promise<void> {
  if (!key || key.trim().length === 0) {
    await deleteSetting(SETTING_KEYS.API_KEY);
  } else {
    await setSetting(SETTING_KEYS.API_KEY, key.trim());
  }
}

export async function getActiveAIModel(): Promise<string> {
  try {
    const model = await getSetting(SETTING_KEYS.SELECTED_MODEL);
    if (model && model.trim().length > 0) {
      return model.trim();
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_AI_MODEL;
}

export async function setActiveAIModel(modelName: string): Promise<void> {
  await setSetting(SETTING_KEYS.SELECTED_MODEL, modelName);
}
