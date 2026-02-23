// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use crate::tray;
use tauri::Manager;

pub fn handle_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    log::debug!("Handling window event...");

    match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();

            let is_visible = match window.is_visible() {
                Ok(visible) => !visible,
                Err(err) => {
                    log::error!("An error occurred while getting the window's visibility property. Setting it to visible...");
                    log::error!("Window visibility property access error: {}", err);
                    false
                }
            };

            let menu = tray::build_system_tray_menu(&window.app_handle(), is_visible);
            window
                .app_handle()
                .tray_by_id("main")
                .expect("Could not get tray")
                .set_menu(Some(menu))
                .expect("Could not set system tray menu.");

            window.hide().expect("Could not hide the main window.");
        }
        _ => {}
    }
}
