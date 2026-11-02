package org.omobeeza.donors.data

import android.content.Context
import org.omobeeza.donors.BuildConfig

/** Small key-value store for the sign-in and app settings. */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("omobeeza", Context.MODE_PRIVATE)

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

    /** Show the guided "add to AfroMessage contacts" step (needed while AfroMessage is in beta). */
    var afroStep: Boolean
        get() = sp.getBoolean("afroStep", true)
        set(v) = sp.edit().putBoolean("afroStep", v).apply()

    var afroUrl: String
        get() = sp.getString("afroUrl", null) ?: BuildConfig.DEFAULT_AFRO_URL
        set(v) = sp.edit().putString("afroUrl", v.trim()).apply()

    fun signOut() = sp.edit().remove("token").remove("userName").remove("userEmail").apply()
}
