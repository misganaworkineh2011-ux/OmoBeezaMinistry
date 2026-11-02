package org.omobeeza.donors.ui.screens

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.omobeeza.donors.data.Donor
import org.omobeeza.donors.data.localPhone
import org.omobeeza.donors.ui.components.GoldButton
import org.omobeeza.donors.ui.components.SectionLabel
import org.omobeeza.donors.ui.theme.Brand

/**
 * The guided AfroMessage step: AfroMessage's own website inside the app (you
 * stay signed in there), with the donor's number ready to paste and a short
 * checklist. AfroMessage has no API for contacts, so this is done by hand.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun AfroScreen(
    donor: Donor,
    afroUrl: String,
    busy: Boolean,
    onClose: () -> Unit,
    onDone: () -> Unit,
    onCopied: (String) -> Unit,
) {
    val clipboard = LocalClipboardManager.current
    var progress by remember { mutableIntStateOf(0) }
    var expanded by remember { mutableStateOf(true) }
    var web by remember { mutableStateOf<WebView?>(null) }
    val intl = donor.phone // +2519…
    val local = localPhone(donor.phone).replace(" ", "")

    LaunchedEffect(donor.id) {
        clipboard.setText(AnnotatedString(intl))
        onCopied(intl)
    }
    BackHandler {
        val w = web
        if (w != null && w.canGoBack()) w.goBack() else onClose()
    }
    DisposableEffect(Unit) {
        onDispose { CookieManager.getInstance().flush() }
    }

    Column(Modifier.fillMaxSize().background(Brand.Sand)) {
        Row(
            Modifier.fillMaxWidth().background(Brand.NightSky).statusBarsPadding().padding(horizontal = 6.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onClose) { Icon(Icons.Rounded.Close, "Close", tint = Color.White) }
            Column(Modifier.weight(1f)) {
                Text("AfroMessage contacts", style = MaterialTheme.typography.titleLarge, color = Color.White)
                Text("For ${donor.name}", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.7f))
            }
        }
        if (progress in 1..99) {
            LinearProgressIndicator(progress = { progress / 100f }, Modifier.fillMaxWidth().height(3.dp), color = Brand.Gold, trackColor = Color.Transparent)
        }

        Box(Modifier.weight(1f)) {
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.loadWithOverviewMode = true
                        settings.useWideViewPort = true
                        CookieManager.getInstance().setAcceptCookie(true)
                        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = false
                            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) { progress = 5 }
                            override fun onPageFinished(view: WebView, url: String?) { progress = 100 }
                        }
                        webChromeClient = object : android.webkit.WebChromeClient() {
                            override fun onProgressChanged(view: WebView, newProgress: Int) { progress = newProgress }
                        }
                        loadUrl(afroUrl)
                        web = this
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )
        }

        // Helper panel: number to paste, the three steps, and "done".
        Column(
            Modifier
                .fillMaxWidth()
                .shadow(16.dp, RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp))
                .clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp))
                .background(Color.White)
                .navigationBarsPadding()
                .padding(horizontal = 18.dp, vertical = 12.dp),
        ) {
            Row(Modifier.fillMaxWidth().clickable { expanded = !expanded }, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    SectionLabel("Number copied")
                    Text(localPhone(donor.phone), style = MaterialTheme.typography.headlineSmall, color = Brand.Ink)
                }
                Icon(if (expanded) Icons.Rounded.KeyboardArrowDown else Icons.Rounded.KeyboardArrowUp, if (expanded) "Hide steps" else "Show steps", tint = Brand.Muted)
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CopyChip(intl) { clipboard.setText(AnnotatedString(intl)); onCopied(intl) }
                CopyChip(local) { clipboard.setText(AnnotatedString(local)); onCopied(local) }
                CopyChip(donor.name) { clipboard.setText(AnnotatedString(donor.name)); onCopied(donor.name) }
            }
            AnimatedVisibility(expanded) {
                Column(Modifier.padding(top = 12.dp)) {
                    StepLine(1, "Sign in, then open Contacts and add a new contact.")
                    StepLine(2, "Paste the number (and the name), then save.")
                    StepLine(3, "Tap Verify on the contact and complete it.")
                }
            }
            Spacer(Modifier.height(12.dp))
            GoldButton("Done: added and verified", onDone, Modifier.fillMaxWidth(), icon = Icons.Rounded.CheckCircle, busy = busy)
        }
    }
}

@Composable
private fun CopyChip(text: String, onClick: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(50)).background(Color(0xFFEEF3FA)).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 7.dp),
    ) {
        Text("Copy $text", style = MaterialTheme.typography.labelMedium, color = Brand.Blue, maxLines = 1)
    }
}

@Composable
private fun StepLine(n: Int, text: String) {
    Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(24.dp).clip(CircleShape).background(Brand.Navy), contentAlignment = Alignment.Center) {
            Text("$n", style = MaterialTheme.typography.labelMedium, color = Color.White)
        }
        Text(text, Modifier.padding(start = 10.dp), style = MaterialTheme.typography.bodyMedium, color = Brand.Body)
    }
}
