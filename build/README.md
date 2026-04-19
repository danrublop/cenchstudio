# Packaging assets

Drop these files here before running `npm run dist`:

| File                     | Format         | Dimensions                      | Target                              |
| ------------------------ | -------------- | ------------------------------- | ----------------------------------- |
| `icon.icns`              | Apple icon set | 1024×1024 base                  | macOS .dmg                          |
| `icon.ico`               | Windows icon   | 256×256 base (multi-res inside) | Windows .exe                        |
| `icon.png`               | PNG (fallback) | 1024×1024                       | Linux AppImage                      |
| `background.png`         | PNG            | 540×380                         | macOS DMG install window background |
| `entitlements.mac.plist` | plist          | —                               | macOS hardened-runtime entitlements |

## Generating icons from a single PNG

You only need to supply `icon.png` (1024×1024). Run:

```bash
npx electron-icon-builder --input=build/icon.png --output=build --flatten
```

This writes `icon.icns` and `icon.ico` next to it.

## Notarization (macOS)

Set these env vars before `npm run dist` to produce a Gatekeeper-safe DMG:

- `CSC_LINK` — URL to your Developer ID Application .p12
- `CSC_KEY_PASSWORD` — .p12 password
- `APPLE_ID` — your Apple ID
- `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password from appleid.apple.com
- `APPLE_TEAM_ID` — 10-char team identifier

electron-builder calls `@electron/notarize` automatically if these are present
and the mac target has `hardenedRuntime: true` (see `package.json > build.mac`).

## Windows signing

- `WIN_CSC_LINK` — URL or path to your EV code signing .pfx
- `WIN_CSC_KEY_PASSWORD` — .pfx password
