package org.omobeeza.donors.data

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/** A SIM card in the phone (dual-SIM phones have two). */
data class Sim(val id: Int, val label: String)

/** One donor waiting for a reminder from this phone. */
data class QueuedSms(val id: Int, val name: String, val phone: String, val message: String, val lastReminded: String?)

/**
 * Sends reminders as ordinary SMS from this phone's SIM card, so donors see the
 * ministry's own number. Waits for Android to report each message as sent.
 */
object PhoneSms {
    private const val TAG = "PhoneSms"
    private val counter = AtomicInteger((System.currentTimeMillis() / 1000 % 100_000).toInt())

    fun canSend(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED

    fun hasTelephony(context: Context): Boolean =
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)

    /** The active SIM cards (empty when the phone-state permission was refused). */
    @SuppressLint("MissingPermission")
    fun sims(context: Context): List<Sim> {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) return emptyList()
        val sm = context.getSystemService(SubscriptionManager::class.java) ?: return emptyList()
        return runCatching {
            sm.activeSubscriptionInfoList.orEmpty().map { info ->
                val name = info.displayName?.toString()?.takeIf { it.isNotBlank() } ?: info.carrierName?.toString().orEmpty()
                Sim(info.subscriptionId, "SIM ${info.simSlotIndex + 1}${if (name.isNotBlank()) " · $name" else ""}")
            }
        }.getOrDefault(emptyList())
    }

    private fun manager(context: Context, simId: Int?): SmsManager {
        val base = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) context.getSystemService(SmsManager::class.java) else null
        return when {
            simId == null -> base ?: @Suppress("DEPRECATION") SmsManager.getDefault()
            base != null -> base.createForSubscriptionId(simId)
            else -> @Suppress("DEPRECATION") SmsManager.getSmsManagerForSubscriptionId(simId)
        }
    }

    /** Waiting sends: key → called once per part with Android's result code. */
    internal val waiting = ConcurrentHashMap<Int, (Int) -> Unit>()

    /**
     * Sends one SMS (split into parts when long) and returns null when every
     * part was sent, or a short reason when it failed. Android reports each
     * part to [SmsSentReceiver] (declared in the manifest, so the report always
     * arrives, even from the phone's own SMS service).
     */
    suspend fun send(context: Context, to: String, text: String, simId: Int?): String? {
        val app = context.applicationContext
        val sms = try {
            manager(app, simId)
        } catch (e: Exception) {
            return "No SIM available"
        }
        val parts = sms.divideMessage(text)
        val key = counter.incrementAndGet()
        // Android can hold a message while it asks "allow sending many SMS?", so wait generously.
        val result = withTimeoutOrNull(120_000) {
            suspendCancellableCoroutine { cont ->
                var left = parts.size
                var failure: String? = null
                waiting[key] = { code ->
                    synchronized(this@PhoneSms) {
                        if (code != Activity.RESULT_OK && failure == null) failure = reason(code)
                        left--
                        if (left <= 0) {
                            waiting.remove(key)
                            if (cont.isActive) cont.resume(failure)
                        }
                    }
                }
                cont.invokeOnCancellation { waiting.remove(key) }
                val flags = PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                val sent = ArrayList(parts.indices.map { i ->
                    val intent = Intent(app, SmsSentReceiver::class.java)
                        .setAction("${app.packageName}.SMS_SENT.$key.$i")
                        .putExtra(SmsSentReceiver.KEY, key)
                    PendingIntent.getBroadcast(app, key * 100 + i, intent, flags)
                })
                try {
                    if (parts.size == 1) sms.sendTextMessage(to, null, parts[0], sent[0], null)
                    else sms.sendMultipartTextMessage(to, null, parts, sent, null)
                    Log.i(TAG, "sms $key: handed ${parts.size} part(s) to the phone (sim ${simId ?: "default"})")
                } catch (e: Exception) {
                    Log.w(TAG, "sms $key: could not send", e)
                    waiting.remove(key)
                    if (cont.isActive) cont.resume(e.message ?: "Could not send")
                }
            }
        }
        if (result == null && waiting.remove(key) != null) {
            Log.w(TAG, "sms $key: no report from the phone")
            return "The phone didn't confirm the SMS (check the Messages app's sent folder)"
        }
        return result
    }

    private fun reason(code: Int): String = when (code) {
        SmsManager.RESULT_ERROR_RADIO_OFF -> "Phone is in airplane mode"
        SmsManager.RESULT_ERROR_NO_SERVICE -> "No mobile network"
        SmsManager.RESULT_ERROR_NULL_PDU -> "Message could not be built"
        SmsManager.RESULT_ERROR_LIMIT_EXCEEDED -> "Android's SMS limit was reached"
        SmsManager.RESULT_ERROR_SHORT_CODE_NEVER_ALLOWED, SmsManager.RESULT_ERROR_SHORT_CODE_NOT_ALLOWED -> "Sending was not allowed"
        else -> "Not sent (error $code). Check the SIM's airtime or SMS package."
    }
}

/** Receives Android's "sent" report for each SMS part sent by [PhoneSms]. */
class SmsSentReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val key = intent.getIntExtra(KEY, -1)
        Log.i("PhoneSms", "sms $key: report $resultCode (error ${intent.getIntExtra("errorCode", 0)})")
        PhoneSms.waiting[key]?.invoke(resultCode)
    }

    companion object {
        const val KEY = "org.omobeeza.donors.SMS_KEY"
    }
}
