use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::Result;
use crate::ShoonAlarmExt;

#[command(rename_all = "camelCase")]
pub(crate) async fn schedule_shoon_alarm<R: Runtime>(
    app: AppHandle<R>,
    title: String,
    body: String,
    text: String,
    unix_ms: i64,
    wav_path: Option<String>,
) -> Result<()> {
    app.shoon_alarm().schedule_alarm(ShoonAlarmRequest {
        title,
        body,
        text,
        unix_ms,
        wav_path,
    })
}

#[command(rename_all = "camelCase")]
pub(crate) async fn speak_text<R: Runtime>(app: AppHandle<R>, text: String) -> Result<()> {
    app.shoon_alarm().speak_text(&text)
}

#[command(rename_all = "camelCase")]
pub(crate) async fn open_notification_settings<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.shoon_alarm().open_notification_settings()
}

#[command(rename_all = "camelCase")]
pub(crate) async fn cancel_all_shoon_alarms<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.shoon_alarm().cancel_all()
}
