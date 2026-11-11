# Omo Beeza Admin and Omo Beeza Sub-admin (Android)

Two apps built from the same code (Gradle product flavors). Both save donors to
the same list as the website (Dashboard → Donors).

- **Omo Beeza Admin** (`admin`, app ID `org.omobeeza.donors`, so it updates the
  old "Omo Beeza Donors" app): signs in with a dashboard account. Donor list and
  stats, registering donors, "Send SMS reminders" from the ministry phone, payment
  and Telegram links, and **Sub-admins**: add people who register donors, set how
  many each should register, follow their progress, pause them, reset their
  password or remove them.
- **Omo Beeza Sub-admin** (`subadmin`, app ID `org.omobeeza.subadmin`): signs in
  with the phone number and password an admin gave them. It can only register new
  donors (an already registered phone number is refused) and see the donors they
  registered and their progress toward the target. No SMS permission, no other
  donors, no dashboard access.

## Install
Copy `release/OmoBeezaAdmin-v….apk` or `release/OmoBeezaSubAdmin-v….apk` to the
phone and open it (allow "install unknown apps" for your file manager or browser
when asked).

## Build
Requires JDK 17 and the Android SDK (Android Studio includes both).

```bash
cd android
./gradlew assembleAdminRelease assembleSubadminRelease   # → app/build/outputs/apk/{admin,subadmin}/release/
./gradlew recordPaparazziAdminDebug   # screenshots of every screen → app/src/test/snapshots/images
```

Or open the `android` folder in Android Studio and pick the build variant.

**Signing:** release builds are signed with `keystore/omobeeza-release.jks`,
configured in `keystore.properties`. Both are git-ignored. Back them up somewhere
safe: every future update of the app must be signed with the same key.

## Website connection
The app talks to the website's `/api/mobile/*` routes. The default address is
set in `app/build.gradle.kts` (`DEFAULT_SITE`) and can be changed on the sign-in
screen ("Website: …").
