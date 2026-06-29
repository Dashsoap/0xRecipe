# 0xRecipe — explainer video

A ~65s 1080p product explainer built with [Remotion](https://www.remotion.dev/)
(programmatic React → MP4). Eight motion-graphics scenes in the product's violet
dark-glass style: title, the payment problem, prepaid escrow, per-call voucher,
atomic 20/80 split, the Fusion model panel, the budget wall, and the outro.

## Commands

```console
npm i                                           # install
npx remotion studio                             # preview in the browser
npx remotion render Explainer out/0xRecipe-explainer.mp4   # render the MP4
```

## Audio assets (not committed)

Audio files under `public/` are gitignored — third-party music is not
redistributed in this repo, and voiceover is generated locally. Recreate the
background track before rendering with audio:

```console
mkdir -p public
curl -L -o /tmp/inspired.mp3 \
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Inspired.mp3"
ffmpeg -y -i /tmp/inspired.mp3 -t 66 \
  -af "afade=t=in:st=0:d=2.5,afade=t=out:st=61:d=4.5,loudnorm=I=-20:TP=-2.5" \
  -ar 44100 -b:a 192k public/bgm.mp3
```

**Music credit (required by the license):** "Inspired" — Kevin MacLeod
(incompetech.com), licensed under Creative Commons: By Attribution 4.0. Include
this credit wherever the video is published. To use a different track, drop your
own `public/bgm.mp3` (or change `staticFile("bgm.mp3")` in `src/Main.tsx`).

A voiceover, if added, goes to `public/voiceover.mp3` as a second `<Audio>`
track; lower the BGM `volume` in `src/Main.tsx` when a voiceover sits on top.

## Structure

- `src/Root.tsx` — composition registration (1920×1080, 30fps).
- `src/Main.tsx` — persistent background + BGM + the scene `TransitionSeries`.
- `src/scenes/S1…S8` — the eight scenes.
- `src/components/` — `Background`, `ui` (reveals / mask / draw-line primitives), `icons`.
- `src/theme.ts` — colors, type scale, spacing.
