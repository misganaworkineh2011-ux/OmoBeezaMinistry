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
import org.omobeeza.donors.data.PhoneSms
import org.omobeeza.donors.data.QueuedSms
import org.omobeeza.donors.data.Prefs
import org.omobeeza.donors.data.Stats
import org.omobeeza.donors.data.User
import org.omobeeza.donors.data.errorText

sealed interface Screen {
    data object SignIn : Screen
    data object Home : Screen
    data object Register : Screen
    data class Saved(val donor: Donor, val created: Boolean) : Screen
    data object Settings : Screen
}

/** The "Send SMS reminders" sheet: the donors waiting and how sending is going. */
data class SmsRun(
    val phase: Phase,
    val queue: List<QueuedSms> = emptyList(),
    val done: Int = 0,
    val sent: Int = 0,
    val failed: List<Pair<String, String>> = emptyList(),
    val current: String = "",
    val stopped: String? = null,
) {
    enum class Phase { Loading, Ready, Sending, Done }
}

enum class View(val key: String, val label: String) {
    All("all", "All"),
    Active("active", "Active"),
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
    /** How the welcome SMS for the donor just registered went (shown on the Saved screen). */
    var welcomeSms by mutableStateOf<String?>(null)
        private set

    /** One-off message shown in a snackbar. */
    var message by mutableStateOf<String?>(null)
    var formError by mutableStateOf<String?>(null)

    var sms by mutableStateOf<SmsRun?>(null)
        private set

    private var searchJob: Job? = null
    private var smsStop = false

    private fun api() = Api(prefs.site, prefs.token)

    init {
        if (prefs.token != null) refresh()
    }

    fun go(to: Screen) {
        formError = null
        screen = to
    }

    fun back(): Boolean {
        when (screen) {
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
                val saved = api().register(d)
                welcomeSms = null
                go(Screen.Saved(saved.donor, saved.created))
                refresh()
                if (saved.welcomeSms.isNotBlank()) sendWelcome(saved.donor, saved.welcomeSms)
            } catch (e: ApiException) {
                if (e.code == "unauthorized") handle(e) else formError = errorText(e.code, e.min ?: settings.minAmount)
            } finally {
                busy = false
            }
        }
    }

    /** The welcome SMS for a newly registered donor, sent from this phone's SIM. */
    private suspend fun sendWelcome(donor: Donor, text: String) {
        val context = getApplication<Application>()
        if (!PhoneSms.hasTelephony(context)) return
        if (!PhoneSms.canSend(context)) {
            welcomeSms = "Welcome SMS not sent: allow SMS first (Send SMS reminders on the home screen)."
            return
        }
        welcomeSms = "Sending the welcome SMS…"
        val error = PhoneSms.send(context, donor.phone, text, prefs.smsSim.takeIf { it >= 0 })
        runCatching { api().reportSms(donor.id, error, "welcome") }
        welcomeSms = if (error == null) "Welcome SMS sent from this phone." else "Welcome SMS not sent: $error"
    }

    /** Open the sheet and load the donors who haven't had a reminder in 7 days. */
    fun openSms() {
        if (sms?.phase == SmsRun.Phase.Sending) return
        sms = SmsRun(SmsRun.Phase.Loading)
        viewModelScope.launch {
            try {
                sms = SmsRun(SmsRun.Phase.Ready, api().smsQueue())
            } catch (e: ApiException) {
                sms = null
                handle(e)
            }
        }
    }

    fun closeSms() {
        if (sms?.phase != SmsRun.Phase.Sending) sms = null
    }

    /** Stop after the message being sent now (so nothing is sent without being recorded). */
    fun stopSms() {
        smsStop = true
    }

    /** Send each waiting donor their reminder from this phone, a few seconds apart. */
    fun startSms(simId: Int?) {
        val start = sms ?: return
        if (start.phase != SmsRun.Phase.Ready || start.queue.isEmpty()) return
        val context = getApplication<Application>()
        prefs.smsSim = simId ?: -1
        smsStop = false
        viewModelScope.launch {
            var run = start.copy(phase = SmsRun.Phase.Sending)
            sms = run
            var inARow = 0
            try {
                for ((i, d) in start.queue.withIndex()) {
                    if (i > 0) delay(3_000)
                    if (smsStop) break
                    run = run.copy(current = d.name)
                    sms = run
                    val error = PhoneSms.send(context, d.phone, d.message, simId)
                    // Tell the website (a sent one counts as this week's reminder).
                    for (attempt in 1..3) {
                        val reported = runCatching { api().reportSms(d.id, error) }.isSuccess
                        if (reported) break
                        delay(2_000L * attempt)
                    }
                    run = if (error == null) run.copy(done = run.done + 1, sent = run.sent + 1)
                    else run.copy(done = run.done + 1, failed = run.failed + (d.name to error))
                    sms = run
                    inARow = if (error == null) 0 else inARow + 1
                    if (inARow >= 3) {
                        run = run.copy(stopped = "Stopped after 3 failures in a row: $error")
                        break
                    }
                }
            } finally {
                sms = run.copy(phase = SmsRun.Phase.Done, current = "", stopped = run.stopped ?: if (run.done < start.queue.size) "Stopped." else null)
                refresh()
            }
        }
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
