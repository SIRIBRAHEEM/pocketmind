# PocketMind demo video notes

- Final file: pocketmind-demo.mp4 (1920x1080, 30 fps, H.264 + AAC)
- Duration: 90.8 seconds (1:31), under the 3 minute limit
- Thumbnail: thumbnail.png (1280x720, text only, no photo)
- Voice: synthesized narration, voice ID avocado_v2:MAI_03, reading the adapted DEMO-SCRIPT lines word for word
- Loudness: integrated -14.8 LUFS, true peak -1.3 dBTP (measured with ebur128 on the final file)
- Captions: burned in, short lines synced to the narration, checked on extracted frames
- Google Drive file ID: 1-lJ5rRQoWzezLZ06TMeB4CZ5VazLrVwP

## Honest demo-mode note

This recording was made before Ibrahim's Firebase project was connected, so the app runs in clearly labelled demo mode. The narration says so plainly in the Ask scene, and every answer badge on screen reads DEMO MODE. No live AI answer is claimed. When the Firebase config is connected, re-record so the On-device and Cloud badges are real.

## Scenes

1. 0:00 Title card, narration starts over it with the exact intro line
2. 0:02 App home, Hybrid status panel (label: Hybrid status)
3. 0:21 Notes library (label: Notes library)
4. 0:31 Ask: "What traps light?" answered from the note, DEMO MODE badge (label: Ask your note)
5. 0:50 Summary and flashcards (label: Summary and flashcards)
6. 1:00 Routing mode picker (label: Routing modes)
7. 1:20 Closing: app shot, then closing card with the live URL

## Edit notes

- Screen recorded from the production build at 1920x1080 with a visible cursor and a cyan click ripple on every click
- Clean cuts between scenes, section labels fade in and out at the top left
- No photo of the presenter anywhere: no face circle, no photo thumbnail
- University always in full: Federal University of Technology Minna. The word "foot" appears nowhere in captions or narration
- Pipeline: video/work/ (record.mjs, assemble.py, cards, captions.ass)
