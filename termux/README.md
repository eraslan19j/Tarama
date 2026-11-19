# Termux download and activation

Termux is free and open source: **there is no license key or paid activation code**. The codes below are local convenience shortcodes used by the included installer scripts to make sure the correct branch and startup command are used.

| Purpose | Code |
| --- | --- |
| Download code | `DK3D-2517-TARAMA` |
| Activation code | `DRAGON-5173-TERMUX` |

Current branch: `arena/2b2224d1-tarama`  
Published commit: `0704130`  
Studio port: `5173`

## One-command install

Paste this into Termux:

```bash
curl -fsSL https://github.com/eraslan19j/Tarama/raw/refs/heads/arena/2b2224d1-tarama/termux/bootstrap.sh \
  | bash -s -- DK3D-2517-TARAMA DRAGON-5173-TERMUX
```

It installs `git`, `curl` and Node.js, downloads this branch into `~/Tarama`, installs npm dependencies, and starts the studio. Open:

```text
http://127.0.0.1:5173
```

Press `Ctrl+C` in Termux to stop the server.

## Two-step install

If you prefer to inspect each step:

```bash
pkg update -y
pkg install -y git nodejs
git clone --branch arena/2b2224d1-tarama --single-branch \
  https://github.com/eraslan19j/Tarama.git ~/Tarama
cd ~/Tarama

bash termux/download.sh DK3D-2517-TARAMA
bash termux/activate.sh DRAGON-5173-TERMUX
```

`download.sh` also supports a `codeload.github.com` source-archive fallback if `git clone` is unavailable.

## Manual download without git

```bash
curl -fL -o ~/Tarama-source.tar.gz \
  https://codeload.github.com/eraslan19j/Tarama/tar.gz/refs/heads/arena/2b2224d1-tarama
tar -xzf ~/Tarama-source.tar.gz -C ~
cd ~ && cd "$(tar -tzf ~/Tarama-source.tar.gz | head -n 1 | cut -d/ -f1)"
bash termux/activate.sh DRAGON-5173-TERMUX
```

## Notes

- The app needs a WebGL-capable browser on the same device; the Vite server is bound to `0.0.0.0`.
- If you want to access files under `/sdcard`, run `termux-setup-storage` once.
- `npm ci` is used when `package-lock.json` is present; the script falls back to `npm install`.
- `termux-wake-lock` is invoked when available so the server is less likely to be suspended.
- To update later, re-run `bash termux/download.sh DK3D-2517-TARAMA`.
- To restart later without downloading, run `bash termux/activate.sh DRAGON-5173-TERMUX`.
