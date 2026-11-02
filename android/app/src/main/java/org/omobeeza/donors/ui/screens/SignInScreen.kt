package org.omobeeza.donors.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import org.omobeeza.donors.ui.components.Emblem
import org.omobeeza.donors.ui.components.Field
import org.omobeeza.donors.ui.components.GoldButton
import org.omobeeza.donors.ui.components.SoftCard
import org.omobeeza.donors.ui.theme.Brand

@Composable
fun SignInScreen(
    site: String,
    busy: Boolean,
    error: String?,
    onSignIn: (site: String, email: String, password: String) -> Unit,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var address by rememberSaveable { mutableStateOf(site) }
    var showPassword by remember { mutableStateOf(false) }
    var advanced by rememberSaveable { mutableStateOf(false) }

    // The emblem breathes gently, like the sun over the Omo.
    val glow = rememberInfiniteTransition(label = "glow")
    val pulse by glow.animateFloat(1f, 1.08f, infiniteRepeatable(tween(2600, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "pulse")

    Box(Modifier.fillMaxSize().background(Brand.NightSky)) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            drawCircle(Brush.radialGradient(listOf(Brand.Gold.copy(alpha = 0.28f), Color.Transparent), Offset(w * 0.5f, h * 0.2f), w * 0.6f), w * 0.6f, Offset(w * 0.5f, h * 0.2f))
            listOf(0.08f to 0.07f, 0.9f to 0.1f, 0.05f to 0.4f, 0.95f to 0.36f, 0.62f to 0.03f, 0.94f to 0.58f, 0.04f to 0.62f).forEach { (x, y) ->
                drawCircle(Color.White.copy(alpha = 0.5f), 1.8.dp.toPx(), Offset(w * x, h * y))
            }
        }
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(48.dp))
            Box(Modifier.scale(pulse)) { Emblem(112.dp) }
            Spacer(Modifier.height(22.dp))
            Text("Omo Beeza", style = MaterialTheme.typography.displaySmall, color = Color.White)
            Text("WEEKLY DONORS", style = MaterialTheme.typography.labelSmall, color = Brand.GoldLight)
            Spacer(Modifier.height(10.dp))
            Text(
                "Register the people who give every week, right where you meet them.",
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.75f),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(30.dp))

            SoftCard(Modifier.fillMaxWidth(), padding = 22.dp) {
                Text("Sign in", style = MaterialTheme.typography.headlineSmall, color = Brand.Ink)
                Text("Use your Omo Beeza dashboard account.", style = MaterialTheme.typography.bodyMedium, color = Brand.Muted)
                Spacer(Modifier.height(16.dp))
                Field(email, { email = it }, "Email", Icons.Rounded.Email, keyboard = KeyboardType.Email)
                Spacer(Modifier.height(10.dp))
                Field(
                    password, { password = it }, "Password", Icons.Rounded.Lock,
                    keyboard = KeyboardType.Password,
                    visual = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    trailing = {
                        TextButton(onClick = { showPassword = !showPassword }) { Text(if (showPassword) "Hide" else "Show") }
                    },
                )
                AnimatedVisibility(advanced) {
                    Column {
                        Spacer(Modifier.height(10.dp))
                        Field(address, { address = it }, "Website address", Icons.Rounded.Home, keyboard = KeyboardType.Uri)
                    }
                }
                if (error != null) {
                    Spacer(Modifier.height(10.dp))
                    Text(error, color = Brand.Red, style = MaterialTheme.typography.bodyMedium)
                }
                Spacer(Modifier.height(18.dp))
                GoldButton("Sign in", { onSignIn(address, email, password) }, Modifier.fillMaxWidth(), busy = busy)
                TextButton(onClick = { advanced = !advanced }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                    Text(if (advanced) "Hide website address" else "Website: ${address.removePrefix("https://")}", color = Brand.Muted)
                }
            }
            Spacer(Modifier.height(28.dp))
            Text("“Let the little children come to me.” — Matthew 19:14", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.55f), textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
        }
    }
}
