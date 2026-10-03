# Voice widget for demo A (same agent «Anna»)

Decision: demo C itself has no web page (talk-to link only, `docs/decisions.md`). This snippet is for the demo-A site, button «Поговорить с ассистентом голосом» (brief C §0 1b). Source of the embed format: `docs/platform_facts.md` L10.

## Embed
```html
<elevenlabs-convai agent-id="agent_4801m41cmf0ge7er75wzv5nj3pn1"></elevenlabs-convai>
<script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
```
Pin the package version in the `src` URL when demo A ships (check the current version on unpkg at build time).

## Preconditions (agent side, not the page)
- The widget only works while the agent is **public (auth off)**, the same switch as the talk-to link: `npm run link:unlock` / `npm run link:lock`. While demo A is live the link is live too, so the minute guards matter: max call 300 s, daily limit 25, concurrency 2 (set in WP8, `docs/agent_report.md`).
- Restrict the widget to the demo-A host with the agent's domain allowlist before going public (verify the setting name with `npm run el:check` output at build time).
- Demo agent, demo data: no real customer data, Calendar/Sheet/Telegram are the demo ones.

## Consent before the call (`terms_text`)
Set the widget's terms (`terms_text`, Markdown) in the agent's widget settings. The visitor must accept before the microphone opens. The public sees it, so Latvian is complete; the RU and LV texts below are drafts for the H3 LV review. The privacy-policy link is still missing: SCG's policy URL has to be confirmed with SCG before a public launch.

RU:
> Вы будете говорить с ИИ-ассистентом Smart Comfort Group. Разговор записывается и хранится 90 дней, чтобы обработать ваш запрос и улучшать качество обслуживания. Пожалуйста, называйте только нужные для запроса данные. Нажимая «Принять», вы соглашаетесь с этим.

LV:
> Jūs runāsiet ar Smart Comfort Group mākslīgā intelekta asistenti. Saruna tiek ierakstīta un glabāta 90 dienas, lai apstrādātu jūsu pieprasījumu un uzlabotu apkalpošanas kvalitāti. Lūdzu, nosauciet tikai pieprasījumam nepieciešamos datus. Spiežot «Piekrītu», jūs tam piekrītat.

Anna still opens every call with the AI disclosure and the recording notice in sentence 1; the terms modal is in addition to it, not instead of it.
