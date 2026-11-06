package org.omobeeza.donors.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Create
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Face
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.omobeeza.donors.data.DAYS_AM
import org.omobeeza.donors.data.DAYS_EN
import org.omobeeza.donors.data.GivingSettings
import org.omobeeza.donors.data.NewDonor
import org.omobeeza.donors.data.payLink
import org.omobeeza.donors.data.birr
import org.omobeeza.donors.data.normalizePhone
import org.omobeeza.donors.data.normalizeTelegram
import androidx.compose.material.icons.automirrored.rounded.Send
import org.omobeeza.donors.ui.components.Field
import org.omobeeza.donors.ui.components.GoldButton
import org.omobeeza.donors.ui.components.SectionLabel
import org.omobeeza.donors.ui.components.SoftCard
import org.omobeeza.donors.ui.components.WaveHeader
import org.omobeeza.donors.ui.theme.Brand
import org.omobeeza.donors.ui.theme.Fraunces

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RegisterScreen(
    settings: GivingSettings,
    busy: Boolean,
    serverError: String?,
    onBack: () -> Unit,
    onSave: (NewDonor) -> Unit,
) {
    var amount by rememberSaveable { mutableIntStateOf(settings.amounts.getOrElse(1) { settings.amounts.firstOrNull() ?: 100 }) }
    var custom by rememberSaveable { mutableStateOf("") }
    var day by rememberSaveable { mutableIntStateOf(settings.defaultDay) }
    var locale by rememberSaveable { mutableStateOf("en") }
    var name by rememberSaveable { mutableStateOf("") }
    var nickname by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    var telegram by rememberSaveable { mutableStateOf("") }
    var consent by rememberSaveable { mutableStateOf(false) }
    var tried by rememberSaveable { mutableStateOf(false) }

    val weekly = custom.toIntOrNull() ?: amount
    val nameError = if (tried && name.isBlank()) "Enter the donor's name." else null
    val phoneError = if (tried && normalizePhone(phone) == null) "Enter a valid Ethiopian mobile number (09… or 07…)." else null
    val emailError = if (tried && email.isNotBlank() && !Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(email.trim())) "Enter a valid email, or leave it empty." else null
    val telegramError = if (tried && telegram.isNotBlank() && normalizeTelegram(telegram) == null) "Like @abebe_k: 5–32 letters, numbers or _." else null
    val amountError = if (tried && weekly < settings.minAmount) "At least ${settings.minAmount} birr." else null
    val consentError = tried && !consent

    Column(Modifier.fillMaxSize().background(Brand.Sand)) {
        WaveHeader(bottomPadding = 40.dp) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White) }
                Column(Modifier.padding(start = 4.dp)) {
                    Text("New weekly donor", style = MaterialTheme.typography.headlineSmall, color = Color.White)
                    Text("Weekly giving in birr", style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.7f))
                }
            }
        }

        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 18.dp),
        ) {
            SectionLabel("Weekly gift")
            Spacer(Modifier.height(10.dp))
            // Suggested amounts in a row that scrolls sideways.
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(end = 24.dp)) {
                items(settings.amounts) { a ->
                    AmountTile(a, selected = custom.isEmpty() && amount == a, modifier = Modifier.width(96.dp)) {
                        amount = a
                        custom = ""
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Field(custom, { v -> custom = v.filter { it.isDigit() }.take(7) }, "Other amount (birr)", Icons.Rounded.Favorite, keyboard = KeyboardType.Number, error = amountError)
            settings.payLink(weekly).takeIf { it.isNotBlank() }?.let { link ->
                Text(
                    "Pays on Ye-Buna: ${link.removePrefix("https://")}",
                    Modifier.padding(start = 6.dp, top = 6.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = Brand.Muted,
                )
            }

            Spacer(Modifier.height(18.dp))
            SectionLabel("Remind every")
            Spacer(Modifier.height(10.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DAYS_EN.forEachIndexed { i, d ->
                    DayChip(if (locale == "am") DAYS_AM[i] else d.take(3), day == i) { day = i }
                }
            }

            Spacer(Modifier.height(18.dp))
            SectionLabel("Message language")
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LangOption("English", "Hi Abebe, your weekly…", locale == "en", Modifier.weight(1f)) { locale = "en" }
                LangOption("አማርኛ", "ሰላም አበበ፣ የዚህ ሳምንት…", locale == "am", Modifier.weight(1f)) { locale = "am" }
            }

            Spacer(Modifier.height(20.dp))
            SectionLabel("Donor")
            Spacer(Modifier.height(10.dp))
            Field(name, { name = it }, "Full name", Icons.Rounded.Person, error = nameError)
            Spacer(Modifier.height(8.dp))
            Field(
                nickname, { nickname = it.take(40) }, "Nickname (optional)", Icons.Rounded.Face,
                placeholder = "What the reminders call them, e.g. Abe",
            )
            Spacer(Modifier.height(8.dp))
            Field(phone, { v -> phone = v.filter { it.isDigit() || it in "+ -" }.take(18) }, "Mobile number", Icons.Rounded.Call, placeholder = "09… or 07…", keyboard = KeyboardType.Phone, error = phoneError)
            Spacer(Modifier.height(8.dp))
            Field(email, { email = it }, "Email (optional)", Icons.Rounded.Email, keyboard = KeyboardType.Email, error = emailError)
            Spacer(Modifier.height(8.dp))
            Field(
                telegram, { telegram = it.trim().take(40) }, "Telegram username (optional)", Icons.AutoMirrored.Rounded.Send,
                placeholder = "@username", keyboard = KeyboardType.Email, error = telegramError,
            )
            Spacer(Modifier.height(8.dp))
            Field(notes, { notes = it }, "Notes (optional)", Icons.Rounded.Create, singleLine = false, minLines = 2, placeholder = "Church, how you met, …")

            Spacer(Modifier.height(14.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(if (consentError) Color(0xFFFDECEC) else Color.White)
                    .border(1.dp, if (consentError) Brand.Red.copy(alpha = 0.4f) else Brand.Line, RoundedCornerShape(16.dp))
                    .clickable { consent = !consent }
                    .padding(horizontal = 6.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(consent, { consent = it }, colors = CheckboxDefaults.colors(checkedColor = Brand.Blue))
                Text("The donor agreed to receive a weekly SMS reminder (they can stop at any time).", style = MaterialTheme.typography.bodyMedium, color = Brand.Ink)
            }

            Spacer(Modifier.height(16.dp))
            SoftCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                Text(
                    buildAnnotatedString {
                        withStyle(SpanStyle(color = Brand.Muted)) { append(if (name.isBlank()) "This donor" else name.trim().substringBefore(' ')) }
                        append(" will give ")
                        withStyle(SpanStyle(color = Brand.Gold, fontWeight = FontWeight.Bold)) { append("${birr(weekly)} birr") }
                        append(" every ")
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(if (locale == "am") DAYS_AM[day] else DAYS_EN[day]) }
                        append(".")
                    },
                    fontFamily = Fraunces,
                    fontSize = 19.sp,
                    lineHeight = 26.sp,
                    color = Brand.Ink,
                )
                Text("A welcome SMS is sent from this phone when you save (if turned on in the dashboard).", style = MaterialTheme.typography.bodySmall, color = Brand.Muted)
            }
            if (serverError != null) {
                Spacer(Modifier.height(12.dp))
                Text(serverError, color = Brand.Red, style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(Modifier.height(18.dp))
        }

        Box(Modifier.fillMaxWidth().background(Brand.Sand).navigationBarsPadding().padding(horizontal = 18.dp, vertical = 12.dp)) {
            GoldButton(
                "Save donor",
                onClick = {
                    tried = true
                    val ok = name.isNotBlank() && normalizePhone(phone) != null && weekly >= settings.minAmount && consent &&
                        (email.isBlank() || Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(email.trim())) &&
                        (telegram.isBlank() || normalizeTelegram(telegram) != null)
                    if (ok) onSave(NewDonor(name.trim(), nickname.trim(), phone, email.trim(), weekly, day, locale, notes.trim(), telegram.trim()))
                },
                modifier = Modifier.fillMaxWidth(),
                icon = Icons.Rounded.Check,
                busy = busy,
            )
        }
    }
}

@Composable
private fun AmountTile(amount: Int, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val bg by animateColorAsState(if (selected) Brand.Navy else Color.White, label = "bg")
    val fg by animateColorAsState(if (selected) Color.White else Brand.Ink, label = "fg")
    Column(
        modifier
            .clip(RoundedCornerShape(18.dp))
            .background(bg)
            .border(1.5.dp, if (selected) Brand.Navy else Brand.Line, RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(birr(amount), fontFamily = Fraunces, fontSize = 24.sp, color = fg)
        Text("birr", style = MaterialTheme.typography.labelMedium, color = if (selected) Brand.GoldLight else Brand.Muted)
    }
}

@Composable
private fun DayChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val bg by animateColorAsState(if (selected) Brand.Gold else Color.White, label = "day")
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(bg)
            .border(1.dp, if (selected) Brand.Gold else Brand.Line, RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
    ) {
        Text(label, style = MaterialTheme.typography.titleSmall, color = if (selected) Brand.Navy else Brand.Body)
    }
}

@Composable
private fun LangOption(title: String, sample: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier
            .clip(RoundedCornerShape(18.dp))
            .background(if (selected) Color(0xFFEEF3FA) else Color.White)
            .border(1.5.dp, if (selected) Brand.Blue else Brand.Line, RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = Brand.Ink, modifier = Modifier.weight(1f))
            Box(
                Modifier.size(20.dp).clip(CircleShape).background(if (selected) Brand.Blue else Color.Transparent).border(1.5.dp, if (selected) Brand.Blue else Brand.Line, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                if (selected) Icon(Icons.Rounded.Check, null, tint = Color.White, modifier = Modifier.size(13.dp))
            }
        }
        Spacer(Modifier.width(4.dp))
        Text(sample, style = MaterialTheme.typography.bodySmall, color = Brand.Muted, maxLines = 1)
    }
}
