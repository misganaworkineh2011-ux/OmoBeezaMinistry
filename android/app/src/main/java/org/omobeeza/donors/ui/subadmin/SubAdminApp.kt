package org.omobeeza.donors.ui.subadmin

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import org.omobeeza.donors.data.Donor
import org.omobeeza.donors.data.GivingSettings
import org.omobeeza.donors.data.Progress
import org.omobeeza.donors.data.User
import org.omobeeza.donors.data.birr
import org.omobeeza.donors.data.dayName
import org.omobeeza.donors.data.localPhone
import org.omobeeza.donors.data.payLink
import org.omobeeza.donors.data.prettyDate
import org.omobeeza.donors.ui.components.Avatar
import org.omobeeza.donors.ui.components.Emblem
import org.omobeeza.donors.ui.components.Pill
import org.omobeeza.donors.ui.components.SectionLabel
import org.omobeeza.donors.ui.components.SoftCard
import org.omobeeza.donors.ui.components.WaveHeader
import org.omobeeza.donors.ui.screens.DonorDetails
import org.omobeeza.donors.ui.screens.RegisterScreen
import org.omobeeza.donors.ui.screens.SavedScreen
import org.omobeeza.donors.ui.screens.SettingsScreen
import org.omobeeza.donors.ui.screens.SignInScreen
import org.omobeeza.donors.ui.theme.Brand
import org.omobeeza.donors.ui.theme.Fraunces

private fun depth(s: SubScreen): Int = when (s) {
    SubScreen.SignIn, SubScreen.Home -> 0
    SubScreen.Register, SubScreen.Settings -> 1
    is SubScreen.Saved -> 2
}

