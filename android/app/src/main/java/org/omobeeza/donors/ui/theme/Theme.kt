package org.omobeeza.donors.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import org.omobeeza.donors.R

// Brand palette, shared with the website (src/app/globals.css).
object Brand {
    val Navy = Color(0xFF0B1F36)
    val Navy2 = Color(0xFF12304F)
    val Blue = Color(0xFF1E4A7C)
    val LogoBlue = Color(0xFF245CAB)
    val Sky = Color(0xFF99CCFF)
    val Gold = Color(0xFFD99A2B)
    val GoldLight = Color(0xFFF0C977)
    val GoldSoft = Color(0xFFFBF1DC)
    val Sand = Color(0xFFF7F3EC)
    val Ink = Color(0xFF132132)
    val Body = Color(0xFF44505F)
    val Muted = Color(0xFF6C7787)
    val Line = Color(0xFFE6E1D8)
    val Green = Color(0xFF1C7A43)
    val GreenSoft = Color(0xFFE5F4EA)
    val Red = Color(0xFFB42318)

    val NightSky = Brush.verticalGradient(listOf(Navy, Navy2, Blue))
    val GoldGlow = Brush.horizontalGradient(listOf(Gold, GoldLight))

    /** Avatar gradients, picked by donor id. */
    val Avatars = listOf(
        listOf(Color(0xFF245CAB), Color(0xFF5B8FD6)),
        listOf(Color(0xFFD99A2B), Color(0xFFF0C977)),
        listOf(Color(0xFF1C7A43), Color(0xFF5DB37E)),
        listOf(Color(0xFF8E3B5F), Color(0xFFD27A9B)),
        listOf(Color(0xFF5B4BA6), Color(0xFF9C8FE0)),
        listOf(Color(0xFFB4532A), Color(0xFFE79A6B)),
    )
}

val Fraunces = FontFamily(Font(R.font.fraunces_semibold, FontWeight.SemiBold))
val SourceSans = FontFamily(
    Font(R.font.source_sans_regular, FontWeight.Normal),
    Font(R.font.source_sans_semibold, FontWeight.SemiBold),
    Font(R.font.source_sans_bold, FontWeight.Bold),
)

private val AppTypography = Typography(
    displaySmall = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 34.sp, lineHeight = 40.sp),
    headlineMedium = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 28.sp, lineHeight = 34.sp),
    headlineSmall = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 23.sp, lineHeight = 29.sp),
    titleLarge = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = SourceSans, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontFamily = SourceSans, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = SourceSans, fontSize = 16.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontFamily = SourceSans, fontSize = 14.5.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = SourceSans, fontSize = 13.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = SourceSans, fontWeight = FontWeight.Bold, fontSize = 15.sp, letterSpacing = 0.2.sp),
    labelMedium = TextStyle(fontFamily = SourceSans, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp, letterSpacing = 0.3.sp),
    labelSmall = TextStyle(fontFamily = SourceSans, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.1.sp),
)

private val AppColors = lightColorScheme(
    primary = Brand.Blue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE3ECF8),
    onPrimaryContainer = Brand.Navy,
    secondary = Brand.Gold,
    onSecondary = Brand.Navy,
    secondaryContainer = Brand.GoldSoft,
    onSecondaryContainer = Brand.Navy,
    tertiary = Brand.Green,
    background = Brand.Sand,
    onBackground = Brand.Ink,
    surface = Color.White,
    onSurface = Brand.Ink,
    surfaceVariant = Color(0xFFF1EDE6),
    onSurfaceVariant = Brand.Muted,
    outline = Color(0xFFD5CFC4),
    outlineVariant = Brand.Line,
    error = Brand.Red,
)

@Composable
fun OmoTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = AppColors, typography = AppTypography, content = content)
}
