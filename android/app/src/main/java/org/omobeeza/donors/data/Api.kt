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
class ApiException(val code: String, val status: Int = 0, val min: Int? = null) : Exception(code)

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
        val s = o.getJSONObject("settings")
        val amounts = s.optJSONArray("amounts")?.let { a -> List(a.length()) { a.getInt(it) } }.orEmpty()
        val st = o.optJSONObject("stats") ?: JSONObject()
        return Triple(
            user(o.getJSONObject("user")),
            GivingSettings(
                amounts = amounts.ifEmpty { GivingSettings().amounts },
                minAmount = s.optInt("minAmount", 10),
                defaultDay = s.optInt("defaultDay", 0),
                yebunaUrl = s.optString("yebunaUrl"),
                amountLinks = s.optJSONObject("amountLinks")?.let { links ->
                    links.keys().asSequence().mapNotNull { k -> k.toIntOrNull()?.let { it to links.optString(k) } }
                        .filter { it.second.startsWith("https://") }.toMap()
                }.orEmpty(),
                telegramBot = s.optString("telegramBot"),
            ),
            Stats(
                active = st.optInt("active"),
                weekly = st.optInt("weekly"),
                paid7 = st.optInt("paid7"),
                smsWaiting = st.optInt("smsWaiting"),
                today = st.optInt("today"),
            ),
        )
    }

    suspend fun donors(query: String, view: String): List<Donor> {
        val q = URLEncoder.encode(query, "UTF-8")
        val o = request("GET", "/api/mobile/donors?view=$view&q=$q")
        val list: JSONArray = o.optJSONArray("donors") ?: JSONArray()
        return List(list.length()) { Donor.from(list.getJSONObject(it)) }
    }

    /** A saved registration: the donor, whether it was new, and the welcome SMS to send ("" = none). */
    data class Registered(val donor: Donor, val created: Boolean, val welcomeSms: String)

    suspend fun register(d: NewDonor): Registered {
        val body = JSONObject()
            .put("name", d.name).put("nickname", d.nickname).put("phone", d.phone).put("email", d.email)
            .put("amount", d.amount).put("day", d.day).put("locale", d.locale)
            .put("notes", d.notes).put("telegram", d.telegram).put("consent", true)
        val o = request("POST", "/api/mobile/donors", body)
        return Registered(Donor.from(o.getJSONObject("donor")), o.optBoolean("created", true), o.optString("welcome_sms"))
    }

    /** Active donors who haven't had a reminder in 7 days, each with their message. */
    suspend fun smsQueue(): List<QueuedSms> {
        val list = request("GET", "/api/mobile/sms").optJSONArray("donors") ?: JSONArray()
        return List(list.length()) {
            val o = list.getJSONObject(it)
            QueuedSms(o.getInt("id"), o.optString("name"), o.optString("phone"), o.optString("message"), o.optStringOrNull("last_reminded_at"))
        }
    }

    /** Tell the website how one SMS from this phone went (sent ones count as reminded). */
    suspend fun reportSms(id: Int, error: String?, kind: String = "reminder") {
        request("POST", "/api/mobile/sms", JSONObject().put("id", id).put("ok", error == null).put("error", error ?: "").put("kind", kind))
    }

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
                        throw ApiException(code, status, json?.optInt("min")?.takeIf { it > 0 })
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
