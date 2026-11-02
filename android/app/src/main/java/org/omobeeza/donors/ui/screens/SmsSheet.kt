package org.omobeeza.donors.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.omobeeza.donors.data.PhoneSms
import org.omobeeza.donors.data.Sim
import org.omobeeza.donors.data.localPhone
import org.omobeeza.donors.data.prettyDate
import org.omobeeza.donors.ui.SmsRun
import org.omobeeza.donors.ui.components.Avatar
import org.omobeeza.donors.ui.components.GoldButton
import org.omobeeza.donors.ui.theme.Brand

/** "Send SMS reminders": reminders as normal SMS from this phone's SIM. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SmsSheet(run: SmsRun, savedSim: Int, onSend: (Int?) -> Unit, onStop: () -> Unit, onClose: () -> Unit) {
    val sending by rememberUpdatedState(run.phase == SmsRun.Phase.Sending)
    val sheet = rememberModalBottomSheetState(
        skipPartiallyExpanded = true,
        confirmValueChange = { it != SheetValue.Hidden || !sending },
    )
    // Keep the screen on while sending, so the phone doesn't sleep half-way.
    val view = LocalView.current
    DisposableEffect(run.phase) {
        view.keepScreenOn = run.phase == SmsRun.Phase.Sending
        onDispose { view.keepScreenOn = false }
    }
    ModalBottomSheet(onDismissRequest = onClose, sheetState = sheet, containerColor = Brand.Sand) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 30.dp).animateContentSize()) {
            when (run.phase) {
                SmsRun.Phase.Loading -> Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Brand.Gold)
                }
                SmsRun.Phase.Ready -> Ready(run, savedSim, onSend, onClose)
                SmsRun.Phase.Sending -> Sending(run, onStop)
                SmsRun.Phase.Done -> Done(run, onClose)
            }
        }
    }
}

@Composable
private fun Title(text: String, sub: String) {
    Text(text, style = MaterialTheme.typography.headlineSmall, color = Brand.Ink)
    Spacer(Modifier.height(4.dp))
    Text(sub, style = MaterialTheme.typography.bodyMedium, color = Brand.Body)
    Spacer(Modifier.height(16.dp))
}

@Composable
private fun Ready(run: SmsRun, savedSim: Int, onSend: (Int?) -> Unit, onClose: () -> Unit) {
    val context = LocalContext.current
    var sims by remember { mutableStateOf(PhoneSms.sims(context)) }
    var sim by remember { mutableIntStateOf(savedSim) }
    var canSend by remember { mutableStateOf(PhoneSms.canSend(context)) }
    var asked by remember { mutableStateOf(false) }
    val permissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        canSend = PhoneSms.canSend(context)
        sims = PhoneSms.sims(context)
        asked = true
    }
    LaunchedEffect(Unit) {
        if (!canSend || sims.isEmpty()) permissions.launch(arrayOf(Manifest.permission.SEND_SMS, Manifest.permission.READ_PHONE_STATE))
    }
    val chosen = sims.firstOrNull { it.id == sim } ?: sims.firstOrNull()

    if (run.queue.isEmpty()) {
        Title("Everyone is up to date", "Every active donor has had a reminder in the last 7 days.")
        OutlinedButton(onClick = onClose, Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp)) { Text("Close") }
        return
    }

    val n = run.queue.size
    Title(
        "Send SMS reminders",
        "$n donor${if (n == 1) " hasn't" else "s haven't"} had a reminder in the last 7 days. Each gets their usual reminder as a normal SMS from this phone.",
    )
    run.queue.take(5).forEach { d ->
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Avatar(d.name, d.id, 38.dp)
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(d.name, style = MaterialTheme.typography.titleSmall, color = Brand.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    "${localPhone(d.phone)} · ${if (d.lastReminded == null) "never reminded" else "last ${prettyDate(d.lastReminded)}"}",
                    style = MaterialTheme.typography.bodySmall, color = Brand.Muted,
                )
            }
        }
    }
    if (n > 5) Text("and ${n - 5} more", style = MaterialTheme.typography.bodySmall, color = Brand.Muted, modifier = Modifier.padding(start = 50.dp))

    if (sims.size > 1) {
        Spacer(Modifier.height(14.dp))
        Text("Send from", style = MaterialTheme.typography.titleSmall, color = Brand.Navy)
        Spacer(Modifier.height(6.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(sims) { s: Sim ->
                FilterChip(
                    selected = chosen?.id == s.id,
                    onClick = { sim = s.id },
                    label = { Text(s.label) },
                    shape = RoundedCornerShape(50),
                    colors = FilterChipDefaults.filterChipColors(containerColor = Color.White, selectedContainerColor = Brand.Navy, selectedLabelColor = Color.White),
                )
            }
        }
    }

    Spacer(Modifier.height(14.dp))
    Note(
        Icons.Rounded.Info,
        "Normal SMS charges apply on the SIM. Keep the app open until it finishes (about 3 seconds per donor). " +
            "If Android asks whether to allow sending many messages, choose “Always allow”.",
        Brand.GoldSoft,
    )
    Spacer(Modifier.height(14.dp))
    when {
        !PhoneSms.hasTelephony(context) -> Note(Icons.Rounded.Warning, "This device can't send SMS. Use a phone with the ministry SIM.", Color(0xFFFBE9E7))
        !canSend -> {
            if (asked) Note(Icons.Rounded.Warning, "The app needs permission to send SMS. Allow it, or turn it on in Settings → Apps → Omo Beeza Donors → Permissions.", Color(0xFFFBE9E7))
            Spacer(Modifier.height(10.dp))
            GoldButton("Allow sending SMS", { permissions.launch(arrayOf(Manifest.permission.SEND_SMS, Manifest.permission.READ_PHONE_STATE)) }, Modifier.fillMaxWidth())
        }
        else -> GoldButton(
            "Send $n SMS${if (sims.size > 1 && chosen != null) " · SIM ${chosen.label.substringAfter("SIM ").take(1)}" else ""}",
            { onSend(chosen?.id) },
            Modifier.fillMaxWidth(),
            icon = Icons.AutoMirrored.Rounded.Send,
        )
    }
}

@Composable
private fun Sending(run: SmsRun, onStop: () -> Unit) {
    val total = run.queue.size
    Title("Sending reminders…", "Keep the app open. ${run.done} of $total done.")
    LinearProgressIndicator(
        progress = { if (total == 0) 0f else run.done / total.toFloat() },
        modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(50)),
        color = Brand.Gold,
        trackColor = Brand.GoldSoft,
    )
    Spacer(Modifier.height(14.dp))
    if (run.current.isNotBlank()) Text("Now: ${run.current}", style = MaterialTheme.typography.titleSmall, color = Brand.Navy)
    Spacer(Modifier.height(4.dp))
    Text("${run.sent} sent · ${run.failed.size} not sent", style = MaterialTheme.typography.bodyMedium, color = Brand.Muted)
    Spacer(Modifier.height(18.dp))
    OutlinedButton(onClick = onStop, Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp)) { Text("Stop") }
}

@Composable
private fun Done(run: SmsRun, onClose: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(44.dp).clip(CircleShape).background(Brand.GreenSoft), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.CheckCircle, null, tint = Brand.Green)
        }
        Spacer(Modifier.size(12.dp))
        Text("${run.sent} reminder${if (run.sent == 1) "" else "s"} sent", style = MaterialTheme.typography.headlineSmall, color = Brand.Ink)
    }
    Spacer(Modifier.height(10.dp))
    run.stopped?.let { Note(Icons.Rounded.Warning, it, Brand.GoldSoft); Spacer(Modifier.height(10.dp)) }
    if (run.failed.isNotEmpty()) {
        Text("Not sent (${run.failed.size})", style = MaterialTheme.typography.titleSmall, color = Brand.Red)
        run.failed.take(8).forEach { (name, why) ->
            Text("$name — $why", style = MaterialTheme.typography.bodySmall, color = Brand.Body, modifier = Modifier.padding(vertical = 3.dp))
        }
        if (run.failed.size > 8) Text("and ${run.failed.size - 8} more", style = MaterialTheme.typography.bodySmall, color = Brand.Muted)
        HorizontalDivider(Modifier.padding(vertical = 10.dp), color = Brand.Line)
        Text("Anyone not sent stays on the list for next time.", style = MaterialTheme.typography.bodySmall, color = Brand.Muted)
    }
    Spacer(Modifier.height(16.dp))
    GoldButton("Done", onClose, Modifier.fillMaxWidth())
}

@Composable
private fun Note(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, bg: Color) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(bg).padding(14.dp), verticalAlignment = Alignment.Top) {
        Icon(icon, null, tint = Brand.Navy, modifier = Modifier.size(20.dp))
        Text(text, Modifier.padding(start = 10.dp), style = MaterialTheme.typography.bodySmall, color = Brand.Navy)
    }
}
