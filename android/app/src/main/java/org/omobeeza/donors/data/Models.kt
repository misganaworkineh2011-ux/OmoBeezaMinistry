package org.omobeeza.donors.data

import org.json.JSONObject

data class User(val id: Int, val name: String, val email: String) {
    val firstName: String get() = name.trim().split(Regex("\\s+")).firstOrNull().orEmpty()
}

data class GivingSettings(
    val amounts: List<Int> = listOf(50, 100, 250, 500, 1000, 2000, 5000, 10000),
    val minAmount: Int = 10,
    val defaultDay: Int = 0,
    val yebunaUrl: String = "",
    /** The reminder bot's @username ("" when the bot isn't set up). */
    val telegramBot: String = "",
)

data class Stats(
    val active: Int = 0,
    val weekly: Int = 0,
    val paid7: Int = 0,
    /** Active donors with a phone who haven't had a reminder in 7 days. */
    val smsWaiting: Int = 0,
    val today: Int = 0,
)

data class Donor(
    val id: Int,
    val name: String,
    val nickname: String = "",
    val phone: String,
    val email: String,
    val amount: Int,
    val reminderDay: Int,
    val locale: String,
    val status: String,
    val source: String,
    val notes: String,
    val createdAt: String,
    val lastReminded: String? = null,
    val lastPaid: String?,
    val total: Int,
    val telegramUsername: String = "",
    val telegramLinked: Boolean = false,
    /** One-tap link that connects this donor to the reminder bot. */
    val telegramLink: String = "",
) {
    companion object {
        fun from(o: JSONObject) = Donor(
            id = o.getInt("id"),
            name = o.optString("name"),
            nickname = o.optString("nickname"),
            phone = o.optString("phone"),
            email = o.optString("email"),
            amount = o.optInt("amount"),
            reminderDay = o.optInt("reminder_day"),
            locale = o.optString("locale", "en"),
            status = o.optString("status", "active"),
            source = o.optString("source"),
            notes = o.optString("notes"),
            createdAt = o.optString("created_at"),
            lastReminded = o.optStringOrNull("last_reminded_at"),
            lastPaid = o.optStringOrNull("last_paid"),
            total = o.optInt("total"),
            telegramUsername = o.optString("telegram_username"),
            telegramLinked = o.optBoolean("telegram_linked"),
            telegramLink = o.optString("telegram_link"),
        )
    }
}

/** What the register form sends. */
data class NewDonor(
    val name: String,
    val nickname: String,
    val phone: String,
    val email: String,
    val amount: Int,
    val day: Int,
    val locale: String,
    val notes: String,
    val telegram: String = "",
)

internal fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key) || !has(key)) null else optString(key).takeIf { it.isNotBlank() }
