# Omo Beeza Donors (Android)

An Android app for registering weekly donors in person. It signs in with an
Omo Beeza dashboard admin account and saves donors to the same list as the
website (Dashboard → Donors), so the weekly SMS reminders cover them too.

**Features:** donor list with search and filters, weekly stats, a register form
(amount, reminder day, SMS language, consent), a donor detail sheet with call
and message buttons, and a guided step for adding each number to AfroMessage
contacts (needed only while the AfroMessage account is in beta; can be turned
off in Settings).

## Install
Copy `release/OmoBeezaDonors-v1.0.apk` to the phone and open it (allow
"install unknown apps" for your file manager or browser when asked).

## Build
Requires JDK 17 and the Android SDK (Android Studio includes both).

```bash
cd android
./gradlew assembleRelease          # → app/build/outputs/apk/release/app-release.apk
./gradlew recordPaparazziDebug     # screenshots of every screen → app/src/test/snapshots/images
```

Or open the `android` folder in Android Studio.

**Signing:** release builds are signed with `keystore/omobeeza-release.jks`,
configured in `keystore.properties`. Both are git-ignored. Back them up somewhere
safe: every future update of the app must be signed with the same key.

## Website connection
The app talks to the website's `/api/mobile/*` routes. The default address is
set in `app/build.gradle.kts` (`DEFAULT_SITE`) and can be changed on the sign-in
screen ("Website: …").
