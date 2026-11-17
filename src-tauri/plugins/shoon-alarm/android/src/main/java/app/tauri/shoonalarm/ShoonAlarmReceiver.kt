package app.tauri.shoonalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * Fires the speaking service when one of our exact alarms goes off.
 */
class ShoonAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ShoonAlarmScheduler.ACTION_FIRE) return
        val serviceIntent = Intent(context, ShoonAlarmService::class.java).apply {
            intent.extras?.let { putExtras(it) }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}

/**
 * Re-arms every still-future Shoon alarm after a reboot — AlarmManager
 * alarms die with the device, so without this the phone never speaks again
 * until the app happens to be opened.
 */
class ShoonBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON" -> ShoonAlarmScheduler.restoreFutureAlarms(context)
        }
    }
}
