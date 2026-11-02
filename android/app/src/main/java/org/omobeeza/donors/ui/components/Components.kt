package org.omobeeza.donors.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import org.omobeeza.donors.R
import org.omobeeza.donors.data.initials
import org.omobeeza.donors.ui.theme.Brand

/**
 * Night-sky header with the gold sun and a sand-coloured wave at the bottom,
 * echoing the website's hero. Content sits above the wave.
 */
@Composable
fun WaveHeader(
    modifier: Modifier = Modifier,
    waveColor: Color = Brand.Sand,
    bottomPadding: Dp = 44.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(modifier.fillMaxWidth().clipToBounds().background(Brand.NightSky)) {
        Canvas(Modifier.matchParentSize()) {
            val w = size.width
            val h = size.height
            // Gold sun with a soft glow, low on the right (clear of the top-bar icons).
            val r = minOf(w * 0.065f, h * 0.17f)
            val sun = Offset(w * 0.88f, h * 0.36f)
            drawCircle(Brush.radialGradient(listOf(Brand.Gold.copy(alpha = 0.32f), Color.Transparent), sun, r * 4f), r * 4f, sun)
            drawCircle(Brand.Gold.copy(alpha = 0.9f), r, sun)
            // A few stars, kept to the right where there's no text.
            listOf(0.58f to 0.12f, 0.7f to 0.26f, 0.96f to 0.1f, 0.66f to 0.5f, 0.97f to 0.62f).forEach { (x, y) ->
                drawCircle(Color.White.copy(alpha = 0.55f), 1.6.dp.toPx(), Offset(w * x, h * y))
            }
            // Dotted gold line riding above the wave.
            val dotted = Path().apply {
                moveTo(0f, h - 30.dp.toPx())
                cubicTo(w * 0.3f, h - 52.dp.toPx(), w * 0.62f, h - 8.dp.toPx(), w, h - 34.dp.toPx())
            }
            drawPath(dotted, Brand.Gold.copy(alpha = 0.8f), style = Stroke(1.6.dp.toPx(), cap = StrokeCap.Round, pathEffect = PathEffect.dashPathEffect(floatArrayOf(2f, 9f))))
            // The wave itself.
            val wave = Path().apply {
                moveTo(0f, h - 18.dp.toPx())
                cubicTo(w * 0.28f, h - 40.dp.toPx(), w * 0.6f, h + 4.dp.toPx(), w, h - 24.dp.toPx())
                lineTo(w, h)
                lineTo(0f, h)
                close()
            }
            drawPath(wave, waveColor)
        }
        Column(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = bottomPadding), content = content)
    }
}

@Composable
fun Emblem(size: Dp, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(Brand.LogoBlue, Brand.Blue)))
            .border(1.5.dp, Color.White.copy(alpha = 0.25f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Image(painterResource(R.drawable.emblem_white), contentDescription = "Omo Beeza", Modifier.size(size * 0.78f))
    }
}

@Composable
fun Avatar(name: String, seed: Int, size: Dp = 46.dp) {
    val colors = Brand.Avatars[Math.floorMod(seed, Brand.Avatars.size)]
    Box(
        Modifier.size(size).clip(CircleShape).background(Brush.linearGradient(colors)),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials(name), color = Color.White, fontWeight = FontWeight.Bold, fontSize = (size.value * 0.36f).sp)
    }
}

@Composable
fun Pill(text: String, bg: Color, fg: Color, icon: ImageVector? = null, modifier: Modifier = Modifier) {
    Row(
        modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 9.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (icon != null) Icon(icon, null, tint = fg, modifier = Modifier.size(13.dp))
        Text(text, color = fg, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
fun GoldButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    busy: Boolean = false,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !busy,
        modifier = modifier.height(56.dp).shadow(if (enabled) 10.dp else 0.dp, RoundedCornerShape(18.dp), ambientColor = Brand.Gold, spotColor = Brand.Gold),
        shape = RoundedCornerShape(18.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Brand.Gold, contentColor = Brand.Navy, disabledContainerColor = Brand.Gold.copy(alpha = 0.45f), disabledContentColor = Brand.Navy.copy(alpha = 0.6f)),
        contentPadding = PaddingValues(horizontal = 20.dp),
    ) {
        if (busy) {
            CircularProgressIndicator(Modifier.size(22.dp), color = Brand.Navy, strokeWidth = 2.5.dp)
        } else {
            if (icon != null) {
                Icon(icon, null, Modifier.size(20.dp))
                Text("  ")
            }
            Text(text, style = MaterialTheme.typography.labelLarge.copy(fontSize = 16.sp), textAlign = TextAlign.Center)
        }
    }
}

@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text.uppercase(),
        modifier = modifier,
        style = MaterialTheme.typography.labelSmall,
        color = Brand.Gold,
    )
}

/** White rounded card with a soft shadow. */
@Composable
fun SoftCard(modifier: Modifier = Modifier, padding: Dp = 18.dp, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .shadow(6.dp, RoundedCornerShape(22.dp), ambientColor = Brand.Navy.copy(alpha = 0.12f), spotColor = Brand.Navy.copy(alpha = 0.12f))
            .clip(RoundedCornerShape(22.dp))
            .background(Color.White)
            .padding(padding),
        content = content,
    )
}

@Composable
fun Field(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    error: String? = null,
    placeholder: String? = null,
    keyboard: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    minLines: Int = 1,
    visual: VisualTransformation = VisualTransformation.None,
    trailing: @Composable (() -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = modifier.fillMaxWidth(),
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it, color = Brand.Muted.copy(alpha = 0.7f)) } },
        leadingIcon = { Icon(icon, null, tint = if (error != null) Brand.Red else Brand.Blue) },
        trailingIcon = trailing,
        isError = error != null,
        supportingText = error?.let { { Text(it) } },
        singleLine = singleLine,
        minLines = minLines,
        visualTransformation = visual,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Brand.Blue,
            unfocusedBorderColor = Brand.Line,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
            focusedLabelColor = Brand.Blue,
        ),
    )
}

/** Gentle full-screen backdrop used behind forms. */
@Composable
fun SandBackground(content: @Composable BoxScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(Brand.Sand), content = content)
}
