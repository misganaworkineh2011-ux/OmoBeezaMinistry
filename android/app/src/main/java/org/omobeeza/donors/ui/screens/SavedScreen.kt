package org.omobeeza.donors.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random
import org.omobeeza.donors.data.Donor
import org.omobeeza.donors.data.birr
import org.omobeeza.donors.data.dayName
import org.omobeeza.donors.data.localPhone
import org.omobeeza.donors.ui.components.Avatar
import org.omobeeza.donors.ui.components.GoldButton
import org.omobeeza.donors.ui.components.Pill
import org.omobeeza.donors.ui.components.SectionLabel
import org.omobeeza.donors.ui.components.SoftCard
import org.omobeeza.donors.ui.theme.Brand

private data class Confetto(val angle: Float, val speed: Float, val size: Float, val color: Color, val spin: Float)

@Composable
fun SavedScreen(
    donor: Donor,
    created: Boolean,
    afroStep: Boolean,
    onAfro: () -> Unit,
    onAnother: () -> Unit,
    onDone: () -> Unit,
    /** False in screenshot tests: show the end of the celebration. */
    animate: Boolean = true,
) {
    val pop = remember { Animatable(if (animate) 0f else 1f) }
    val burst = remember { Animatable(if (animate) 0f else 0.35f) }
    val pieces = remember {
        val colors = listOf(Brand.Gold, Brand.GoldLight, Brand.Sky, Color.White, Brand.LogoBlue)
        List(42) { Confetto(Random.nextFloat() * 360f, 0.45f + Random.nextFloat() * 0.6f, 4f + Random.nextFloat() * 6f, colors.random(), Random.nextFloat() * 720f - 360f) }
    }
    LaunchedEffect(Unit) {
        if (!animate) return@LaunchedEffect
        pop.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow))
    }
    LaunchedEffect(Unit) {
        if (!animate) return@LaunchedEffect
        burst.animateTo(1f, tween(1800, easing = LinearEasing))
    }

    Column(
        Modifier.fillMaxSize().background(Brand.Sand).verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Celebration header.
        Box(Modifier.fillMaxWidth().height(300.dp).background(Brand.NightSky), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                val c = Offset(size.width / 2, size.height / 2 + 10.dp.toPx())
                val t = burst.value
                pieces.forEach { p ->
                    val r = (size.minDimension * 0.62f) * p.speed * t
                    val a = Math.toRadians(p.angle.toDouble())
                    val pos = Offset(c.x + (cos(a) * r).toFloat(), c.y + (sin(a) * r).toFloat() + 140f * t * t)
                    rotate(p.spin * t, pos) {
                        drawRect(p.color.copy(alpha = (1f - t).coerceIn(0f, 1f)), topLeft = pos, size = androidx.compose.ui.geometry.Size(p.size.dp.toPx(), p.size.dp.toPx() * 0.5f))
                    }
                }
                // Soft halo behind the check.
                drawCircle(Brand.Gold.copy(alpha = 0.18f), 84.dp.toPx() * pop.value, c)
                drawCircle(Brand.Gold.copy(alpha = 0.12f), 112.dp.toPx() * pop.value, c)
            }
            Column(Modifier.statusBarsPadding(), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier.padding(top = 20.dp).scale(pop.value).size(96.dp).clip(CircleShape).background(Brand.Gold),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Rounded.Check, null, tint = Brand.Navy, modifier = Modifier.size(56.dp))
                }
                Spacer(Modifier.height(18.dp))
                Text(if (created) "Donor saved!" else "Commitment updated!", style = MaterialTheme.typography.headlineMedium, color = Color.White)
                Text("Thank you for growing the family of givers.", style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.75f))
            }
        }

        Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp).padding(top = 18.dp).navigationBarsPadding()) {
            SoftCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar(donor.name, donor.id, 54.dp)
                    Column(Modifier.padding(start = 14.dp)) {
                        Text(donor.name, style = MaterialTheme.typography.titleLarge, color = Brand.Ink)
                        Text(localPhone(donor.phone), style = MaterialTheme.typography.bodyMedium, color = Brand.Muted)
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Pill("${birr(donor.amount)} birr weekly", Brand.GoldSoft, Brand.Navy)
                    Pill("Every ${dayName(donor.reminderDay)}", Color(0xFFEEF3FA), Brand.Blue)
                    Pill(if (donor.locale == "am") "አማርኛ SMS" else "English SMS", Color(0xFFEDEBE7), Brand.Body)
                }
            }

            if (afroStep && !donor.afroDone) {
                Spacer(Modifier.height(16.dp))
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(22.dp))
                        .background(Brand.GoldSoft)
                        .padding(18.dp),
                ) {
                    SectionLabel("Step 2 of 2")
                    Spacer(Modifier.height(6.dp))
                    Text("Add to AfroMessage contacts", style = MaterialTheme.typography.titleLarge, color = Brand.Navy)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "While your AfroMessage account is in beta, each number has to be added and verified there before reminders can reach it. The number is copied for you.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Brand.Body,
                    )
                    Spacer(Modifier.height(14.dp))
                    GoldButton("Open AfroMessage", onAfro, Modifier.fillMaxWidth(), icon = Icons.AutoMirrored.Rounded.Send)
                }
            }

            Spacer(Modifier.height(16.dp))
            OutlinedButton(onClick = onAnother, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp)) {
                Icon(Icons.Rounded.Add, null)
                Text("  Register another donor", style = MaterialTheme.typography.labelLarge)
            }
            TextButton(onClick = onDone, modifier = Modifier.fillMaxWidth()) {
                Text(if (afroStep && !donor.afroDone) "Skip for now · back to donors" else "Back to donors", color = Brand.Muted, textAlign = TextAlign.Center)
            }
            Spacer(Modifier.height(18.dp))
        }
    }
}
