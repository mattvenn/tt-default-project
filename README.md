# Tiny Tapeout Config Writer

A small web app that connects to a Tiny Tapeout demo board over Web Serial, lets you pick one of a few preset configurations, and writes it to the board as `/config.ini`.

It uses the same stack, look and connection code as [tt-commander-app](https://github.com/TinyTapeout/tt-commander-app), so it can later be merged in as a feature.

## Editing the configurations

The configs are in `src/configs/`. Each is a `.ini` file listed in `src/configs/index.ts`, with a name and description.

## Development

```sh
npm install
npm start       # dev server
npm run build   # production build in dist/
```

## How the write works

After connecting, the app enters the MicroPython raw REPL (the same handshake as commander). It then sends a short script that base64-decodes the chosen config into `/config.ini`, reads the file back, and compares the result byte for byte. Once the write is verified, **Reboot board** soft-resets the board so the new config takes effect.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`. In the repo settings, set Pages → Source to "GitHub Actions". The build uses a relative base path, so the repo name doesn't matter.
