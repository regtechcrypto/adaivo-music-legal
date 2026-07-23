# Adaivo Music Third-Party Notices

**Release:** 2026-07-23.1
**Effective date:** 2026-07-23

## Scope

These are the notices included for the current release built from Adaivo Music commit `c810e47c83771fafea1366a6a58d4762c553b751`. They cover direct runtime JavaScript dependencies recorded in `mobile/package-lock.json`, plus identifiable shipped iOS Pods and Android runtime families from the committed lock/build files. The repository does not contain a complete resolved Android release license report, so this document does not claim to be a complete native transitive inventory. Release engineering must regenerate and review native notices from the final store binaries before launch.

Adaivo-authored music, legal text, code, and brand material are not open source and are not licensed by this notice.

## Runtime JavaScript packages

- Apache-2.0: `@invertase/react-native-apple-authentication`, `react-native-track-player`.
- MIT: `@react-native-camera-roll/camera-roll`, `@react-native-clipboard/clipboard`, `@react-native-community/push-notification-ios`, `@react-native-google-signin/google-signin`, `@react-native/new-app-screen`, `@react-navigation/bottom-tabs`, `@react-navigation/native`, `@react-navigation/native-stack`, `buffer`, `react`, `react-native`, `react-native-app-auth`, `react-native-blob-util`, `react-native-get-random-values`, `react-native-iap`, `react-native-keychain`, `react-native-nitro-modules`, `react-native-qrcode-svg`, `react-native-quick-base64`, `react-native-quick-crypto`, `react-native-safe-area-context`, `react-native-screens`, `react-native-share`, `react-native-svg`, `react-native-view-shot`, `uuid`.

Package license identifiers above are taken from the exact lockfile package metadata. Patched packages retain their upstream licenses; the release applies local patches to `react-native-blob-util` and `react-native-track-player`.

## Native components identified in the release inputs

- Apache-2.0 families: React Native Android/iOS components, Hermes, AppAuth, Google Sign-In support libraries, GoogleUtilities, GTMAppAuth, GTMSessionFetcher, PromisesObjC, PromisesSwift, NitroModules, NitroIap, and OpenIAP.
- OpenSSL License / Apache-2.0: OpenSSL 3.x via `OpenSSL-Universal`.
- MIT families: Yoga and React-related components where their upstream distributions designate MIT.

Android test-only dependencies are excluded from the distributed runtime by the committed Gradle configuration.

## Required license texts

Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0

MIT License: https://opensource.org/license/mit

OpenSSL license information: https://www.openssl.org/source/license.html

Copyright and attribution remain with the respective upstream authors and contributors. Those upstream notices and license texts control; this summary does not replace them.
