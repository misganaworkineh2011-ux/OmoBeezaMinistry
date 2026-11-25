package org.omobeeza.donors.data

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/** An error from the website, with its short code (e.g. "invalid_phone"). */
class ApiException(val code: String, val status: Int = 0, val min: Int? = null, val serverMessage: String? = null) : Exception(code)

/**
 * Talks to the ministry website's app endpoints (/api/mobile/…), signed in
 * with the token from [login]. Plain HttpURLConnection + org.json keeps the
 * app small; every call runs off the main thread.
 */
class Api(baseUrl: String, private val token: String?) {
    private val base = baseUrl.trim().trimEnd('/')

    suspend fun login(email: String, password: String): Pair<String, User> {
        val o = request("POST", "/api/mobile/login", JSONObject().put("email", email).put("password", password))
        return o.getString("token") to user(o.getJSONObject("user"))
    }

    suspend fun logout() {
        runCatching { request("POST", "/api/mobile/logout", JSONObject()) }
    }

    suspend fun home(): Triple<User, GivingSettings, Stats> {
        val o = request("GET", "/api/mobile/home")
        val st = o.optJSONObject("stats") ?: JSONObject()
        return Triple(
            user(o.getJSONObject("user")),
            settings(o.getJSONObject("settings")),
            Stats(
                active = st.optInt("active"),
                weekly = st.optInt("weekly"),
                monthly = st.optInt("monthly"),
                paid7 = st.optInt("paid7"),
                smsWaiting = st.optInt("smsWaiting"),
                today = st.optInt("today"),
                subAdmins = st.optInt("subAdmins"),
                subRegistered = st.optInt("subRegistered"),
                subTarget = st.optInt("subTarget"),
            ),
        )
    }

    private fun settings(s: JSONObject): GivingSettings {
        val amounts = s.optJSONArray("amounts")?.let { a -> List(a.length()) { a.getInt(it) } }.orEmpty()
        return GivingSettings(
            amounts = amounts.ifEmpty { GivingSettings().amounts },
            minAmount = s.optInt("minAmount", 10),
            defaultDay = s.optInt("defaultDay", 0),
            yebunaUrl = s.optString("yebunaUrl"),
            amountLinks = s.optJSONObject("amountLinks")?.let { links ->
                links.keys().asSequence().mapNotNull { k -> k.toIntOrNull()?.let { it to links.optString(k) } }
                    .filter { it.second.startsWith("https://") }.toMap()
            }.orEmpty(),
            telegramBot = s.optString("telegramBot"),
            linkBase = s.optString("linkBase").takeIf { it.startsWith("https://") || it.startsWith("http://10.0.2.2") }.orEmpty(),
            defaultFrequency = if (s.optString("defaultFrequency") == "monthly") "monthly" else "weekly",
            defaultMonthDay = s.optInt("defaultMonthDay", 1).coerceIn(1, 28),
        )
    }

    /** [registrar] = only the donors that sub-admin registered. */
    suspend fun donors(query: String, view: String, registrar: Int? = null): List<Donor> {
        val q = URLEncoder.encode(query, "UTF-8")
        val o = request("GET", "/api/mobile/donors?view=$view&q=$q" + (registrar?.let { "&registrar=$it" } ?: ""))
        val list: JSONArray = o.optJSONArray("donors") ?: JSONArray()
        return List(list.length()) { Donor.from(list.getJSONObject(it)) }
    }

    /** A saved registration: the donor, whether it was new, and the welcome SMS to send ("" = none). */
    data class Registered(val donor: Donor, val created: Boolean, val welcomePending: Boolean)

    suspend fun register(d: NewDonor): Registered {
        val o = request("POST", "/api/mobile/donors", donorJson(d))
        return Registered(Donor.from(o.getJSONObject("donor")), o.optBoolean("created", true), o.optBoolean("welcome_pending"))
    }

    /** Change a donor's details (admin app). */
    suspend fun updateDonor(id: Int, d: NewDonor): Donor =
        Donor.from(request("PATCH", "/api/mobile/donors/$id", donorJson(d).put("status", d.status)).getJSONObject("donor"))

    /** New donors waiting for their welcome SMS, and active donors whose reminder day has come, each with their message. */
    suspend fun smsQueue(): List<QueuedSms> {
        val list = request("GET", "/api/mobile/sms").optJSONArray("donors") ?: JSONArray()
        return List(list.length()) {
            val o = list.getJSONObject(it)
            QueuedSms(o.getInt("id"), o.optString("name"), o.optString("phone"), o.optString("message"), o.optStringOrNull("last_reminded_at"), o.optString("kind", "reminder"))
        }
    }

    /** Tell the website how one SMS from this phone went (sent ones count as reminded). */
    suspend fun reportSms(id: Int, error: String?, kind: String = "reminder") {
        request("POST", "/api/mobile/sms", JSONObject().put("id", id).put("ok", error == null).put("error", error ?: "").put("kind", kind))
    }

    // Sub-admins, managed from the admin app.

