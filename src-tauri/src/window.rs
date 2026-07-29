// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use tauri::webview::DownloadEvent;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Create the main WhatsApp window.
///
/// Built in Rust (instead of via `tauri.conf.json`) so we can attach two
/// behaviors that are only available on the window builder:
///
/// 1. `disable_drag_drop_handler` — lets native file drag & drop reach
///    WhatsApp Web's own HTML5 handlers (drop image/doc onto a chat to send).
///    With Tauri's OS-level handler enabled, drops are swallowed before the
///    webview sees them.
/// 2. `on_download` — prompts the user for a save location on every download
///    instead of silently dropping files into the Downloads folder.
pub fn create_main_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    log::debug!("Creating main window...");

    WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("WhatsApp")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        // Let WhatsApp Web receive native drag & drop of files.
        .disable_drag_drop_handler()
        // Ask where to save on every download.
        .on_download(|_webview, event| match event {
            DownloadEvent::Requested { url, destination } => {
                let default_name = destination
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| "download".to_string());

                log::info!("Download requested ({}); prompting for location...", url);

                let mut dialog = rfd::FileDialog::new().set_file_name(&default_name);
                if let Some(dir) = dirs::download_dir() {
                    dialog = dialog.set_directory(dir);
                }

                match dialog.save_file() {
                    Some(path) => {
                        log::info!("Saving download to {:?}", path);
                        *destination = path;
                        true // proceed with the download
                    }
                    None => {
                        log::info!("Download cancelled by user");
                        false // abort the download
                    }
                }
            }
            DownloadEvent::Finished { url, path, success } => {
                log::info!(
                    "Download finished (success={}): {} -> {:?}",
                    success,
                    url,
                    path
                );
                true
            }
            _ => true,
        })
        .build()?;

    log::info!("Main window created");
    Ok(())
}

pub fn setup_window_handlers(app: &tauri::AppHandle) {
    log::debug!("Setting up window event handlers...");

    if let Some(window) = app.get_webview_window("main") {
        let window_clone = window.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                log::info!("Close requested, hiding window instead...");
                api.prevent_close();
                let _ = window_clone.hide();
            }
        });
    }
}
