package org.omobeeza.donors.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import org.omobeeza.donors.ui.theme.Brand

/**
 * "Target reached — register more?": quick +5 / +10, or any number (1–500).
 * Used by the Sub-admin app (they extend their own target) and the Admin app
 * (extending a sub-admin's target).
 */
@Composable
fun ExtendTargetCard(
    title: String,
    text: String,
    busy: Boolean,
    modifier: Modifier = Modifier,
    onAdd: (Int) -> Unit,
) {
    var other by rememberSaveable { mutableStateOf("") }
    val n = other.toIntOrNull()
    SoftCard(modifier.fillMaxWidth(), padding = 16.dp) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
        Text(text, style = MaterialTheme.typography.bodyMedium, color = Brand.Muted)
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            listOf(5, 10).forEach { add ->
                OutlinedButton(onClick = { onAdd(add) }, enabled = !busy, shape = RoundedCornerShape(14.dp), modifier = Modifier.weight(1f)) {
                    Text("+$add", style = MaterialTheme.typography.titleMedium, color = Brand.Navy)
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        Field(
            other, { v -> other = v.filter { it.isDigit() }.take(3) }, "Other number", Icons.Rounded.Favorite,
            keyboard = KeyboardType.Number, placeholder = "e.g. 15",
            error = if (other.isNotEmpty() && (n == null || n !in 1..500)) "1–500" else null,
        )
        Spacer(Modifier.height(10.dp))
        GoldButton(
            if (n != null && n in 1..500) "Add $n more" else "Add more",
            onClick = { if (n != null && n in 1..500) { onAdd(n); other = "" } },
            modifier = Modifier.fillMaxWidth(),
            icon = Icons.Rounded.Add,
            busy = busy,
            enabled = n != null && n in 1..500,
        )
    }
}
