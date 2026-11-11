package org.omobeeza.donors.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.omobeeza.donors.data.Donor
import org.omobeeza.donors.data.SubAdmin
import org.omobeeza.donors.data.SubAdminInput
import org.omobeeza.donors.data.birr
import org.omobeeza.donors.data.localPhone
import org.omobeeza.donors.data.normalizePhone
import org.omobeeza.donors.data.prettyDate
import org.omobeeza.donors.ui.components.Avatar
import org.omobeeza.donors.ui.components.Field
import org.omobeeza.donors.ui.components.GoldButton
import org.omobeeza.donors.ui.components.Pill
import org.omobeeza.donors.ui.components.SectionLabel
import org.omobeeza.donors.ui.components.SoftCard
import org.omobeeza.donors.ui.components.WaveHeader
import org.omobeeza.donors.ui.theme.Brand

/** What the editor sheet is showing: a new sub-admin, or an existing one. */
sealed interface SubAdminEdit {
    data object New : SubAdminEdit
    data class Existing(val sub: SubAdmin) : SubAdminEdit
}

/**
 * Admin app → Sub-admins: the people who only register donors (in the
 * "Omo Beeza Sub-admin" app), each with the number of donors they are asked to
 * register, and how far they are.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubAdminsScreen(
    subs: List<SubAdmin>,
    loading: Boolean,
    busy: Boolean,
    error: String?,
    snackbar: SnackbarHostState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onSave: (id: Int?, input: SubAdminInput, done: () -> Unit) -> Unit,
    onRemove: (SubAdmin, done: () -> Unit) -> Unit,
    loadDonors: suspend (Int) -> List<Donor>,
    onClearError: () -> Unit = {},
) {
    var editing by remember { mutableStateOf<SubAdminEdit?>(null) }
    val active = subs.filter { it.active }
    val registered = active.sumOf { it.registered }
    val target = active.sumOf { it.target }

    Scaffold(
        containerColor = Brand.Sand,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { onClearError(); editing = SubAdminEdit.New },
                containerColor = Brand.Gold,
                contentColor = Brand.Navy,
                shape = RoundedCornerShape(20.dp),
                icon = { Icon(Icons.Rounded.Add, null) },
                text = { Text("Add sub-admin", style = MaterialTheme.typography.labelLarge) },
                modifier = Modifier.navigationBarsPadding(),
            )
        },
    ) { inner ->
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = inner.calculateBottomPadding() + 110.dp)) {
            item {
                WaveHeader(bottomPadding = 40.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White) }
                        Column(Modifier.padding(start = 4.dp).weight(1f)) {
                            Text("Sub-admins", style = MaterialTheme.typography.headlineSmall, color = Color.White)
                            Text("People who register donors for you", style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.7f))
                        }
                        IconButton(onClick = onRefresh) { Icon(Icons.Rounded.Refresh, "Refresh", tint = Color.White) }
                    }
                    if (active.isNotEmpty()) {
                        Spacer(Modifier.height(16.dp))
                        Text(
                            "${birr(registered)} of ${birr(target)} donors registered by ${active.size} sub-admin${if (active.size == 1) "" else "s"}",
                            style = MaterialTheme.typography.bodyMedium, color = Brand.GoldLight,
                        )
                        Spacer(Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { if (target == 0) 0f else (registered.toFloat() / target).coerceIn(0f, 1f) },
                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50)),
                            color = Brand.Gold, trackColor = Color.White.copy(alpha = 0.15f),
                        )
                    }
                }
            }
            if (loading) {
                item { LinearProgressIndicator(Modifier.fillMaxWidth().padding(horizontal = 18.dp).clip(RoundedCornerShape(50)), color = Brand.Gold, trackColor = Brand.GoldSoft) }
            }
            if (!loading && subs.isEmpty()) {
                item {
                    Column(Modifier.fillMaxWidth().padding(36.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No sub-admins yet", style = MaterialTheme.typography.titleLarge, color = Brand.Ink)
                        Text(
                            "Tap “Add sub-admin”, give them a phone number, a password and how many donors to register. They sign in to the Omo Beeza Sub-admin app with that phone number and password.",
                            style = MaterialTheme.typography.bodyMedium, color = Brand.Muted, textAlign = TextAlign.Center,
                        )
                    }
                }
            }
            items(subs, key = { it.id }) { s ->
                SubAdminRow(s, Modifier.padding(horizontal = 18.dp, vertical = 5.dp)) { onClearError(); editing = SubAdminEdit.Existing(s) }
            }
        }
    }

    editing?.let { edit ->
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        // Show the latest copy after a save (pause, new target, …).
        val current = (edit as? SubAdminEdit.Existing)?.let { e -> subs.firstOrNull { it.id == e.sub.id } ?: e.sub }
        ModalBottomSheet(onDismissRequest = { editing = null }, sheetState = sheet, containerColor = Brand.Sand) {
            SubAdminEditor(
                sub = current,
                busy = busy,
                error = error,
                onSave = { input -> onSave(current?.id, input) { editing = null } },
                onPause = { s -> onSave(s.id, SubAdminInput(status = if (s.active) "paused" else "active")) {} },
                onRemove = { s -> onRemove(s) { editing = null } },
                loadDonors = loadDonors,
            )
        }
    }
}

@Composable
private fun SubAdminRow(s: SubAdmin, modifier: Modifier, onClick: () -> Unit) {
    SoftCard(modifier.fillMaxWidth().clickable(onClick = onClick), padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(s.name, s.id)
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(s.name, style = MaterialTheme.typography.titleMedium, color = Brand.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(localPhone(s.phone), style = MaterialTheme.typography.bodyMedium, color = Brand.Muted)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    if (s.target > 0) "${birr(s.registered)} / ${birr(s.target)}" else birr(s.registered),
                    style = MaterialTheme.typography.titleMedium,
                    color = if (s.target > 0 && s.registered >= s.target) Brand.Green else Brand.Navy,
                )
                Text("donors", style = MaterialTheme.typography.bodySmall, color = Brand.Muted)
            }
        }
        Spacer(Modifier.height(10.dp))
        LinearProgressIndicator(
            progress = { if (s.target == 0) 0f else (s.registered.toFloat() / s.target).coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(50)),
            color = if (s.target > 0 && s.registered >= s.target) Brand.Green else Brand.Gold,
            trackColor = Brand.GoldSoft,
        )
        if (!s.active || (s.target > 0 && s.registered >= s.target)) {
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (!s.active) Pill("paused", Color(0xFFEDEBE7), Brand.Muted)
                if (s.target > 0 && s.registered >= s.target) Pill("target reached", Brand.GreenSoft, Brand.Green)
            }
        }
    }
}

@Composable
internal fun SubAdminEditor(
    sub: SubAdmin?,
    busy: Boolean,
    error: String?,
    onSave: (SubAdminInput) -> Unit,
    onPause: (SubAdmin) -> Unit,
    onRemove: (SubAdmin) -> Unit,
    loadDonors: suspend (Int) -> List<Donor>,
) {
    var name by rememberSaveable(sub?.id) { mutableStateOf(sub?.name.orEmpty()) }
    var phone by rememberSaveable(sub?.id) { mutableStateOf(sub?.phone?.let(::localPhone).orEmpty()) }
    var password by rememberSaveable(sub?.id) { mutableStateOf("") }
    var target by rememberSaveable(sub?.id) { mutableStateOf(sub?.target?.toString() ?: "") }
    var showPassword by remember { mutableStateOf(false) }
    var tried by remember { mutableStateOf(false) }
    var confirmRemove by remember { mutableStateOf(false) }
    var donors by remember(sub?.id) { mutableStateOf<List<Donor>?>(null) }
    var showDonors by remember(sub?.id) { mutableStateOf(false) }

    LaunchedEffect(showDonors, sub?.id) {
        if (showDonors && sub != null && donors == null) donors = runCatching { loadDonors(sub.id) }.getOrDefault(emptyList())
    }

    val nameError = if (tried && name.isBlank()) "Enter their name." else null
    val phoneError = if (tried && normalizePhone(phone) == null) "Enter a valid Ethiopian mobile number (09… or 07…)." else null
    val passwordError = if (tried && (if (sub == null) password.length < 8 else password.isNotEmpty() && password.length < 8)) "At least 8 characters." else null
    val targetError = if (tried && target.toIntOrNull() == null) "How many donors should they register?" else null

    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 22.dp).padding(bottom = 28.dp),
    ) {
        Text(if (sub == null) "Add a sub-admin" else sub.name, style = MaterialTheme.typography.headlineSmall, color = Brand.Ink)
        Text(
            if (sub == null) "They sign in to the Omo Beeza Sub-admin app with this phone number and password, and can only register donors."
            else "Registered ${birr(sub.registered)}${if (sub.target > 0) " of ${birr(sub.target)}" else ""} donors · last ${prettyDate(sub.lastRegistered)} · signed in ${prettyDate(sub.lastLogin)}",
            style = MaterialTheme.typography.bodyMedium, color = Brand.Muted,
        )
        Spacer(Modifier.height(16.dp))
        Field(name, { name = it.take(80) }, "Full name", Icons.Rounded.Person, error = nameError)
        Spacer(Modifier.height(8.dp))
        Field(phone, { v -> phone = v.filter { it.isDigit() || it in "+ -" }.take(18) }, "Phone number (to sign in)", Icons.Rounded.Call, placeholder = "09… or 07…", keyboard = KeyboardType.Phone, error = phoneError)
        Spacer(Modifier.height(8.dp))
        Field(
            password, { password = it.take(100) }, if (sub == null) "Password" else "New password (leave empty to keep)", Icons.Rounded.Lock,
            keyboard = KeyboardType.Password, error = passwordError,
            placeholder = "At least 8 characters",
            visual = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            trailing = { TextButton(onClick = { showPassword = !showPassword }) { Text(if (showPassword) "Hide" else "Show") } },
        )
        Spacer(Modifier.height(8.dp))
        Field(target, { v -> target = v.filter { it.isDigit() }.take(6) }, "Donors to register", Icons.Rounded.Favorite, keyboard = KeyboardType.Number, placeholder = "e.g. 20", error = targetError)
        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(error, color = Brand.Red, style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(14.dp))
        GoldButton(
            if (sub == null) "Add sub-admin" else "Save changes",
            onClick = {
                tried = true
                val ok = name.isNotBlank() && normalizePhone(phone) != null && target.toIntOrNull() != null &&
                    (if (sub == null) password.length >= 8 else password.isEmpty() || password.length >= 8)
                if (ok) onSave(
                    SubAdminInput(
                        name = name.trim(),
                        phone = normalizePhone(phone),
                        password = password.ifEmpty { null },
                        target = target.toInt(),
                    ),
                )
            },
            modifier = Modifier.fillMaxWidth(),
            icon = Icons.Rounded.Check,
            busy = busy,
        )

        if (sub != null) {
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = { onPause(sub) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(14.dp), enabled = !busy) {
                    Text(if (sub.active) "Pause" else "Turn back on")
                }
                OutlinedButton(
                    onClick = { confirmRemove = true },
                    modifier = Modifier.weight(1f), shape = RoundedCornerShape(14.dp), enabled = !busy,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Brand.Red),
                ) { Text("Remove") }
            }
            Text(
                if (sub.active) "Pausing signs them out and stops them registering until you turn them back on."
                else "Paused: they can't sign in or register donors.",
                Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodySmall, color = Brand.Muted,
            )

            Spacer(Modifier.height(18.dp))
            SectionLabel("Donors they registered")
            Spacer(Modifier.height(6.dp))
            if (!showDonors) {
                TextButton(onClick = { showDonors = true }) { Text("Show their ${birr(sub.registered)} donors") }
            } else {
                val list = donors
                when {
                    list == null -> LinearProgressIndicator(Modifier.fillMaxWidth().clip(RoundedCornerShape(50)), color = Brand.Gold, trackColor = Brand.GoldSoft)
                    list.isEmpty() -> Text("None yet.", style = MaterialTheme.typography.bodyMedium, color = Brand.Muted)
                    else -> SoftCard(Modifier.fillMaxWidth(), padding = 12.dp) {
                        list.forEachIndexed { i, d ->
                            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(d.name, style = MaterialTheme.typography.titleSmall, color = Brand.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("${localPhone(d.phone)} · ${prettyDate(d.createdAt)}", style = MaterialTheme.typography.bodySmall, color = Brand.Muted)
                                }
                                Text("${birr(d.amount)} birr", style = MaterialTheme.typography.titleSmall, color = Brand.Navy)
                            }
                            if (i < list.lastIndex) HorizontalDivider(color = Brand.Line)
                        }
                    }
                }
            }
        }
    }

    if (confirmRemove && sub != null) {
        AlertDialog(
            onDismissRequest = { confirmRemove = false },
            title = { Text("Remove ${sub.name}?") },
            text = { Text("They can no longer sign in. The ${birr(sub.registered)} donors they registered stay in the donor list.") },
            confirmButton = {
                TextButton(onClick = { confirmRemove = false; onRemove(sub) }) { Text("Remove", color = Brand.Red) }
            },
            dismissButton = { TextButton(onClick = { confirmRemove = false }) { Text("Cancel") } },
        )
    }
}
