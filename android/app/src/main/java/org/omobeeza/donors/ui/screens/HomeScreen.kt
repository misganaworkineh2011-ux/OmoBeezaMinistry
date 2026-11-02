package org.omobeeza.donors.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.DateRange
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.omobeeza.donors.R
import org.omobeeza.donors.data.Donor
import org.omobeeza.donors.data.Stats
import org.omobeeza.donors.data.User
import org.omobeeza.donors.data.birr
import org.omobeeza.donors.data.dayName
import org.omobeeza.donors.data.localPhone
import org.omobeeza.donors.data.prettyDate
import org.omobeeza.donors.ui.View
import org.omobeeza.donors.ui.components.Avatar
import org.omobeeza.donors.ui.components.Emblem
import org.omobeeza.donors.ui.components.GoldButton
import org.omobeeza.donors.ui.components.Pill
import org.omobeeza.donors.ui.components.SectionLabel
import org.omobeeza.donors.ui.components.SoftCard
import org.omobeeza.donors.ui.components.TelegramConnectCard
import org.omobeeza.donors.ui.components.WaveHeader
import org.omobeeza.donors.ui.theme.Brand

private fun greeting(): String = when (java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)) {
    in 5..11 -> "Good morning"
    in 12..17 -> "Good afternoon"
    else -> "Good evening"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    user: User?,
    stats: Stats,
    donors: List<Donor>,
    loading: Boolean,
    loaded: Boolean,
    query: String,
    view: View,
    afroStep: Boolean,
    snackbar: SnackbarHostState,
    onQuery: (String) -> Unit,
    onView: (View) -> Unit,
    onRefresh: () -> Unit,
    onRegister: () -> Unit,
    onSettings: () -> Unit,
    onAfro: (Donor) -> Unit,
    onUndoAfro: (Donor) -> Unit,
    onSms: () -> Unit = {},
) {
    var selected by remember { mutableStateOf<Donor?>(null) }

    Scaffold(
        containerColor = Brand.Sand,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onRegister,
                containerColor = Brand.Gold,
                contentColor = Brand.Navy,
                shape = RoundedCornerShape(20.dp),
                icon = { Icon(Icons.Rounded.Add, null) },
                text = { Text("Register donor", style = MaterialTheme.typography.labelLarge) },
                modifier = Modifier.navigationBarsPadding(),
            )
        },
    ) { inner ->
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = inner.calculateBottomPadding() + 110.dp),
        ) {
            item {
                WaveHeader(bottomPadding = 58.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Emblem(40.dp)
                        Column(Modifier.padding(start = 10.dp).weight(1f)) {
                            Text("Omo Beeza", style = MaterialTheme.typography.titleLarge, color = Color.White)
                            Text("WEEKLY DONORS", style = MaterialTheme.typography.labelSmall, color = Brand.GoldLight)
                        }
                        IconButton(onClick = onRefresh) { Icon(Icons.Rounded.Refresh, "Refresh", tint = Color.White) }
                        IconButton(onClick = onSettings) { Icon(Icons.Rounded.Settings, "Settings", tint = Color.White) }
                    }
                    Spacer(Modifier.height(22.dp))
                    Text("${greeting()},", style = MaterialTheme.typography.bodyLarge, color = Color.White.copy(alpha = 0.75f))
                    Text(user?.firstName?.ifBlank { null } ?: "friend", style = MaterialTheme.typography.headlineMedium, color = Color.White)
                    Spacer(Modifier.height(18.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatTile(birr(stats.active), "weekly donors", Modifier.weight(1f))
                        StatTile(birr(stats.weekly), "birr every week", Modifier.weight(1f), gold = true)
                        StatTile("${stats.paid7}/${stats.active}", "paid this week", Modifier.weight(1f))
                    }
                }
            }

            item {
                Column(Modifier.offset(y = (-26).dp).padding(horizontal = 18.dp)) {
                    OutlinedTextField(
                        value = query,
                        onValueChange = onQuery,
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Search name or phone", color = Brand.Muted) },
                        leadingIcon = { Icon(Icons.Rounded.Search, null, tint = Brand.Blue) },
                        trailingIcon = if (query.isNotEmpty()) ({ IconButton(onClick = { onQuery("") }) { Icon(Icons.Rounded.Clear, "Clear") } }) else null,
                        singleLine = true,
                        shape = RoundedCornerShape(50),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            unfocusedBorderColor = Color.Transparent,
                            focusedBorderColor = Brand.Blue,
                        ),
                    )
                    Spacer(Modifier.height(12.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(View.values().filter { afroStep || it != View.Afro }) { v ->
                            val count = if (v == View.Afro) stats.pendingAfro else null
                            FilterChip(
                                selected = view == v,
                                onClick = { onView(v) },
                                label = { Text(if (count != null && count > 0) "${v.label} · $count" else v.label) },
                                shape = RoundedCornerShape(50),
                                colors = FilterChipDefaults.filterChipColors(
                                    containerColor = Color.White,
                                    selectedContainerColor = Brand.Navy,
                                    selectedLabelColor = Color.White,
                                ),
                                border = FilterChipDefaults.filterChipBorder(enabled = true, selected = view == v, borderColor = Brand.Line),
                            )
                        }
                    }
                    if (loading) {
                        Spacer(Modifier.height(10.dp))
                        LinearProgressIndicator(Modifier.fillMaxWidth().clip(RoundedCornerShape(50)), color = Brand.Gold, trackColor = Brand.GoldSoft)
                    }
                    Spacer(Modifier.height(12.dp))
                    SmsBanner(onSms)
                    if (afroStep && stats.pendingAfro > 0 && view != View.Afro) {
                        Spacer(Modifier.height(12.dp))
                        AfroBanner(stats.pendingAfro) { onView(View.Afro) }
                    }
                }
            }

            if (loaded && donors.isEmpty()) {
                item { EmptyState(query.isNotBlank() || view != View.All) }
            }

            items(donors, key = { it.id }) { d ->
                DonorRow(d, afroStep, Modifier.padding(horizontal = 18.dp, vertical = 5.dp).offset(y = (-20).dp)) { selected = d }
            }
        }
    }

    selected?.let { d ->
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { selected = null }, sheetState = sheet, containerColor = Brand.Sand) {
            DonorDetails(
                d,
                afroStep,
                onAfro = { selected = null; onAfro(d) },
                onUndoAfro = { selected = null; onUndoAfro(d) },
            )
        }
    }
}

