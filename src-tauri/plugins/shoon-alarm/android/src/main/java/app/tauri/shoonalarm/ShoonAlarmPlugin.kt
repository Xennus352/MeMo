package app.tauri.shoonalarm

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class ScheduleAlarmArgs {
    lateinit var title: String
    lateinit var body: String
    lateinit var text: String
    var unixMs: Long = 0L
    var wavPath: String? = null
}

@InvokeArg
class SpeakArgs {
    lateinit var text: String
}

@TauriPlugin
class ShoonAlarmPlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun scheduleAlarm(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(ScheduleAlarmArgs::class.java)
            if (args.text.isBlank()) {
                invoke.reject("Empty reminder text")
                return
            }
            val scheduled = ShoonAlarmScheduler.schedule(
                activity.applicationContext,
                args.title,
                args.body,
                args.text,
                args.unixMs,
                args.wavPath?.takeIf { it.isNotBlank() },
            )
            if (scheduled) {
                invoke.resolve()
            } else {
                invoke.reject("Reminder time already passed")
            }
        } catch (ex: Exception) {
            invoke.reject(ex.message ?: "Failed to schedule the Shoon alarm")
        }
    }

    @Command
    fun speakText(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SpeakArgs::class.java)
            if (args.text.isBlank()) {
                invoke.reject("Empty text")
                return
            }
            ShoonSpeaker.speak(activity.applicationContext, args.text, object : ShoonSpeaker.Listener {
                override fun onDone(ok: Boolean) {
                    if (ok) {
                        val result = app.tauri.plugin.JSObject()
                        result.put("spoken", true)
                        invoke.resolve(result)
                    } else {
                        invoke.reject("TTS could not speak")
                    }
                }
            })
        } catch (ex: Exception) {
            invoke.reject(ex.message ?: "Failed to speak the text")
        }
    }

    @Command
    fun openNotificationSettings(invoke: Invoke) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
            } else {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:${activity.packageName}"))
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
            invoke.resolve()
        } catch (ex: Exception) {
            invoke.reject(ex.message ?: "Failed to open notification settings")
        }
    }

    @Command
    fun cancelAll(invoke: Invoke) {
        ShoonAlarmScheduler.cancelAll(activity.applicationContext)
        invoke.resolve()
    }
}
