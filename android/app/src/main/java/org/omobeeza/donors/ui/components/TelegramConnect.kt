package org.omobeeza.donors.ui.components

import android.content.Intent
import android.graphics.Bitmap
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import org.omobeeza.donors.data.Donor
import org.omobeeza.donors.ui.theme.Brand

/** Telegram's brand blue, for the connect card. */
val TelegramBlue = Color(0xFF229ED9)

/** A crisp QR code for [text] (one pixel per module, scaled up without blurring). */
@Composable
fun QrCode(text: String, size: Dp, modifier: Modifier = Modifier) {
    val bitmap = remember(text) {
        val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, mapOf(EncodeHintType.MARGIN to 1))
        Bitmap.createBitmap(matrix.width, matrix.height, Bitmap.Config.ARGB_8888).apply {
            for (x in 0 until matrix.width) for (y in 0 until matrix.height) {
                setPixel(x, y, if (matrix[x, y]) 0xFF0B1F36.toInt() else 0xFFFFFFFF.toInt())
            }
        }.asImageBitmap()
    }
    Image(bitmap, contentDescription = "QR code", modifier = modifier.size(size), filterQuality = FilterQuality.None)
}

/**
 * "Get reminders on Telegram": the donor scans the QR code with their own
 * phone (or gets the link shared to them) and taps Start on the bot.
 */
@Composable
fun TelegramConnectCard(donor: Donor, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    if (donor.telegramLinked) {
        Row(
            modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFFE6F4FB)).padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Rounded.CheckCircle, null, tint = TelegramBlue)
            Text(
                "Connected on Telegram${if (donor.telegramUsername.isNotBlank()) " (@${donor.telegramUsername})" else ""}: weekly reminders go there.",
                Modifier.padding(start = 10.dp),
                color = Brand.Navy,
                style = MaterialTheme.typography.titleSmall,
            )
        }
        return
    }
    if (donor.telegramLink.isBlank()) return

    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Color(0xFFE6F4FB)).padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(34.dp).clip(RoundedCornerShape(50)).background(TelegramBlue), contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Rounded.Send, null, tint = Color.White, modifier = Modifier.size(18.dp))
            }
            Column(Modifier.padding(start = 10.dp)) {
                Text("Reminders on Telegram", style = MaterialTheme.typography.titleLarge, color = Brand.Navy)
                Text("Optional · free for the donor", style = MaterialTheme.typography.bodySmall, color = Brand.Muted)
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.clip(RoundedCornerShape(14.dp)).background(Color.White).padding(8.dp)) {
                QrCode(donor.telegramLink, 132.dp)
            }
            Spacer(Modifier.width(14.dp))
            Text(
                "Ask the donor to scan this with their phone camera and tap Start in Telegram. Their weekly reminders will then arrive there.",
                style = MaterialTheme.typography.bodyMedium,
                color = Brand.Body,
            )
        }
        Spacer(Modifier.height(12.dp))
        // Only share: opening the link on this phone would connect *your*
        // Telegram account to the donor.
        OutlinedButton(
            onClick = {
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, "Get your Omo Beeza weekly giving reminders on Telegram: ${donor.telegramLink}")
                }
                context.startActivity(Intent.createChooser(send, "Send the Telegram link"))
            },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(Icons.Rounded.Share, null, Modifier.size(18.dp))
            Text("  Share the link with the donor")
        }
    }
}
