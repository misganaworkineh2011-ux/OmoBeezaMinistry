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
    /** Ye-Buna payment link for each amount (amount in birr → link). */
    val amountLinks: Map<Int, String> = emptyMap(),
    /** The reminder bot's @username ("" when the bot isn't set up). */
    val telegramBot: String = "",
    /** The ministry's own payment links, e.g. https://www.omobeezaministry.org/give ("" = older website). */
    val linkBase: String = "",
)

/**
 * Where a donor pays [amount] birr ("" = no Ye-Buna link set up): the ministry's
 * own address (…/give/250), which forwards to that amount's Ye-Buna page or the
 * general one. Older websites without /give get the Ye-Buna link itself.
 */
fun GivingSettings.payLink(amount: Int): String {
    val yebuna = amountLinks[amount] ?: yebunaUrl
    if (yebuna.isBlank()) return ""
    return if (linkBase.isNotBlank()) "$linkBase/$amount" else yebuna
}

data class Stats(
    val active: Int = 0,
    val weekly: Int = 0,
    val paid7: Int = 0,
    /** Active donors with a phone who haven't had a reminder in 7 days. */
    val smsWaiting: Int = 0,
    val today: Int = 0,
    /** Active sub-admins, the donors they registered, and their targets added up. */
    val subAdmins: Int = 0,
    val subRegistered: Int = 0,
    val subTarget: Int = 0,
)

/** A sub-admin (someone who only registers donors), as the admin app lists them. */
data class SubAdmin(
    val id: Int,
    val name: String,
    val phone: String,
    val target: Int,
    val status: String,
    val registered: Int,
    val createdAt: String = "",
    val lastLogin: String? = null,
    val lastRegistered: String? = null,
) {
    val active: Boolean get() = status == "active"

    companion object {
        fun from(o: JSONObject) = SubAdmin(
            id = o.getInt("id"),
            name = o.optString("name"),
            phone = o.optString("phone"),
            target = o.optInt("target"),
            status = o.optString("status", "active"),
            registered = o.optInt("registered"),
            createdAt = o.optString("created_at"),
            lastLogin = o.optStringOrNull("last_login"),
            lastRegistered = o.optStringOrNull("last_registered"),
        )
    }
}

/** What the admin app sends to add or change a sub-admin (null = unchanged). */
data class SubAdminInput(
    val name: String? = null,
    val phone: String? = null,
    val password: String? = null,
    val target: Int? = null,
    val status: String? = null,
)

/** The signed-in sub-admin's target and progress (Sub-admin app). */
data class Progress(
    val id: Int = 0,
    val name: String = "",
    val phone: String = "",
    val target: Int = 0,
    val registered: Int = 0,
    val today: Int = 0,
) {
    val left: Int get() = (target - registered).coerceAtLeast(0)
    val done: Boolean get() = target > 0 && registered >= target
    val fraction: Float get() = if (target <= 0) 0f else (registered.toFloat() / target).coerceIn(0f, 1f)
}

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
    /** The sub-admin who registered them ("" = not a sub-admin). */
    val registeredBy: String = "",
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
            registeredBy = o.optString("registered_by_name"),
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
