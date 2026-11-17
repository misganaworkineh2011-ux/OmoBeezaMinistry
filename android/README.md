# Omo Beeza (Android)

One app for admins and sub-admins (since v1.7.0). It saves donors to the same
list as the website (Dashboard → Donors). App ID `org.omobeeza.donors`, so it
updates the earlier "Omo Beeza Admin" (and "Omo Beeza Donors") app in place,
keeping its sign-in.

The sign-in screen has one field, **Email or phone number**:

- **An email** (a dashboard account) opens the **admin** side: donor list and
  stats, registering donors, "Send SMS reminders" from the ministry phone,
  payment and Telegram links, and **Sub-admins**: add people who register
  donors, set how many each should register, follow their progress, extend their
  target, pause them, reset their password or remove them.
- **A phone number** (a sub-admin's, with the password an admin gave them) opens
  only the **sub-admin** side: register new donors (an already registered phone
  number is refused), see the donors they registered and their progress toward
  the target, and add more to the target themselves once it is reached (+5, +10
  or any number). No SMS, no other donors, no admin screens.

The app remembers who signed in and opens the same side next time; signing out
returns to the sign-in screen. The SMS permission is listed for everyone (the
admin side sends reminders), but Android only asks for it when an admin uses
"Send SMS reminders"; a sub-admin is never asked.

Donors give **monthly** (the default, reminded on a day of the month, 1–28) or
**weekly** (reminded on a weekday). The register form has a Monthly / Weekly
switch; the default comes from the website's giving settings.

## Install
Download the app from the dashboard (Dashboard → Android app) on the phone, or
copy `release/OmoBeeza-v….apk` to the phone, and open it (allow "install
unknown apps" for your browser or file manager when asked).

**Sub-admins who had the old "Omo Beeza Sub-admin" app:** install this app,
sign in with the same phone number and password, then uninstall "Omo Beeza
Sub-admin". Their donors and targets are kept on the website.

## Build
Requires JDK 17 and the Android SDK (Android Studio includes both).

```bash
cd android
./gradlew assembleRelease            # → app/build/outputs/apk/release/app-release.apk
./gradlew recordPaparazziDebug       # screenshots of every screen → app/src/test/snapshots/images
./gradlew testDebugUnitTest          # unit tests (formatting, sign-in detection)
```

**Signing:** release builds are signed with `keystore/omobeeza-release.jks`,
configured in `keystore.properties`. Both are git-ignored. Back them up somewhere
safe: every future update of the app must be signed with the same key.

## Website connection
The app talks to the website's `/api/mobile/*` (admins) and `/api/registrar/*`
(sub-admins) routes. The default address is set in `app/build.gradle.kts`
(`DEFAULT_SITE`) and can be changed on the sign-in screen ("Website: …").
