package org.omobeeza.donors

import android.graphics.Color as AndroidColor
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import org.omobeeza.donors.ui.AppViewModel
import org.omobeeza.donors.ui.Screen
import org.omobeeza.donors.ui.screens.HomeScreen
import org.omobeeza.donors.ui.screens.RegisterScreen
import org.omobeeza.donors.ui.screens.SavedScreen
import org.omobeeza.donors.ui.screens.SettingsScreen
import org.omobeeza.donors.ui.screens.SignInScreen
import org.omobeeza.donors.ui.screens.SmsSheet
import org.omobeeza.donors.ui.theme.OmoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(AndroidColor.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(0xFFF7F3EC.toInt(), 0xFFF7F3EC.toInt()),
        )
        super.onCreate(savedInstanceState)
        setContent { OmoTheme { App() } }
    }
}

private fun depth(s: Screen): Int = when (s) {
    Screen.SignIn, Screen.Home -> 0
    Screen.Register, Screen.Settings -> 1
    is Screen.Saved -> 2
}

@Composable
fun App(vm: AppViewModel = viewModel()) {
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(vm.message) {
        vm.message?.let {
            snackbar.showSnackbar(it)
            vm.message = null
        }
    }
    BackHandler(enabled = vm.screen != Screen.Home && vm.screen != Screen.SignIn) { vm.back() }

    AnimatedContent(
        targetState = vm.screen,
        transitionSpec = {
            val forward = depth(targetState) >= depth(initialState)
            (slideInHorizontally { if (forward) it / 3 else -it / 3 } + fadeIn()) togetherWith
                (slideOutHorizontally { if (forward) -it / 4 else it / 4 } + fadeOut())
        },
        contentKey = { it::class },
        label = "screens",
    ) { screen ->
        when (screen) {
            Screen.SignIn -> SignInScreen(vm.prefs.site, vm.busy, vm.formError) { site, email, password -> vm.signIn(site, email, password) }

            Screen.Home -> HomeScreen(
                user = vm.user,
                stats = vm.stats,
                donors = vm.donors,
                loading = vm.loading,
                loaded = vm.loaded,
                query = vm.query,
                view = vm.view,
                snackbar = snackbar,
                onQuery = vm::search,
                onView = vm::selectView,
                onRefresh = vm::refresh,
                onRegister = { vm.go(Screen.Register) },
                onSettings = { vm.go(Screen.Settings) },
                onSms = vm::openSms,
            )

            Screen.Register -> RegisterScreen(vm.settings, vm.busy, vm.formError, onBack = { vm.back() }, onSave = vm::register)

            is Screen.Saved -> SavedScreen(
                donor = screen.donor,
                created = screen.created,
                welcomeSms = vm.welcomeSms,
                onAnother = { vm.go(Screen.Register) },
                onDone = { vm.go(Screen.Home) },
            )

            Screen.Settings -> SettingsScreen(
                user = vm.user,
                site = vm.prefs.site,
                onBack = { vm.back() },
                onSignOut = vm::signOut,
            )
        }
    }

    vm.sms?.let { run ->
        SmsSheet(
            run = run,
            savedSim = vm.prefs.smsSim,
            onSend = vm::startSms,
            onStop = vm::stopSms,
            onClose = vm::closeSms,
        )
    }
}
