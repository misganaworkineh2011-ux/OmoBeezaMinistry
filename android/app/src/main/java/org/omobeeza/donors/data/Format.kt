package org.omobeeza.donors.data

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

val DAYS_EN = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
val DAYS_AM = listOf("እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "ዓርብ", "ቅዳሜ")

fun dayName(day: Int, locale: String = "en"): String = (if (locale == "am") DAYS_AM else DAYS_EN)[((day % 7) + 7) % 7]

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
fun ordinal(n: Int): String {
    val suffix = if (n % 100 in 11..13) "th" else when (n % 10) { 1 -> "st"; 2 -> "nd"; 3 -> "rd"; else -> "th" }
    return "$n$suffix"
}

/** "every Monday" / "monthly · 5th" (Amharic: "በየሰኞ" / "በየወሩ 5ኛ ቀን"). */
fun schedule(frequency: String, day: Int, monthDay: Int, locale: String = "en"): String = when {
    frequency == "monthly" && locale == "am" -> "በየወሩ ${monthDay}ኛ ቀን"
    frequency == "monthly" -> "monthly · ${ordinal(monthDay)}"
    locale == "am" -> "በየ${dayName(day, "am")}"
    else -> "every ${dayName(day)}"
}

/** The app's own (English) wording of a donor's schedule: "every Monday" / "monthly · 5th". */
fun Donor.schedule(): String = schedule(frequency, reminderDay, monthDay)

/** Short form for list pills: "Mon" / "5th monthly". */
fun Donor.shortSchedule(): String = if (monthly) "${ordinal(monthDay)} monthly" else dayName(reminderDay).take(3)

/** "weekly" / "monthly". */
fun Donor.period(): String = if (monthly) "monthly" else "weekly"

/** "/week" or "/month". */
fun Donor.per(): String = if (monthly) "/month" else "/week"

/**
 * Ethiopian mobile numbers → +2519XXXXXXXX / +2517XXXXXXXX. Accepts 09…, 07…,
 * 9…, 2519…, +251 9… with spaces or dashes. Same rules as the website.
 */
fun normalizePhone(input: String): String? {
    val digits = input.replace(Regex("[\\s\\-().]"), "").removePrefix("+")
    val m = Regex("^(?:251|0)?([79]\\d{8})$").find(digits) ?: return null
    return "+251${m.groupValues[1]}"
}

/** What was typed in the sign-in field: an admin's email or a sub-admin's phone number. */
sealed interface SignInId {
    /** A dashboard account: the admin side of the app. */
    data class Email(val email: String) : SignInId
    /** A sub-admin's phone number (+2519…/+2517…): only donor registration. */
    data class Phone(val phone: String) : SignInId
    data object Empty : SignInId
    /** Neither a valid email nor an Ethiopian mobile number. */
    data object Invalid : SignInId
}

fun signInId(input: String): SignInId {
    val v = input.trim()
    if (v.isEmpty()) return SignInId.Empty
    if (v.contains('@')) {
        return if (Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(v)) SignInId.Email(v) else SignInId.Invalid
    }
    return normalizePhone(v)?.let { SignInId.Phone(it) } ?: SignInId.Invalid
}

/** +251911234567 → 0911 234 567 */
fun localPhone(e164: String): String {
    val m = Regex("^\\+251(\\d)(\\d{2})(\\d{3})(\\d{3})$").find(e164) ?: return e164
    val (a, b, c, d) = m.destructured
    return "0$a$b $c $d"
}

/** "@Abebe_K" / "t.me/abebe_k" → "abebe_k"; null when not a valid Telegram username. */
fun normalizeTelegram(input: String): String? {
    val v = input.trim().replace(Regex("^(https?://)?(t\\.me|telegram\\.me)/", RegexOption.IGNORE_CASE), "").removePrefix("@")
    return if (Regex("^[A-Za-z][A-Za-z0-9_]{4,31}$").matches(v)) v.lowercase() else null
}

fun birr(n: Int): String = NumberFormat.getIntegerInstance(Locale.US).format(n)

/** "2026-11-02T09:30:00.000Z" or "2026-11-02" → "2 Nov 2026". */
fun prettyDate(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    val patterns = listOf("yyyy-MM-dd'T'HH:mm:ss.SSSX", "yyyy-MM-dd'T'HH:mm:ssX", "yyyy-MM-dd HH:mm:ss.SSSSSSX", "yyyy-MM-dd")
    for (p in patterns) {
        val parsed = runCatching {
            SimpleDateFormat(p, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(iso)
        }.getOrNull() ?: continue
        return SimpleDateFormat("d MMM yyyy", Locale.US).format(parsed)
    }
    return iso.take(10)
}

fun initials(name: String): String =
    name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.substring(0, it.offsetByCodePoints(0, 1)) }
        .uppercase().ifEmpty { "?" }

/** Friendly text for the website's error codes ([subAdmin]: worded for the sub-admin side). */
fun errorText(code: String, min: Int? = null, subAdmin: Boolean = false): String = when (code) {
    "network" -> "No connection. Check the internet and try again."
    "bad_site" -> "The website address doesn't look right."
    "invalid_credentials" -> if (subAdmin) "Wrong phone number or password." else "Wrong email or password."
    "unauthorized" -> "Please sign in again."
    "rate_limited" -> "Too many attempts. Please wait a few minutes."
    "not_configured" -> "The website's database isn't set up yet."
    "invalid_name" -> "Enter the donor's name."
    "invalid_phone" -> "Enter a valid Ethiopian mobile number (09… or 07…)."
    "invalid_email" -> "Enter a valid email, or leave it empty."
    "invalid_amount" -> "The amount must be at least ${min ?: 10} birr."
    "invalid_day" -> "Choose a reminder day (for monthly: 1–28)."
    "invalid_telegram" -> "That doesn't look like a Telegram username (like @abebe_k)."
    "consent_required" -> "Confirm that the donor agreed to SMS reminders."
    "already_registered" -> "This phone number is already registered as a donor."
    "paused" -> "Your account is paused. Ask the ministry admin to turn it back on."
    "weak_password" -> "The password needs at least 8 characters."
    "invalid_target" -> if (subAdmin) "Choose how many more donors (1–500)." else "Enter how many donors they should register (0 or more)."
    "target_not_reached" -> "You can add more once you've reached your current target."
    "phone_taken" -> "There is already a sub-admin with this phone number."
    "not_found" -> "The website doesn't have the app connection yet. Deploy the latest website update, or check the website address."
    "not_api" -> "That address didn't answer like the Omo Beeza website. Check the website address on the sign-in screen."
    else -> "Something went wrong ($code). Please try again."
}