@Composable
private fun StatTile(value: String, label: String, modifier: Modifier = Modifier, gold: Boolean = false) {
    Column(
        modifier
            .clip(RoundedCornerShape(18.dp))
            .background(if (gold) Brand.Gold.copy(alpha = 0.22f) else Color.White.copy(alpha = 0.1f))
            .padding(horizontal = 12.dp, vertical = 12.dp),
    ) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = if (gold) Brand.GoldLight else Color.White, maxLines = 1)
        Text(label, style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.7f), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun SmsBanner(onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brand.Navy).clickable(onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(36.dp).clip(CircleShape).background(Brand.Gold), contentAlignment = Alignment.Center) {
            Icon(Icons.AutoMirrored.Rounded.Send, null, tint = Brand.Navy, modifier = Modifier.size(18.dp))
        }
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text("Send SMS reminders", style = MaterialTheme.typography.titleSmall, color = Color.White)
            Text("From this phone, to donors not reminded in 7 days", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.75f))
        }
        Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, null, tint = Brand.GoldLight)
    }
}

@Composable
private fun AfroBanner(count: Int, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brand.GoldSoft).clickable(onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(36.dp).clip(CircleShape).background(Brand.Gold), contentAlignment = Alignment.Center) {
            Icon(Icons.AutoMirrored.Rounded.Send, null, tint = Brand.Navy, modifier = Modifier.size(18.dp))
        }
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text("$count donor${if (count == 1) "" else "s"} need the AfroMessage step", style = MaterialTheme.typography.titleSmall, color = Brand.Navy)
            Text("Add and verify them so SMS reminders can reach them.", style = MaterialTheme.typography.bodySmall, color = Brand.Body)
        }
        Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, null, tint = Brand.Navy)
    }
}

@Composable
private fun DonorRow(d: Donor, afroStep: Boolean, modifier: Modifier, onClick: () -> Unit) {
    SoftCard(modifier.fillMaxWidth().clickable(onClick = onClick), padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(d.name, d.id)
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(d.name, style = MaterialTheme.typography.titleMedium, color = Brand.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(localPhone(d.phone), style = MaterialTheme.typography.bodyMedium, color = Brand.Muted)
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Pill("${birr(d.amount)} birr · ${dayName(d.reminderDay).take(3)}", Brand.GoldSoft, Brand.Navy)
                    if (d.status != "active") Pill(d.status, Color(0xFFEDEBE7), Brand.Muted)
                }
            }
            if (afroStep && d.status == "active") {
                if (d.afroDone) {
                    Icon(Icons.Rounded.CheckCircle, "Ready for SMS", tint = Brand.Green, modifier = Modifier.size(26.dp))
                } else {
                    Box(Modifier.size(12.dp).clip(CircleShape).background(Brand.Gold))
                }
            }
        }
    }
}

