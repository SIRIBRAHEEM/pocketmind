// Copy this file to firebase-config.js and fill in your own Firebase web
// config. Get it from the Firebase console: Project settings > Your apps >
// Web app. These values identify your project; they are not secrets, but
// App Check is what protects your Gemini quota, so keep App Check enforced.
//
// Optional fields:
// - recaptchaSiteKey: your reCAPTCHA v3 site key for App Check in production.
//   Leave it empty for local development; PocketMind then uses the App Check
//   debug provider (you must register the debug token it prints in the
//   browser console, under Firebase console > Security > App Check > Apps).
// - cloudModel: override the cloud fallback model. Empty uses the SDK
//   default (gemini-3.5-flash-lite on current SDKs).

export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

export const recaptchaSiteKey = ''
export const cloudModel = ''
