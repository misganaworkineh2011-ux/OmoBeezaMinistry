package org.omobeeza.donors.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.omobeeza.donors.data.Api
import org.omobeeza.donors.data.ApiException
import org.omobeeza.donors.data.Donor
import org.omobeeza.donors.data.GivingSettings
import org.omobeeza.donors.data.NewDonor
import org.omobeeza.donors.data.Prefs
import org.omobeeza.donors.data.Stats
import org.omobeeza.donors.data.User
import org.omobeeza.donors.data.errorText

sealed interface Screen {
    data object SignIn : Screen
    data object Home : Screen
    data object Register : Screen
    data class Saved(val donor: Donor, val created: Boolean) : Screen
    data class Afro(val donor: Donor, val returnTo: Screen) : Screen
    data object Settings : Screen
}

enum class View(val key: String, val label: String) {
    All("all", "All"),
    Active("active", "Active"),
    Afro("afro", "AfroMessage step"),
}

class AppViewModel(app: Application) : AndroidViewModel(app) {
    val prefs = Prefs(app)

    var screen by mutableStateOf<Screen>(if (prefs.token != null) Screen.Home else Screen.SignIn)
        private set

    var user by mutableStateOf(if (prefs.token != null) User(0, prefs.userName, prefs.userEmail) else null)
        private set
    var settings by mutableStateOf(GivingSettings())
        private set
    var stats by mutableStateOf(Stats())
        private set
    var donors by mutableStateOf<List<Donor>>(emptyList())
        private set
    var loading by mutableStateOf(false)
        private set
    var loaded by mutableStateOf(false)
        private set
    var busy by mutableStateOf(false)
        private set
    var query by mutableStateOf("")
        private set
    var view by mutableStateOf(View.All)
        private set
    var afroStep by mutableStateOf(prefs.afroStep)
        private set

    /** One-off message shown in a snackbar. */
    var message by mutableStateOf<String?>(null)
    var formError by mutableStateOf<String?>(null)

    private var searchJob: Job? = null

    private fun api() = Api(prefs.site, prefs.token)

    init {
        if (prefs.token != null) refresh()
    }

    fun go(to: Screen) {
        formError = null
        screen = to
    }

    fun back(): Boolean {
        when (val s = screen) {
            is Screen.Afro -> go(s.returnTo)
            Screen.Register, Screen.Settings, is Screen.Saved -> go(Screen.Home)
            else -> return false
        }
        return true
    }

    fun signIn(site: String, email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            formError = "Enter your email and password."
            return
        }
        busy = true
        formError = null
        viewModelScope.launch {
            try {
                prefs.site = site.ifBlank { prefs.site }
                val (token, u) = Api(prefs.site, null).login(email.trim(), password)
                prefs.token = token
                prefs.userName = u.name
                prefs.userEmail = u.email
                user = u
                go(Screen.Home)
                refresh()
            } catch (e: ApiException) {
                formError = errorText(e.code)
            } finally {
                busy = false
            }
        }
    }

    fun signOut() {
        val old = api()
        viewModelScope.launch { old.logout() }
        prefs.signOut()
        user = null
        donors = emptyList()
        stats = Stats()
        loaded = false
        go(Screen.SignIn)
    }

    fun refresh() {
        loading = true
        viewModelScope.launch {
            try {
                val (u, s, st) = api().home()
                user = u
                settings = s
                stats = st
                donors = api().donors(query, view.key)
                loaded = true
            } catch (e: ApiException) {
                handle(e)
            } finally {
                loading = false
            }
        }
    }

    fun search(text: String) {
        query = text
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300)
            loadList()
        }
    }

    fun selectView(v: View) {
        view = v
        viewModelScope.launch { loadList() }
    }

    private suspend fun loadList() {
        loading = true
        try {
            donors = api().donors(query, view.key)
        } catch (e: ApiException) {
            handle(e)
        } finally {
            loading = false
        }
    }

    fun register(d: NewDonor) {
        busy = true
        formError = null
        viewModelScope.launch {
            try {
                val (donor, created) = api().register(d)
                go(Screen.Saved(donor, created))
                refresh()
            } catch (e: ApiException) {
                if (e.code == "unauthorized") handle(e) else formError = errorText(e.code, e.min ?: settings.minAmount)
            } finally {
                busy = false
            }
        }
    }

    /** Mark (or unmark) a donor as added and verified in AfroMessage contacts. */
    fun setAfro(donor: Donor, done: Boolean, then: Screen = Screen.Home) {
        busy = true
        viewModelScope.launch {
            try {
                api().setAfroContact(donor.id, done)
                message = if (done) "${donor.name} is ready for SMS reminders." else "AfroMessage step reopened for ${donor.name}."
                go(then)
                refresh()
            } catch (e: ApiException) {
                handle(e)
            } finally {
                busy = false
            }
        }
    }

    fun changeAfroStep(on: Boolean) {
        prefs.afroStep = on
        afroStep = on
    }

    fun setAfroUrl(url: String) {
        prefs.afroUrl = url
    }

    private fun handle(e: ApiException) {
        if (e.code == "unauthorized") {
            prefs.signOut()
            user = null
            screen = Screen.SignIn
            formError = errorText(e.code)
        } else {
            message = errorText(e.code)
        }
    }
}
