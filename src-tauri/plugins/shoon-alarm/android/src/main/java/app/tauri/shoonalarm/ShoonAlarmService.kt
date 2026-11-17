package app.tauri.shoonalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.os.Handler
import androidx.core.app.NotificationCompat
import java.io.File
import java.util.Locale

/**
 * Foreground service that speaks one reminder aloud.
 *
 * Prefers the cached Shoon WAV (generated with the Nara server while the app
 * was open). When it isn't there — Nara unreachable or voice not pre-cached —
 * it falls back to the device's own TTS speaking Myanmar, so the reminder is
 * always spoken, never silent.
 *
 * Started by [ShoonAlarmReceiver] at the scheduled time; stops itself when
 * the speech finishes or anything goes wrong.
 */
class ShoonAlarmService : Service() {

    private var tts: TextToSpeech? = null
    private var player: MediaPlayer? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val title = intent?.getStringExtra("title") ?: getString(applicationInfo.labelRes)
        val text = intent?.getStringExtra("text").orEmpty()
        val wavPath = intent?.getStringExtra("wavPath").orEmpty()

        startInForeground(title)
        speak(text, wavPath, startId)
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startInForeground(title: String) {
        ensureChannel()
        val notification = buildNotification(title)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun speak(text: String, wavPath: String, startId: Int) {
        if (wavPath.isNotEmpty() && File(wavPath).isFile) {
            playWav(wavPath, startId)
        } else {
            speakWithTts(text, startId)
        }
    }

    private fun playWav(path: String, startId: Int) {
        val file = File(path)
        if (!file.isFile) {
            stopEverything(startId)
            return
        }
        try {
            player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build(),
                )
                setDataSource(file.absolutePath)
                setOnPreparedListener { it.start() }
                setOnCompletionListener {
                    release()
                    player = null
                    stopEverything(startId)
                }
                setOnErrorListener { _, _, _ ->
                    stopEverything(startId)
                    true
                }
                prepareAsync()
            }
        } catch (e: Exception) {
            stopEverything(startId)
        }
    }

    private fun speakWithTts(text: String, startId: Int) {
        tts = TextToSpeech(this) { status ->
            if (status != TextToSpeech.SUCCESS) {
                stopEverything(startId)
                return@TextToSpeech
            }
            val engine = tts ?: run {
                stopEverything(startId)
                return@TextToSpeech
            }
            val myanmar = Locale("my", "MM")
            engine.language = when {
                engine.isLanguageAvailable(myanmar) >= TextToSpeech.LANG_AVAILABLE -> myanmar
                engine.isLanguageAvailable(Locale.ENGLISH) >= TextToSpeech.LANG_AVAILABLE -> Locale.ENGLISH
                else -> engine.language // leave the engine's default if nothing matches
            }
            engine.setSpeechRate(0.92f)
            val utteranceId = "shoon-alarm-$startId"
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
            // TextToSpeech completion callbacks are unreliable across engines — shut down on a generous timer
            handler.postDelayed(
                { stopEverything(startId) },
                (text.length.toLong() * 220L).coerceIn(6_000L, 30_000L),
            )
        }
    }

    private fun stopEverything(startId: Int) {
        runCatching { player?.release() }
        player = null
        runCatching { tts?.stop() }
        runCatching { tts?.shutdown() }
        tts = null
        handler.removeCallbacksAndMessages(null)
        stopSelf(startId)
    }

    override fun onDestroy() {
        runCatching { player?.release() }
        player = null
        runCatching { tts?.stop() }
        runCatching { tts?.shutdown() }
        tts = null
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    // ---- Foreground notification (keeps Android from killing the speech) ----

    private fun ensureChannel() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "MeMo 💕 Reminders",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Shoon speaks scheduled reminders"
            setSound(null, null)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(title: String): Notification {
        val smallIcon = applicationInfo.icon
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText("Shoon is speaking…")
            .setSmallIcon(smallIcon)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    private companion object {
        const val CHANNEL_ID = "shoon-alarm"
        const val NOTIFICATION_ID = 42121
    }
}
