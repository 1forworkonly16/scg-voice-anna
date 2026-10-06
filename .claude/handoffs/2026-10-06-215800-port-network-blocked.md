# Handoff addendum: port from a parallel session; network still blocked (2026-10-06 21:58 Riga)

> **READ FIRST: [2026-10-06-190800-video-phase-a.md](./2026-10-06-190800-video-phase-a.md).** Its Phase B (WPV6-WPV10) and its rules are unchanged. This addendum records only what changed since and what is still open.

## Session Metadata
- Created: 2026-10-06 21:58 (Riga) · Project: /home/user/scg-voice-anna (cloud Linux session; branch `claude/stoic-rubin-fpy6pz`) · Addendum to the Phase A handoff, not a final WP10.

## What happened
- A parallel cloud session started from `main` (`178b601`) instead of this branch and redid part of Phase A (consent removal, docs).
- Its duplicate commits were dropped. They live only on the local branch `claude/focused-heisenberg-v8ep7r` and were never pushed (origin has no such branch; the local tracking ref is stale at `178b601`).
- Three non-duplicate fixes were ported in the commit «Port from a parallel session: …»:
  1. The `skip_turn` description (M1 and M2) now names the greeting: the first «...» after any other reply, including the greeting, gets «Алло, вы меня слышите?». t02c failed twice while the greeting was not named.
  2. `scripts/integration.ts` sends both `book_inspection` probes (first booking and replay) without `consent`, so the live probe proves the no-consent contract.
  3. The M2 English phone question states its purpose («…about this request…»), for the criterion `contact_data_for_request_only`.

## User steps (numbering as in «Immediate Next Steps» of the earlier handoff; Claude cannot do these)
- Step 1 (keys): done. All 8 env vars are present in the environment (names only were checked, 2026-10-06); a new session in the same environment inherits them.
- Step 2 (network): **still open.** At the probe on 2026-10-06 around 21:50 Riga, all 4 hosts returned proxy 403 (CONNECT): `api.elevenlabs.io`, `api.cloudflare.com`, `scg-voice-demo.scg-voice-demo.workers.dev`, `api.telegram.org`.
- Step 3 (GitHub): done.
- Step 4: after saving the Network setting, start a new session in the same environment on `claude/stoic-rubin-fpy6pz` and say «Resume from the latest handoff».

## Still to log in WPV6
- The 2nd re-test call `conv_2301m48bf0dwfrwbcnhz4zbtfvcp`.

## M2 advisories (not fixed; M2 is staged)
- `elevenlabs/test_specs_m2/t35_s5_callback_after_referral_lv.json` L10 still opens with the old LV greeting «… saruna tiek ierakstīta», and L26 reads the phone back digit by digit.
- `demo/widget_snippet.md` L21 and L26 still say the call is recorded. Recording has been off since 2026-10-05.

## Budget for the next session
- The user has about $5 of cloud usage for tests and feedback.
- Sonnet builders, one Opus verifier per WP, short briefs naming exact lines, test output through `tail`.
- Never resume agents with long transcripts.
- Ask before any batch over ~3k ElevenLabs credits.
