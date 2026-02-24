// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use app::{logging, tray, window};

fn main() {
    logging::setup_logger().expect("Could not set up loggers.");
    log::info!("Launching app...");
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Setup system tray
            tray::setup_tray(app.handle()).expect("Failed to setup system tray");

            // Setup window event handlers
            window::setup_window_handlers(app.handle());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
