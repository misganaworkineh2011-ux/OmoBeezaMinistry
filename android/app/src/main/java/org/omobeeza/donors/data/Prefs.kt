package org.omobeeza.donors.data

import android.content.Context
import org.omobeeza.donors.BuildConfig

/** Small key-value store for the sign-in and app settings. */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("omobeeza", Context.MODE_PRIVATE)

    init {
        // Earlier versions defaulted to addresses that aren't the ministry's live
        // site; forget those once so the current default is used.
        // The website moved from Vercel (….vercel.app) to www.omobeezaministry.org on Yegara.
        if (sp.getInt("siteVersion", 1) < 4) {
            val saved = sp.getString("site", null).orEmpty()
            if (saved.contains("omobeezaministry.com") || saved.contains(".vercel.app")) {
                sp.edit().remove("site").apply()
            }
            sp.edit().putInt("siteVersion", 4).apply()
        }
    }

    var site: String
        get() = sp.getString("site", null) ?: BuildConfig.DEFAULT_SITE
        set(v) = sp.edit().putString("site", v.trim().trimEnd('/')).apply()

    var token: String?
        get() = sp.getString("token", null)
        set(v) = sp.edit().putString("token", v).apply()

    /**
     * "admin" or "subadmin": which side of the app the saved sign-in opens.
     * Installs from before v1.7.0 (the separate Admin app) have a token but no
     * role: those are admins.
     */
    var role: String?
        get() = sp.getString("role", null) ?: if (token != null) ROLE_ADMIN else null
        set(v) = sp.edit().putString("role", v).apply()

    var userName: String
        get() = sp.getString("userName", "").orEmpty()
        set(v) = sp.edit().putString("userName", v).apply()

    var userEmail: String
        get() = sp.getString("userEmail", "").orEmpty()
        set(v) = sp.edit().putString("userEmail", v).apply()

    /** The SIM chosen for "Send SMS reminders" (-1 = the phone's default). */
    var smsSim: Int
        get() = sp.getInt("smsSim", -1)
        set(v) = sp.edit().putInt("smsSim", v).apply()

    fun signOut() = sp.edit().remove("token").remove("role").remove("userName").remove("userEmail").apply()

    companion object {
        const val ROLE_ADMIN = "admin"
        const val ROLE_SUB_ADMIN = "subadmin"
    }
}