    suspend fun subAdmins(): List<SubAdmin> {
        val list = request("GET", "/api/mobile/registrars").optJSONArray("registrars") ?: JSONArray()
        return List(list.length()) { SubAdmin.from(list.getJSONObject(it)) }
    }

    private fun SubAdminInput.json() = JSONObject().apply {
        name?.let { put("name", it) }
        phone?.let { put("phone", it) }
        password?.let { put("password", it) }
        target?.let { put("target", it) }
        status?.let { put("status", it) }
    }

    suspend fun addSubAdmin(input: SubAdminInput): SubAdmin =
        SubAdmin.from(request("POST", "/api/mobile/registrars", input.json()).getJSONObject("registrar"))

    suspend fun updateSubAdmin(id: Int, input: SubAdminInput): SubAdmin =
        SubAdmin.from(request("PATCH", "/api/mobile/registrars/$id", input.json()).getJSONObject("registrar"))

    suspend fun removeSubAdmin(id: Int) {
        request("POST", "/api/mobile/registrars/$id", JSONObject().put("delete", true))
    }

    // The Sub-admin app (/api/registrar/...).

    suspend fun subLogin(phone: String, password: String): Pair<String, Progress> {
        val o = request("POST", "/api/registrar/login", JSONObject().put("phone", phone).put("password", password))
        return o.getString("token") to progress(o.getJSONObject("registrar"))
    }

    suspend fun subLogout() {
        runCatching { request("POST", "/api/registrar/logout", JSONObject()) }
    }

    data class SubHome(val me: Progress, val settings: GivingSettings, val donors: List<Donor>)

    suspend fun subHome(): SubHome {
        val o = request("GET", "/api/registrar/home")
        val list = o.optJSONArray("donors") ?: JSONArray()
        return SubHome(progress(o.getJSONObject("registrar")), settings(o.getJSONObject("settings")), List(list.length()) { Donor.from(list.getJSONObject(it)) })
    }

    suspend fun subRegister(d: NewDonor): Donor {
        val o = request("POST", "/api/registrar/donors", donorJson(d))
        return Donor.from(o.getJSONObject("donor"))
    }

    /** The sub-admin raises their own target by [add] after reaching it. Returns the new progress numbers. */
    suspend fun subExtendTarget(add: Int): Pair<Int, Int> {
        val o = request("POST", "/api/registrar/target", JSONObject().put("add", add))
        return o.optInt("target") to o.optInt("registered")
    }

    private fun progress(o: JSONObject) = Progress(
        id = o.optInt("id"),
        name = o.optString("name"),
        phone = o.optString("phone"),
        target = o.optInt("target"),
        registered = o.optInt("registered"),
        today = o.optInt("today"),
    )

    private fun donorJson(d: NewDonor) = JSONObject()
        .put("name", d.name).put("nickname", d.nickname).put("phone", d.phone).put("email", d.email)
        .put("amount", d.amount).put("day", d.day).put("locale", d.locale)
        .put("notes", d.notes).put("telegram", d.telegram).put("consent", true)
        .put("frequency", d.frequency).put("monthDay", d.monthDay)

    private fun user(o: JSONObject) = User(o.optInt("id"), o.optString("name"), o.optString("email"))

    private suspend fun request(method: String, path: String, body: JSONObject? = null): JSONObject =
        withContext(Dispatchers.IO) {
            var url = try {
                URL(base + path)
            } catch (e: Exception) {
                throw ApiException("bad_site")
            }
            // Follow redirects ourselves (e.g. example.com → www.example.com):
            // HttpURLConnection won't repeat a POST on a redirect.
            repeat(4) {
                val conn = url.openConnection() as HttpURLConnection
                try {
                    conn.instanceFollowRedirects = false
                    // HttpURLConnection can't send PATCH; the website accepts POST there too.
                    conn.requestMethod = if (method == "PATCH") "POST" else method
                    conn.connectTimeout = 15_000
                    conn.readTimeout = 30_000
                    conn.setRequestProperty("Accept", "application/json")
                    token?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
                    if (body != null) {
                        conn.doOutput = true
                        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                        conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                    }
                    val status = conn.responseCode
                    if (status in listOf(301, 302, 303, 307, 308)) {
                        val location = conn.getHeaderField("Location") ?: throw ApiException("server", status)
                        val next = URL(url, location)
                        if (next.protocol != "https" && next.host != "10.0.2.2") throw ApiException("bad_site")
                        url = next
                        return@repeat
                    }
                    val stream = if (status in 200..299) conn.inputStream else conn.errorStream
                    val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                    val json = runCatching { JSONObject(text) }.getOrNull()
                    if (status !in 200..299 || json == null) {
                        val code = json?.optString("error")?.takeIf { it.isNotBlank() }
                            ?: when {
                                status == 404 -> "not_found"
                                json == null -> "not_api"
                                else -> "server"
                            }
                        throw ApiException(code, status, json?.optInt("min")?.takeIf { it > 0 }, json?.optString("message")?.takeIf { it.isNotBlank() })
                    }
                    return@withContext json
                } catch (e: IOException) {
                    throw ApiException("network")
                } finally {
                    conn.disconnect()
                }
            }
            throw ApiException("server")
        }
}
