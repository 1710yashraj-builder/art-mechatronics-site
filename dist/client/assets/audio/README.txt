ART Mechatronics — narration audio (premium voice upgrade)
==========================================================

The Live System walkthrough works right now using the browser's built-in
voice. To upgrade to a hyper-realistic recorded voice (e.g. ElevenLabs,
Indian-English male), drop MP3 files into THIS folder with these exact names.
No code changes are needed — the player automatically uses a clip if it
finds one, and only falls back to the browser voice if a clip is missing.

Required files (10):
  intro.mp3
  stage-suction.mp3
  stage-silos.mp3
  stage-weighing.mp3
  stage-buffer.mp3
  stage-mixer.mp3
  stage-sifter.mp3
  stage-trolley.mp3
  stage-dust.mp3
  outro.mp3

The exact words to record are in  site/js/data.js  →  ART.system.narration
(the `intro`, `outro`, and `lines` fields). Keep the wording in sync with
that file so the on-screen subtitles match the audio.

Tip: 128 kbps mono MP3 is plenty for voice and keeps the page fast.
