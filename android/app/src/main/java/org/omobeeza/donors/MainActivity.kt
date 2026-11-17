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
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import org.omobeeza.donors.data.payLink
import org.omobeeza.donors.ui.AppViewModel
import org.omobeeza.donors.ui.Role
import org.omobeeza.donors.ui.Screen
import org.omobeeza.donors.ui.SessionViewModel
import org.omobeeza.donors.ui.screens.HomeScreen
import org.omobeeza.donors.ui.screens.RegisterScreen
import org.omobeeza.donors.ui.screens.SavedScreen
import org.omobeeza.donors.ui.screens.SettingsScreen
import org.omobeeza.donors.ui.screens.SignInScreen
import org.omobeeza.donors.ui.screens.SmsSheet
import org.omobeeza.donors.ui.screens.SubAdminsScreen
import org.omobeeza.donors.ui.subadmin.SubAdminApp
import org.omobeeza.donors.ui.subadmin.SubAdminViewModel
import org.omobeeza.donors.ui.theme.Brand
import org.omobeeza.donors.ui.theme.OmoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(AndroidColor.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(0xFFF7F3EC.toInt(), 0xFFF7F3EC.toInt()),
        )
        super.onCreate(savedInstanceState)
        setContent { OmoTheme { Root() } }
    }
}

/**
 * One app for everyone: the shared sign-in screen, then the admin side (signed
 * in with a dashboard email) or the sub-admin side (signed in with a phone
 * number). Each sign-in gets fresh screens, so nothing from one person's
 * session carries over to the next.
 */
@Composable
fun Root(session: SessionViewModel = viewModel()) {
    when (session.role) {
        null -> SignInScreen(session.prefs.site, session.busy, session.formError) { site, id, password -> session.signIn(site, id, password) }
        Role.Admin -> key(session.generation) {
            App(viewModel(key = "admin-${session.generation}"), onSignedOut = session::signedOut)
        }
        Role.SubAdmin -> key(session.generation) {
            SubAdminApp(viewModel<SubAdminViewModel>(key = "subadmin-${session.generation}"), onSignedOut = session::signedOut)
        }
    }
}

private fun depth(s: Screen): Int = when (s) {
    Screen.SignIn, Screen.Home -> 0
    Screen.Register, Screen.Settings, Screen.SubAdmins -> 1
    is Screen.Saved -> 2
}

@Composable
fun App(vm: AppViewModel = viewModel(), onSignedOut: (notice: String?) -> Unit = {}) {
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current

    // Signed out (or the website asked to sign in again): back to the shared sign-in screen.
    LaunchedEffect(vm.screen) { if (vm.screen == Screen.SignIn) onSignedOut(vm.formError) }

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
            Screen.SignIn -> Box(Modifier.fillMaxSize().background(Brand.NightSky))

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
                onSubAdmins = vm::openSubAdmins,
                payLink = { vm.settings.payLink(it.amount) },
            )

            Screen.Register -> RegisterScreen(vm.settings, vm.busy, vm.formError, onBack = { vm.back() }, onSave = vm::register)

            is Screen.Saved -> SavedScreen(
                donor = screen.donor,
                created = screen.created,
                welcomeSms = vm.welcomeSms,
                payLink = vm.settings.payLink(screen.donor.amount),
                onAnother = { vm.go(Screen.Register) },
                onDone = { vm.go(Screen.Home) },
            )

            Screen.SubAdmins -> SubAdminsScreen(
                subs = vm.subAdmins,
                loading = vm.subAdminsLoading,
                busy = vm.busy,
                error = vm.formError,
                snackbar = snackbar,
                onBack = { vm.back() },
                onRefresh = vm::loadSubAdmins,
                onSave = vm::saveSubAdmin,
                onRemove = vm::removeSubAdmin,
                loadDonors = vm::subAdminDonors,
                onClearError = { vm.formError = null },
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
