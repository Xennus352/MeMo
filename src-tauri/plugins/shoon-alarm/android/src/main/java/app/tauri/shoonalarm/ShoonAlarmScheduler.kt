package app.tauri.shoonalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject

/**
 * Schedules exact alarms that wake MeMo and speak the reminder.
 *
 * Alarms are pushed far enough ahead to survive Doze and are kept in
 * SharedPreferences so [ShoonBootReceiver] can re-arm them after a reboot.
 */
object ShoonAlarmScheduler {
    const val ACTION_FIRE = "app.tauri.shoonalarm.FIRE"
    private const val PREFS = "shoon_alarms"
    private const val KEY_ALARMS = "alarms_json"

    /** Register (or re-arm) one alarm. Returns false when the fire time already passed. */
    fun schedule(
        context: Context,
        title: String,
        body: String,
        text: String,
        unixMs: Long,
        wavPath: String?,
    ): Boolean {
        if (unixMs <= System.currentTimeMillis()) return false
        val entry = encode(title, body, text, unixMs, wavPath)

        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val existing = runCatching { JSONArray(prefs.getString(KEY_ALARMS, "[]")) }.getOrElse { JSONArray() }
        // De-duplicate identical reminders (same text + instant)
        val key = payloadKey(text, unixMs)
        val out = JSONArray()
        for (i in 0 until existing.length()) {
            val e = existing.getJSONObject(i)
            if (payloadKey(e.getString("text"), e.getLong("unixMs")) != key) out.put(e)
        }
        out.put(entry)
        prefs.edit().putString(KEY_ALARMS, out.toString()).apply()

        setAlarm(context, entry)
        return true
    }

    fun cancelAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val existing = runCatching { JSONArray(prefs.getString(KEY_ALARMS, "[]")) }.getOrElse { JSONArray() }
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (i in 0 until existing.length()) {
            val e = existing.getJSONObject(i)
            val intent = Intent(ACTION_FIRE).setPackage(context.packageName)
            val requestKey = requestKey(e.getString("text"), e.getLong("unixMs"))
            val pending = PendingIntent.getBroadcast(
                context,
                requestKey,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
            ) ?: continue
            alarm.cancel(pending)
        }
        prefs.edit().clear().apply()
    }

    /** Re-arm every alarm still in the future — called after BOOT_COMPLETED. */
    fun restoreFutureAlarms(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val existing = runCatching { JSONArray(prefs.getString(KEY_ALARMS, "[]")) }.getOrElse { return }
        val now = System.currentTimeMillis()
        for (i in 0 until existing.length()) {
            val e = existing.getJSONObject(i)
            if (e.getLong("unixMs") > now) setAlarm(context, e)
        }
    }

    private fun encode(title: String, body: String, text: String, unixMs: Long, wavPath: String?): JSONObject =
        JSONObject().apply {
            put("title", title)
            put("body", body)
            put("text", text)
            put("unixMs", unixMs)
            put("wavPath", wavPath ?: "")
        }

    private fun payloadKey(text: String, unixMs: Long) = "${text.hashCode()}:$unixMs"

    private fun requestKey(text: String, unixMs: Long): Int = payloadKey(text, unixMs).hashCode() and 0x7fffffff

    private fun setAlarm(context: Context, entry: JSONObject) {
        val unixMs = entry.getLong("unixMs")
        val intent = Intent(ACTION_FIRE).apply {
            putExtra("title", entry.getString("title"))
            putExtra("body", entry.getString("body"))
            putExtra("text", entry.getString("text"))
            putExtra("wavPath", entry.optString("wavPath", ""))
            setPackage(context.packageName)
        }
        val requestKey = requestKey(entry.getString("text"), unixMs)
        val pending = PendingIntent.getBroadcast(
            context,
            requestKey,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        try {
            alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, unixMs, pending)
        } catch (security: SecurityException) {
            // Exact-alarm special access not granted — degrade gracefully rather than crash
            alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, unixMs, pending)
        }
    }
}
