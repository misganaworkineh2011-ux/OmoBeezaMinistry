package org.omobeeza.donors.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ExitToApp
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import org.omobeeza.donors.BuildConfig
import org.omobeeza.donors.data.User
import org.omobeeza.donors.ui.components.Avatar
import org.omobeeza.donors.ui.components.Field
import org.omobeeza.donors.ui.components.SectionLabel
import org.omobeeza.donors.ui.components.SoftCard
import org.omobeeza.donors.ui.components.WaveHeader
import org.omobeeza.donors.ui.theme.Brand

@Composable
fun SettingsScreen(
    user: User?,
    site: String,
    onBack: () -> Unit,
    onSignOut: () -> Unit,
) {
    Column(Modifier.fillMaxSize().background(Brand.Sand).verticalScroll(rememberScrollState())) {
        WaveHeader(bottomPadding = 40.dp) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White) }
                Text("Settings", style = MaterialTheme.typography.headlineSmall, color = Color.White)
            }
        }
        Column(Modifier.padding(horizontal = 18.dp).navigationBarsPadding()) {
            SectionLabel("Account")
            Spacer(Modifier.height(8.dp))
            SoftCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar(user?.name.orEmpty(), user?.id ?: 0, 50.dp)
                    Column(Modifier.padding(start = 12.dp)) {
                        Text(user?.name.orEmpty(), style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
                        Text(user?.email.orEmpty(), style = MaterialTheme.typography.bodyMedium, color = Brand.Muted)
                    }
                }
                Spacer(Modifier.height(12.dp))
                HorizontalDivider(color = Brand.Line)
                Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Home, null, tint = Brand.Blue)
                    Text(site.removePrefix("https://"), Modifier.padding(start = 10.dp), style = MaterialTheme.typography.bodyMedium, color = Brand.Body)
                }
            }

            Spacer(Modifier.height(24.dp))
            OutlinedButton(
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Brand.Red),
            ) {
                Icon(Icons.AutoMirrored.Rounded.ExitToApp, null)
                Text("  Sign out", style = MaterialTheme.typography.labelLarge)
            }
            Spacer(Modifier.height(16.dp))
            Text("${if (BuildConfig.SUB_ADMIN) "Omo Beeza Sub-admin" else "Omo Beeza Admin"} · version ${BuildConfig.VERSION_NAME}", Modifier.fillMaxWidth().padding(bottom = 24.dp), style = MaterialTheme.typography.bodySmall, color = Brand.Muted)
        }
    }
}
