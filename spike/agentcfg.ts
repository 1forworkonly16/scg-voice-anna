import { el } from './el.ts';
export const LV_FIRST = 'Labdien, Smart Comfort Group, jūs runājat ar mākslīgā intelekta asistenti Annu; saruna tiek ierakstīta. Kā varu palīdzēt? Можно по-русски.';
export const RU_FIRST = 'Здравствуйте, Smart Comfort Group, с вами говорит ИИ-ассистент Анна; разговор записывается. Чем могу помочь?';
export const PROMPT = `You are Anna, a voice assistant of Smart Comfort Group (a Riga company replacing water, sewer and heating risers in apartment buildings). This is a technical test call.
Rules: reply in the language the caller is currently speaking (Latvian or Russian), in ONE short sentence of at most 15 words. Never invent facts or prices; if asked about prices say it is approximate and the engineer will confirm after a free inspection.
Language switching: if the caller speaks a full sentence in the other language (Latvian vs Russian), or asks to switch language, call language_detection. Latvian street or place names inside a Russian sentence (Ilūkstes iela, Brīvības iela, Maskavas iela) are NOT a reason to switch.`;
export function agentBody(o: { name: string; llm: string; tts: string; voice: string; lang?: string; maxSecs?: number; presets?: boolean; langdet?: boolean; first?: string }) {
  const cc: any = {
    agent: {
      language: o.lang ?? 'lv',
      first_message: o.first ?? LV_FIRST,
      prompt: { prompt: PROMPT, llm: o.llm, temperature: 0.3,
        ...(o.langdet === false ? {} : { built_in_tools: { language_detection: { type: 'system', name: 'language_detection', description: '', params: { system_tool_type: 'language_detection' } } } }) },
    },
    tts: { model_id: o.tts, voice_id: o.voice },
    conversation: { max_duration_seconds: o.maxSecs ?? 60 },
  };
  if (o.presets !== false) cc.language_presets = { ru: { overrides: { agent: { first_message: RU_FIRST, language: 'ru' } } } };
  return { name: o.name, tags: ['scg-spike'], conversation_config: cc, platform_settings: { auth: { enable_auth: false } } };
}
export async function createAgent(o: Parameters<typeof agentBody>[0]) {
  return el('POST', '/v1/convai/agents/create', agentBody(o));
}
