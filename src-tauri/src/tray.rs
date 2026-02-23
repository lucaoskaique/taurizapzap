// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use std::process;
use tauri::{
    menu::{Menu, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

#[derive(Clone, Copy)]
enum TrayIdentifier {
    Hide,
    Show,
    Quit,
    Unimplemented,
}

impl TrayIdentifier {
    fn as_str(&self) -> &'static str {
        match self {
            TrayIdentifier::Quit => "quit",
            TrayIdentifier::Unimplemented => "unimplemented",
            TrayIdentifier::Hide => "hide",
            TrayIdentifier::Show => "show",
        }
    }
}

impl Into<String> for TrayIdentifier {
    fn into(self) -> String {
        self.as_str().to_owned()
    }
}

impl From<String> for TrayIdentifier {
    fn from(val: String) -> Self {
        match val.as_str() {
            "show" => TrayIdentifier::Show,
            "hide" => TrayIdentifier::Hide,
            "quit" => TrayIdentifier::Quit,
            _ => TrayIdentifier::Unimplemented,
        }
    }
}

pub(crate) fn build_system_tray_menu(app: &AppHandle, is_hidden: bool) -> Menu<tauri::Wry> {
    log::debug!("Building system tray menu...");
    log::trace!("is hidden: {}", is_hidden);

    let menu = Menu::new(app).expect("Could not create menu");

    if is_hidden {
        let show_item = MenuItemBuilder::with_id(TrayIdentifier::Show.as_str(), "Show")
            .build(app)
            .expect("Could not create show item");
        menu.append(&show_item).expect("Could not append show item");
    } else {
        let hide_item = MenuItemBuilder::with_id(TrayIdentifier::Hide.as_str(), "Hide")
            .build(app)
            .expect("Could not create hide item");
        menu.append(&hide_item).expect("Could not append hide item");
    }

    let quit_item = MenuItemBuilder::with_id(TrayIdentifier::Quit.as_str(), "Quit")
        .build(app)
        .expect("Could not create quit item");
    menu.append(&quit_item).expect("Could not append quit item");

    menu
}

pub fn setup_system_tray(app: &AppHandle) {
    log::debug!("Setting up system tray...");
    let menu = build_system_tray_menu(app, false);
    TrayIconBuilder::with_id("main")
        .menu(&menu)
        .on_menu_event(move |app, event| {
            handle_tray_menu_event(app, event.id().as_ref());
        })
        .build(app)
        .expect("Could not create tray icon");
}

fn handle_tray_menu_event(app: &AppHandle, id: &str) {
    log::debug!("Handling tray menu event...");

    let main_window = app
        .get_webview_window("main")
        .expect("Could not get the main window.");

    let tray_ident = TrayIdentifier::from(id.to_string());

    match tray_ident {
        TrayIdentifier::Quit => {
            log::info!("Quitting app by system tray request...");
            process::exit(0);
        }
        TrayIdentifier::Unimplemented => {
            log::warn!("An unimplemented system tray event was dispatched.");
            log::warn!("event id: {}", id);
        }
        TrayIdentifier::Hide => {
            log::info!("Hiding app window by system tray request...");
            main_window.hide().expect("Could not hide the main window.");
            log::info!("Updating system tray menu...");
            let menu = build_system_tray_menu(app, true);
            app.tray_by_id("main")
                .expect("Could not get tray")
                .set_menu(Some(menu))
                .expect("Could not set menu");
        }
        TrayIdentifier::Show => {
            log::info!("Showing app window by system tray request...");
            main_window.show().expect("Could not show the main window.");
            log::info!("Updating system tray menu...");
            let menu = build_system_tray_menu(app, false);
            app.tray_by_id("main")
                .expect("Could not get tray")
                .set_menu(Some(menu))
                .expect("Could not set menu");
        }
    }
}
