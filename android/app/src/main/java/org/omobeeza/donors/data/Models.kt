package org.omobeeza.donors.data

import org.json.JSONObject

data class User(val id: Int, val name: String, val email: String) {
    val firstName: String get() = name.trim().split(Regex("\\s+")).firstOrNull().orEmpty()
}

data class GivingSettings(
    val amounts: List<Int> = listOf(50, 100, 250, 500),
    val minAmount: Int = 10,
    val defaultDay: Int = 0,
    val yebunaUrl: String = "",
)

data class Stats(
    val active: Int = 0,
    val weekly: Int = 0,
    val paid7: Int = 0,
    val pendingAfro: Int = 0,
    val today: Int = 0,
)

data class Donor(
    val id: Int,
    val name: String,
    val phone: String,
    val email: String,
    val amount: Int,
    val reminderDay: Int,
    val locale: String,
    val status: String,
    val source: String,
    val notes: String,
    val createdAt: String,
    val afroContactAt: String?,
    val lastPaid: String?,
    val total: Int,
) {
    val afroDone: Boolean get() = afroContactAt != null

    companion object {
        fun from(o: JSONObject) = Donor(
            id = o.getInt("id"),
            name = o.optString("name"),
            phone = o.optString("phone"),
            email = o.optString("email"),
            amount = o.optInt("amount"),
            reminderDay = o.optInt("reminder_day"),
            locale = o.optString("locale", "en"),
            status = o.optString("status", "active"),
            source = o.optString("source"),
            notes = o.optString("notes"),
            createdAt = o.optString("created_at"),
            afroContactAt = o.optStringOrNull("afro_contact_at"),
            lastPaid = o.optStringOrNull("last_paid"),
            total = o.optInt("total"),
        )
    }
}

/** What the register form sends. */
data class NewDonor(
    val name: String,
    val phone: String,
    val email: String,
    val amount: Int,
    val day: Int,
    val locale: String,
    val notes: String,
)

internal fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key) || !has(key)) null else optString(key).takeIf { it.isNotBlank() }
