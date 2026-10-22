# MicPlotter

MicPlotter plans which actor wears which wireless microphone in every scene of a show, so a production needs as few mics and swaps as possible. It's for sound designers, sound crews and educators.

It's inspired by CH Sound Design's MicPlot for Windows, and it can open MicPlot 3.0 `.mpl` files.

## What it does

- Enter the cast, characters and scenes, then tick who is on stage in each scene.
- MicPlotter builds the mic plot. You can set the swap times and put the desktop-style rules in your own order: fewest transmitters, fewest swaps, fewest fast swaps, intermission swaps, and more.
- The wall chart shows which mic each actor wears, when it goes on and when it comes off.
- The sound crew running order lists what to fit and collect at every break.
- An understudy check confirms that covers can still get a mic.
- Paperwork prints cast slips, mic labels and rehearsal tags, and the mic plot itself prints on landscape pages.
- MicPlot 3.0 `.mpl` files open directly. Shows save in the browser, and you can save them to a file.

## Accessibility

MicPlotter is built to be usable by everyone:

- It works fully from the keyboard, with visible focus.
- Every control has a screen-reader label, and changes are announced.
- Text size goes up to 200%, with light, dark and higher-contrast themes.
- Information is never shown by colour alone.
- It respects your device's reduced-motion setting.

## Running it

MicPlotter is a single file, `index.html`, with no build step. Open it in a browser, or serve the folder with any static host.

The site is published with Netlify. `netlify.toml` tells Netlify to publish the repo as it is.

## Privacy

Shows are stored in your own browser, or in files you save. Nothing is sent to a server.
