package org.omobeeza.donors.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.omobeeza.donors.data.Donor
import org.omobeeza.donors.data.birr
import org.omobeeza.donors.ui.theme.Brand

/** The donor's payment link for their weekly amount (the ministry's address, forwarding to Ye-Buna), to open or share. */
@Composable
fun PayLinkCard(donor: Donor, link: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    SoftCard(modifier.fillMaxWidth(), padding = 16.dp) {
        Row {
            Icon(Icons.Rounded.Favorite, null, tint = Brand.Gold, modifier = Modifier.size(20.dp))
            Text("  Payment link · ${birr(donor.amount)} birr", style = MaterialTheme.typography.titleSmall, color = Brand.Navy)
        }
        Spacer(Modifier.height(6.dp))
        Text(link.removePrefix("https://"), style = MaterialTheme.typography.bodyMedium, color = Brand.Blue, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = {
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "Give your weekly ${birr(donor.amount)} birr to Omo Beeza: $link")
                    }
                    context.startActivity(Intent.createChooser(send, "Share the payment link"))
                },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(14.dp),
            ) {
                Icon(Icons.Rounded.Share, null, Modifier.size(18.dp))
                Text("  Share")
            }
            OutlinedButton(
                onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(14.dp),
            ) { Text("Open") }
        }
    }
}