/** The whole Sub-admin app ("Omo Beeza Sub-admin"). */
@Composable
fun SubAdminApp(vm: SubAdminViewModel = viewModel()) {
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(vm.message) {
        vm.message?.let {
            snackbar.showSnackbar(it)
            vm.message = null
        }
    }
    BackHandler(enabled = vm.screen != SubScreen.Home && vm.screen != SubScreen.SignIn) { vm.back() }

    AnimatedContent(
        targetState = vm.screen,
        transitionSpec = {
            val forward = depth(targetState) >= depth(initialState)
            (slideInHorizontally { if (forward) it / 3 else -it / 3 } + fadeIn()) togetherWith
                (slideOutHorizontally { if (forward) -it / 4 else it / 4 } + fadeOut())
        },
        contentKey = { it::class },
        label = "screens",
    ) { screen ->
        when (screen) {
            SubScreen.SignIn -> SignInScreen(vm.prefs.site, vm.busy, vm.formError, subAdmin = true) { site, phone, password -> vm.signIn(site, phone, password) }

            SubScreen.Home -> SubHomeScreen(
                me = vm.me,
                settings = vm.settings,
                donors = vm.donors,
                loading = vm.loading,
                loaded = vm.loaded,
                snackbar = snackbar,
                onRefresh = vm::refresh,
                onRegister = { vm.go(SubScreen.Register) },
                onSettings = { vm.go(SubScreen.Settings) },
            )

            SubScreen.Register -> RegisterScreen(
                vm.settings, vm.busy, vm.formError,
                onBack = { vm.back() },
                onSave = vm::register,
                welcomeNote = "The ministry sends the weekly reminders. This donor counts toward your target.",
            )

            is SubScreen.Saved -> SavedScreen(
                donor = screen.donor,
                created = true,
                welcomeSms = null,
                payLink = vm.settings.payLink(screen.donor.amount),
                onAnother = { vm.go(SubScreen.Register) },
                onDone = { vm.go(SubScreen.Home) },
            )

            SubScreen.Settings -> SettingsScreen(
                user = User(vm.me.id, vm.me.name, localPhone(vm.me.phone)),
                site = vm.prefs.site,
                onBack = { vm.back() },
                onSignOut = vm::signOut,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubHomeScreen(
    me: Progress,
    settings: GivingSettings,
    donors: List<Donor>,
    loading: Boolean,
    loaded: Boolean,
    snackbar: SnackbarHostState,
    onRefresh: () -> Unit,
    onRegister: () -> Unit,
    onSettings: () -> Unit,
) {
    var selected by remember { mutableStateOf<Donor?>(null) }

    Scaffold(
        containerColor = Brand.Sand,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onRegister,
                containerColor = Brand.Gold,
                contentColor = Brand.Navy,
                shape = RoundedCornerShape(20.dp),
                icon = { Icon(Icons.Rounded.Add, null) },
                text = { Text("Register donor", style = MaterialTheme.typography.labelLarge) },
                modifier = Modifier.navigationBarsPadding(),
            )
        },
    ) { inner ->
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = inner.calculateBottomPadding() + 110.dp)) {
            item {
                WaveHeader(bottomPadding = 58.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Emblem(40.dp)
                        Column(Modifier.padding(start = 10.dp).weight(1f)) {
                            Text("Omo Beeza", style = MaterialTheme.typography.titleLarge, color = Color.White)
                            Text("DONOR REGISTRATION", style = MaterialTheme.typography.labelSmall, color = Brand.GoldLight)
                        }
                        IconButton(onClick = onRefresh) { Icon(Icons.Rounded.Refresh, "Refresh", tint = Color.White) }
                        IconButton(onClick = onSettings) { Icon(Icons.Rounded.Settings, "Settings", tint = Color.White) }
                    }
                    Spacer(Modifier.height(20.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ProgressRing(me)
                        Column(Modifier.padding(start = 18.dp).weight(1f)) {
                            Text("Selam, ${me.name.trim().substringBefore(' ').ifBlank { "friend" }}", style = MaterialTheme.typography.headlineSmall, color = Color.White)
                            Text(
                                when {
                                    me.target <= 0 -> "You have registered ${birr(me.registered)} donor${if (me.registered == 1) "" else "s"}."
                                    me.done -> "Target reached! Thank you. You can keep registering."
                                    else -> "${birr(me.left)} more to reach your target of ${birr(me.target)}."
                                },
                                style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.8f),
                            )
                            if (me.today > 0) {
                                Spacer(Modifier.height(6.dp))
                                Pill("+${me.today} today", Brand.Gold.copy(alpha = 0.25f), Brand.GoldLight)
                            }
                        }
                    }
                }
            }
            item {
                Column(Modifier.offset(y = (-14).dp).padding(horizontal = 18.dp)) {
                    if (loading) {
                        LinearProgressIndicator(Modifier.fillMaxWidth().clip(RoundedCornerShape(50)), color = Brand.Gold, trackColor = Brand.GoldSoft)
                        Spacer(Modifier.height(10.dp))
                    }
                    SectionLabel("Donors you registered")
                }
            }
            if (loaded && donors.isEmpty()) {
                item {
                    Column(Modifier.fillMaxWidth().padding(36.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No donors yet", style = MaterialTheme.typography.titleLarge, color = Brand.Ink)
                        Text("Tap “Register donor” to add the first one.", style = MaterialTheme.typography.bodyMedium, color = Brand.Muted, textAlign = TextAlign.Center)
                    }
                }
            }
            items(donors, key = { it.id }) { d ->
                SoftCard(Modifier.padding(horizontal = 18.dp, vertical = 5.dp).offset(y = (-20).dp).fillMaxWidth().clickable { selected = d }, padding = 14.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(d.name, d.id)
                        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                            Text(d.name, style = MaterialTheme.typography.titleMedium, color = Brand.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text("${localPhone(d.phone)} · ${prettyDate(d.createdAt)}", style = MaterialTheme.typography.bodyMedium, color = Brand.Muted)
                        }
                        Pill("${birr(d.amount)} · ${dayName(d.reminderDay).take(3)}", Brand.GoldSoft, Brand.Navy)
                    }
                }
            }
        }
    }

    selected?.let { d ->
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { selected = null }, sheetState = sheet, containerColor = Brand.Sand) {
            DonorDetails(d, settings.payLink(d.amount), full = false)
        }
    }
}

/** A gold ring filling up toward the target, with the count inside. */
@Composable
private fun ProgressRing(me: Progress) {
    Box(Modifier.size(104.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = 10.dp.toPx()
            val inset = stroke / 2
            val arc = Size(size.width - stroke, size.height - stroke)
            drawArc(Color.White.copy(alpha = 0.15f), 0f, 360f, false, Offset(inset, inset), arc, style = Stroke(stroke))
            val sweep = if (me.target > 0) 360f * me.fraction else 0f
            if (sweep > 0f) drawArc(if (me.done) Brand.GoldLight else Brand.Gold, -90f, sweep, false, Offset(inset, inset), arc, style = Stroke(stroke, cap = StrokeCap.Round))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(birr(me.registered), fontFamily = Fraunces, fontSize = 28.sp, color = Color.White)
            Text(if (me.target > 0) "of ${birr(me.target)}" else "donors", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.7f))
        }
    }
}

