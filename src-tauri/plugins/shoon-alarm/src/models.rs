use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShoonAlarmRequest {
    /// Notification title — also used for the service's foreground notification.
    pub title: String,
    /// Tray/log body.
    pub body: String,
    /// The text Shoon speaks (Burmese).
    pub text: String,
    /// Absolute fire time in unix milliseconds.
    pub unix_ms: i64,
    /// Absolute path to a cached Shoon WAV (app cache dir); when absent the device TTS speaks the text.
    pub wav_path: Option<String>,
}
