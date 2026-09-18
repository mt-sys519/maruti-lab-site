// How the audio in public/hallo-terra/audio was made, so it can be made again.
//
// Every clip is Piper, run locally, using only voices whose licence plainly
// allows a site carrying advertising to publish the audio: CC0, public domain,
// CC BY, CC BY-SA, Apache, MIT. Anything non-commercial is refused, and so is
// anything whose model card says only "See URL" or "Unknown" - unread is not
// permission. That refusal costs us Japanese, Arabic and a few others.
//
// One synthesiser for all of it. Human recordings exist on Wikimedia Commons
// for about fourteen of these languages, and mixing them in would mean half
// the tool speaking with a person's voice and half with a machine's.
//
// It is not run by `npm run build`: it needs a 2GB pile of voice models and
// ffmpeg, and its output is committed. Steps:
//
//   1. piper            https://github.com/rhasspy/piper/releases (or `pip install piper-tts`)
//   2. voices.json      https://huggingface.co/rhasspy/piper-voices/resolve/main/voices.json
//   3. each voice's MODEL_CARD, to read the licence - this is the important part
//   4. synthesise audioText (never the katakana), one mp3 per phrase at 64kbps mono
//   5. write app/hallo-terra/audio.generated.json: which variety has which clips
//
// Single-speaker voices only, and medium quality or better. Nothing else
// ships: a crowd model or an x_low model may or may not be intelligible, and
// nobody here can hear the difference in a language they do not speak, so the
// rule has to be one that can be applied without listening.
//
// Single-speaker voices only. Several of the best-covered languages have a
// model trained on a crowd - French on 125 speakers, German on 236 - and asked
// for no speaker in particular it gives you nobody in particular: the French
// "Bonjour" it produced was plainly not French. Where a locale has a
// single-speaker voice under an acceptable licence, that is the one to use.
//
// The 2023 C++ build of piper cannot read some newer models ("aɪ is not a
// single codepoint"); the current Python build reads them. Where both refuse -
// Chinese, at the time of writing - the language simply has no audio.
process.stdout.write(
  "This file is the record of how the clips were made, not a one-command build.\n" +
    "Read the comment at the top before regenerating anything.\n",
);
