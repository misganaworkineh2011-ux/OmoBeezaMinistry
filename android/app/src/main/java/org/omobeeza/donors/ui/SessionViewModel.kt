package org.omobeeza.donors.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import org.omobeeza.donors.data.Api
import org.omobeeza.donors.data.ApiException
import org.omobeeza.donors.data.Prefs
import org.omobeeza.donors.data.SignInId
import org.omobeeza.donors.data.errorText
import org.omobeeza.donors.data.signInId

/** Which side of the app the signed-in person sees. */
enum class Role { Admin, SubAdmin }

/**
 * One sign-in for everyone: a dashboard email opens the admin side, a
 * sub-admin's phone number opens only donor registration. Remembers the role
 * with the token; signing out (from either side) comes back here.
 */
class SessionViewModel(app: Application) : AndroidViewModel(app) {
    val prefs = Prefs(app)

    var role by mutableStateOf(roleOf(prefs.role))
        private set
    /** Changes on every sign-in, so each signed-in session gets fresh screens. */
    var generation by mutableIntStateOf(0)
        private set
    var busy by mutableStateOf(false)
        private set
    var formError by mutableStateOf<String?>(null)

    private fun roleOf(v: String?): Role? = when (v) {
        Prefs.ROLE_ADMIN -> Role.Admin
        Prefs.ROLE_SUB_ADMIN -> Role.SubAdmin
        else -> null
    }

    fun signIn(site: String, id: String, password: String) {
        val who = signInId(id)
        when {
            who == SignInId.Empty || password.isBlank() -> {
                formError = "Enter your email or phone number, and your password."
                return
            }
            who == SignInId.Invalid -> {
                formError = "Enter your dashboard email (admins) or your phone number, like 0911 234 567 (sub-admins)."
                return
            }
        }
        busy = true
        formError = null
        viewModelScope.launch {
            try {
                prefs.site = site.ifBlank { prefs.site }
                val api = Api(prefs.site, null)
                when (who) {
                    is SignInId.Email -> {
                        val (token, u) = api.login(who.email, password)
                        save(token, Prefs.ROLE_ADMIN, u.name, u.email)
                    }
                    is SignInId.Phone -> {
                        val (token, p) = api.subLogin(who.phone, password)
                        save(token, Prefs.ROLE_SUB_ADMIN, p.name, p.phone)
                    }
                    else -> Unit
                }
            } catch (e: ApiException) {
                formError = errorText(e.code, subAdmin = who is SignInId.Phone)
            } finally {
                busy = false
            }
        }
    }

    private fun save(token: String, r: String, name: String, contact: String) {
        prefs.token = token
        prefs.role = r
        prefs.userName = name
        prefs.userEmail = contact
        generation++
        role = roleOf(r)
    }

    /** Called by either side after signing out (or being signed out): back to the sign-in screen. */
    fun signedOut(notice: String? = null) {
        prefs.signOut()
        formError = notice
        role = null
    }
}
