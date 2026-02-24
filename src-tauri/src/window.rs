// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use tauri::Manager;

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
