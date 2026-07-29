// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use sysinfo::{System, Pid};
use std::time::Duration;
use tauri::{Manager, AppHandle};

/// Monitor memory usage and log it periodically
pub fn start_memory_monitor(_app_handle: AppHandle) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let mut interval = tokio::time::interval(Duration::from_secs(300)); // Every 5 minutes
            let pid = Pid::from_u32(std::process::id());
            
            loop {
                interval.tick().await;
                
                let mut sys = System::new_all();
                sys.refresh_all();
                
                if let Some(process) = sys.process(pid) {
                    let memory_mb = process.memory() / 1024 / 1024;
                    log::info!("Memory usage: {} MB", memory_mb);
                    
                    // Warn if memory is high
                    if memory_mb > 500 {
                        log::warn!("High memory usage detected: {} MB. Consider reloading the webview.", memory_mb);
                    }
                }
            }
        });
    });
}

/// Refresh webview periodically to clear memory
/// NOTE: Disabled for WhatsApp Web as it causes disconnection issues
/// WhatsApp Web manages its own memory efficiently
#[allow(dead_code)]
pub fn start_webview_refresh(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            // Refresh every 4 hours
            let mut interval = tokio::time::interval(Duration::from_secs(4 * 60 * 60));
            
            loop {
                interval.tick().await;
                
                log::info!("Refreshing webview to clear memory...");
                
                // Get main window and reload it
                if let Some(window) = app_handle.get_webview_window("main") {
                    if let Err(e) = window.eval("window.location.reload()") {
                        log::error!("Failed to reload webview: {}", e);
                    } else {
                        log::info!("Webview refreshed successfully");
                    }
                }
            }
        });
    });
}

/// Clear webview cache on startup
/// Clears WhatsApp Web conflict detection keys to prevent "already open" message
pub fn clear_webview_cache(app_handle: &AppHandle) {
    log::info!("Clearing WhatsApp conflict detection keys...");
    
    if let Some(window) = app_handle.get_webview_window("main") {
        // Clear the specific keys that WhatsApp uses to detect multiple instances
        let clear_wa_conflict = r#"
            (function() {
                try {
                    // Clear specific WhatsApp conflict detection keys
                    const keysToRemove = [];
                    
                    // Find all localStorage keys
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        // Remove keys related to instance/conflict detection
                        if (key && (
                            key.includes('WASecretBundle') ||
                            key.includes('WAToken') ||
                            key.includes('last-wid') ||
                            key.includes('model-storage')
                        )) {
                            keysToRemove.push(key);
                        }
                    }
                    
                    // Remove the identified keys
                    keysToRemove.forEach(key => {
                        try {
                            localStorage.removeItem(key);
                            console.log('[TaurApp] Removed localStorage key:', key);
                        } catch(e) {
                            console.error('[TaurApp] Error removing key:', key, e);
                        }
                    });
                    
                    // Also clear sessionStorage completely
                    sessionStorage.clear();
                    console.log('[TaurApp] Storage cleanup completed');
                    
                } catch(e) {
                    console.error('[TaurApp] Error during storage cleanup:', e);
                }
            })();
        "#;
        
        if let Err(e) = window.eval(clear_wa_conflict) {
            log::error!("Failed to clear WhatsApp conflict keys: {}", e);
        } else {
            log::info!("WhatsApp conflict detection keys cleared successfully");
        }
    }
}
