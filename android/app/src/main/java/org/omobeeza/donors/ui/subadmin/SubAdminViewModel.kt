package org.omobeeza.donors.ui.subadmin

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import org.omobeeza.donors.data.Api
import org.omobeeza.donors.data.ApiException
import org.omobeeza.donors.data.Donor
import org.omobeeza.donors.data.GivingSettings
import org.omobeeza.donors.data.NewDonor
import org.omobeeza.donors.data.Prefs
import org.omobeeza.donors.data.Progress
import org.omobeeza.donors.data.errorText

sealed interface SubScreen {
    data object SignIn : SubScreen
    data object Home : SubScreen
    data object Register : SubScreen
    data class Saved(val donor: Donor) : SubScreen
    data object Settings : SubScreen
}

/**
 * The sub-admin side of the app (signed in with a phone number): register
 * donors and see how many of the target are done. Nothing else (no SMS, no
 * other donors, no admin screens).
 */
class SubAdminViewModel(app: Application) : AndroidViewModel(app) {
    val prefs = Prefs(app)

    var screen by mutableStateOf<SubScreen>(if (prefs.token != null) SubScreen.Home else SubScreen.SignIn)
        private set
    /** Who is signed in, their target and progress (name/phone kept for offline start). */
    var me by mutableStateOf(Progress(name = prefs.userName, phone = prefs.userEmail))
        private set
    var settings by mutableStateOf(GivingSettings())
        private set
    var donors by mutableStateOf<List<Donor>>(emptyList())
        private set
    var loading by mutableStateOf(false)
        private set
    var loaded by mutableStateOf(false)
        private set
    var busy by mutableStateOf(false)
        private set
    var message by mutableStateOf<String?>(null)
    var formError by mutableStateOf<String?>(null)

    private fun api() = Api(prefs.site, prefs.token)

    init {
        if (prefs.token != null) refresh()
    }

    fun go(to: SubScreen) {
        formError = null
        screen = to
    }

    fun back(): Boolean {
        if (screen == SubScreen.Home || screen == SubScreen.SignIn) return false
        go(SubScreen.Home)
        return true
    }

    fun signOut() {
        val old = api()
        viewModelScope.launch { old.subLogout() }
        prefs.signOut()
        me = Progress()
        donors = emptyList()
        loaded = false
        go(SubScreen.SignIn)
    }

    fun refresh() {
        loading = true
        viewModelScope.launch {
            try {
                val home = api().subHome()
                me = home.me
                settings = home.settings
                donors = home.donors
                prefs.userName = home.me.name
                loaded = true
            } catch (e: ApiException) {
                handle(e)
            } finally {
                loading = false
            }
        }
    }

    fun register(d: NewDonor) {
        busy = true
        formError = null
        viewModelScope.launch {
            try {
                val donor = api().subRegister(d)
                go(SubScreen.Saved(donor))
                refresh()
            } catch (e: ApiException) {
                if (e.code == "unauthorized") handle(e) else formError = errorText(e.code, e.min ?: settings.minAmount, subAdmin = true)
            } finally {
                busy = false
            }
        }
    }

    /** After reaching their target: register [add] more (raises their own target). */
    fun extendTarget(add: Int) {
        busy = true
        viewModelScope.launch {
            try {
                val (target, registered) = api().subExtendTarget(add)
                me = me.copy(target = target, registered = registered)
                message = "Your new target is $target donors. Thank you!"
            } catch (e: ApiException) {
                handle(e)
            } finally {
                busy = false
            }
        }
    }

    private fun handle(e: ApiException) {
        if (e.code == "unauthorized") {
            // Signed out, paused or removed by an admin.
            screen = SubScreen.SignIn
            formError = "Please sign in again. If it keeps failing, ask the ministry admin whether your account is still active."
        } else {
            message = errorText(e.code, subAdmin = true)
        }
    }
}
