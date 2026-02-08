<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1gkPiWwxR3PAg46IcI-MurmBw47hus1nz

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Android App

This project uses [Capacitor](https://capacitorjs.com/) to provide an Android application.

### Build the Android App

To build the Android APK, run:

```bash
npm run android:build
```

The generated APK will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

### Sync Changes

If you make changes to the web code, you can sync them to the Android project without a full build:

```bash
npm run build
npm run android:sync
```

### Open in Android Studio

To open the project in Android Studio for further development or to create a release build:

```bash
npm run android:open
```