@Composable
private fun EmptyState(filtered: Boolean) {
    Column(Modifier.fillMaxWidth().padding(36.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Image(painterResource(R.drawable.emblem_white), null, Modifier.size(84.dp).clip(CircleShape).background(Brand.Blue.copy(alpha = 0.18f)).padding(12.dp).alpha(0.8f))
        Spacer(Modifier.height(16.dp))
        Text(if (filtered) "No donors match" else "No donors yet", style = MaterialTheme.typography.titleLarge, color = Brand.Ink)
        Text(
            if (filtered) "Try another search or filter." else "Tap “Register donor” to add the first weekly supporter.",
            style = MaterialTheme.typography.bodyMedium, color = Brand.Muted, textAlign = TextAlign.Center,
        )
    }
}

@Composable
internal fun DonorDetails(d: Donor, afroStep: Boolean, onAfro: () -> Unit, onUndoAfro: () -> Unit) {
    val context = LocalContext.current
    Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 28.dp).animateContentSize()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(d.name, d.id, 64.dp)
            Column(Modifier.padding(start = 14.dp).weight(1f)) {
                Text(d.name, style = MaterialTheme.typography.headlineSmall, color = Brand.Ink)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Pill(d.status, if (d.status == "active") Brand.GreenSoft else Color(0xFFEDEBE7), if (d.status == "active") Brand.Green else Brand.Muted)
                    if (d.source == "app") Pill("via the app", Color(0xFFE3ECF8), Brand.Blue)
                    if (d.source == "telegram") Pill("via Telegram", Color(0xFFE6F4FB), Color(0xFF1A7FB0))
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(onClick = { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${d.phone}"))) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(14.dp)) {
                Icon(Icons.Rounded.Call, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Call")
            }
            OutlinedButton(onClick = { context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:${d.phone}"))) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(14.dp)) {
                Icon(Icons.AutoMirrored.Rounded.Send, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Message")
            }
        }
        Spacer(Modifier.height(16.dp))
        SoftCard(Modifier.fillMaxWidth(), padding = 16.dp) {
            DetailLine(Icons.Rounded.Call, "Phone", localPhone(d.phone))
            DetailLine(Icons.Rounded.Favorite, "Weekly gift", "${birr(d.amount)} birr")
            DetailLine(Icons.Rounded.DateRange, "Reminder", "Every ${dayName(d.reminderDay)} · ${if (d.locale == "am") "Amharic SMS" else "English SMS"}")
            if (d.email.isNotBlank()) DetailLine(Icons.Rounded.Email, "Email", d.email)
            DetailLine(Icons.Rounded.CheckCircle, "Given so far", "${birr(d.total)} birr · last ${prettyDate(d.lastPaid)}")
            DetailLine(Icons.Rounded.Info, "Registered", prettyDate(d.createdAt), last = d.notes.isBlank())
            if (d.notes.isNotBlank()) DetailLine(Icons.Rounded.Info, "Notes", d.notes, last = true)
        }
        if (d.status == "active" && (d.telegramLinked || d.telegramLink.isNotBlank())) {
            Spacer(Modifier.height(16.dp))
            SectionLabel("Telegram")
            Spacer(Modifier.height(6.dp))
            TelegramConnectCard(d)
        }
        if (afroStep && d.status == "active") {
            Spacer(Modifier.height(16.dp))
            SectionLabel("AfroMessage")
            Spacer(Modifier.height(6.dp))
            if (d.afroDone) {
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Brand.GreenSoft).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.CheckCircle, null, tint = Brand.Green)
                    Text("Added and verified on ${prettyDate(d.afroContactAt)}", Modifier.weight(1f).padding(horizontal = 10.dp), color = Brand.Green, style = MaterialTheme.typography.titleSmall)
                    TextButton(onClick = onUndoAfro) { Text("Undo", color = Brand.Muted) }
                }
            } else {
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Brand.GoldSoft).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Warning, null, tint = Brand.Gold)
                    Text("Not in AfroMessage contacts yet, so SMS can't reach this number while the account is in beta.", Modifier.padding(start = 10.dp), color = Brand.Navy, style = MaterialTheme.typography.bodyMedium)
                }
                Spacer(Modifier.height(12.dp))
                GoldButton("Add to AfroMessage contacts", onAfro, Modifier.fillMaxWidth(), icon = Icons.AutoMirrored.Rounded.Send)
            }
        }
    }
}

@Composable
private fun DetailLine(icon: ImageVector, label: String, value: String, last: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(34.dp).clip(CircleShape).background(Color(0xFFEEF3FA)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = Brand.Blue, modifier = Modifier.size(17.dp))
        }
        Column(Modifier.padding(start = 12.dp)) {
            Text(label, style = MaterialTheme.typography.bodySmall, color = Brand.Muted)
            Text(value, style = MaterialTheme.typography.titleSmall, color = Brand.Ink, fontWeight = FontWeight.SemiBold)
        }
    }
    if (!last) HorizontalDivider(color = Brand.Line)
}
