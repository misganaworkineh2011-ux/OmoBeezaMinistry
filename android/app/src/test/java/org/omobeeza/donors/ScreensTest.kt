package org.omobeeza.donors

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.SnackbarHostState
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.android.ide.common.rendering.api.SessionParams
import org.junit.Rule
import org.junit.Test
import org.omobeeza.donors.data.Donor
import org.omobeeza.donors.data.GivingSettings
import org.omobeeza.donors.data.Stats
import org.omobeeza.donors.data.User
import org.omobeeza.donors.ui.View
import org.omobeeza.donors.ui.screens.DonorDetails
import org.omobeeza.donors.ui.screens.HomeScreen
import org.omobeeza.donors.ui.screens.RegisterScreen
import org.omobeeza.donors.ui.screens.SavedScreen
import org.omobeeza.donors.ui.screens.SettingsScreen
import org.omobeeza.donors.ui.screens.SignInScreen
import org.omobeeza.donors.ui.theme.Brand
import org.omobeeza.donors.ui.theme.OmoTheme

/** Renders each screen with sample data: ./gradlew recordPaparazziDebug */
class ScreensTest {
    @get:Rule
    val paparazzi = Paparazzi(
        deviceConfig = DeviceConfig.PIXEL_5,
        theme = "android:Theme.Material.Light.NoActionBar",
        renderingMode = SessionParams.RenderingMode.NORMAL,
        maxPercentDifference = 0.1,
    )

    private val user = User(1, "Misgana Worku", "admin@omobeeza.org")
    private fun donor(id: Int, name: String, phone: String, amount: Int, day: Int, linked: Boolean, locale: String = "en") = Donor(
        id, name, if (linked) "" else "Almi", phone, "", amount, day, locale, "active", "app", "Met at the carnival day", "2026-11-02T09:30:00.000Z",
        if (linked) "2026-11-02T10:00:00.000Z" else null, if (linked) "2026-11-01" else null, if (linked) 300 else 0,
        telegramUsername = if (linked) "abebe_k" else "", telegramLinked = linked,
        telegramLink = "https://t.me/OmoBeezaBot?start=AbC123xYz9AB",
    )
    private val donors = listOf(
        donor(1, "Almaz Bekele", "+251922111333", 250, 3, false, "am"),
        donor(2, "Abebe Kebede", "+251911234567", 100, 0, true),
        donor(3, "Sara Tesfaye", "+251712345678", 500, 5, true),
        donor(4, "ዮናስ ታደሰ", "+251933444555", 50, 1, false, "am"),
        donor(5, "Hanna Girma", "+251944777888", 200, 0, true),
    )

    @Test fun signIn() = paparazzi.snapshot { OmoTheme { SignInScreen("https://omobeezaministry.com", false, null) { _, _, _ -> } } }

    @Test fun home() = paparazzi.snapshot {
        OmoTheme {
            HomeScreen(
                user, Stats(active = 42, weekly = 9850, paid7 = 31, smsWaiting = 7, today = 3), donors,
                loading = false, loaded = true, query = "", view = View.All, snackbar = SnackbarHostState(),
                onQuery = {}, onView = {}, onRefresh = {}, onRegister = {}, onSettings = {},
            )
        }
    }

    @Test fun register() = paparazzi.snapshot { OmoTheme { RegisterScreen(GivingSettings(), false, null, {}, {}) } }

    @Test fun saved() = paparazzi.snapshot { OmoTheme { SavedScreen(donors[0], true, "Welcome SMS sent from this phone.", {}, {}, animate = false) } }

    @Test fun donorDetails() = paparazzi.snapshot {
        OmoTheme { Box(Modifier.background(Brand.Sand)) { DonorDetails(donors[0]) } }
    }

    @Test fun savedTelegramConnected() = paparazzi.snapshot { OmoTheme { SavedScreen(donors[1], true, null, {}, {}, animate = false) } }

    @Test fun settings() = paparazzi.snapshot {
        OmoTheme { SettingsScreen(user, "https://omobeezaministry.com", {}, {}) }
    }
}
