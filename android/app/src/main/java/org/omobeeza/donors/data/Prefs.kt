package org.omobeeza.donors.data

import android.content.Context
import org.omobeeza.donors.BuildConfig

/** Small key-value store for the sign-in and app settings. */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("omobeeza", Context.MODE_PRIVATE)

    init {
        // Earlier versions defaulted to addresses that aren't the ministry's live
        // site; forget those once so the current default is used.
        if (sp.getInt("siteVersion", 1) < 3) {
            val saved = sp.getString("site", null).orEmpty()
            if (saved.contains("omobeezaministry.com") || saved.trimEnd('/').endsWith("://omo-beeza-ministry.vercel.app")) {
                sp.edit().remove("site").apply()
            }
            sp.edit().putInt("siteVersion", 3).apply()
        }
    }

    var site: String
        get() = sp.getString("site", null) ?: BuildConfig.DEFAULT_SITE
        set(v) = sp.edit().putString("site", v.trim().trimEnd('/')).apply()

    var token: String?
        get() = sp.getString("token", null)
        set(v) = sp.edit().putString("token", v).apply()

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

    fun signOut() = sp.edit().remove("token").remove("userName").remove("userEmail").apply()
}
