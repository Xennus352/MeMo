package app.tauri.shoonalarm

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * One-shot text-to-speech used as the in-app voice when the app is on the phone
 * (the desktop Shoon server isn't reachable from there). Speaks Myanmar when the
 * device has it, otherwise the engine's own default — but it always says something.
 */
object ShoonSpeaker {

    interface Listener {
        fun onDone(ok: Boolean)
    }

    private var engine: TextToSpeech? = null
    private var ready = false
    private val pending = mutableListOf<Pair<String, Listener>>()

    @Synchronized
    fun speak(context: Context, text: String, listener: Listener) {
        if (text.isBlank()) {
            listener.onDone(false)
            return
        }
        val instance = context.applicationContext
        if (engine == null) {
            engine = TextToSpeech(instance) { status ->
                ready = status == TextToSpeech.SUCCESS
                val copy = pending.toList()
                pending.clear()
                for ((t, l) in copy) {
                    if (ready) doSpeak(t, l) else l.onDone(false)
                }
            }
        }
        if (ready) {
            doSpeak(text, listener)
        } else {
            pending += text to listener
        }
    }

    private fun doSpeak(text: String, listener: Listener) {
        val tts = engine ?: return listener.onDone(false)
        // Keep utterances short enough for the app's Burmese notification lines
        val clamped = if (text.length > 400) text.substring(0, 400) else text
        val my = Locale("my", "MM")
        tts.language = when {
            tts.isLanguageAvailable(my) >= TextToSpeech.LANG_AVAILABLE -> my
            tts.isLanguageAvailable(Locale.ENGLISH) >= TextToSpeech.LANG_AVAILABLE -> Locale.ENGLISH
            else -> tts.language // leave engine default
        }
        tts.setSpeechRate(0.92f)
        tts.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        val utteranceId = "shoon-inapp-${System.currentTimeMillis()}"
        tts.setOnUtteranceProgressListener(object : android.speech.tts.UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) {
                listener.onDone(true)
            }
            override fun onError(utteranceId: String?) {
                listener.onDone(false)
            }
            override fun onError(utteranceId: String?, errorCode: Int) {
                listener.onDone(false)
            }
        })
        tts.speak(clamped, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        // TTS completion is unreliable on some engines — close the door on a timer
        Handler(Looper.getMainLooper()).postDelayed(
            { listener.onDone(true) },
            (clamped.length.toLong() * 220L).coerceIn(4_000L, 25_000L),
        )
    }
}
