#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod single_instance {
    use windows::{
        core::{w, PCWSTR},
        Win32::{
            Foundation::{CloseHandle, GetLastError, HANDLE, ERROR_ALREADY_EXISTS},
            System::Threading::CreateMutexW,
            UI::WindowsAndMessaging::{FindWindowW, IsIconic, SetForegroundWindow, ShowWindow, SW_RESTORE},
        },
    };

    pub struct Guard(HANDLE);
    impl Drop for Guard {
        fn drop(&mut self) { unsafe { let _ = CloseHandle(self.0); } }
    }

    fn focus_existing_window() {
        unsafe {
            if let Ok(window) = FindWindowW(PCWSTR::null(), w!("Игротека")) {
                if IsIconic(window).as_bool() { let _ = ShowWindow(window, SW_RESTORE); }
                let _ = SetForegroundWindow(window);
            }
        }
    }

    pub fn acquire() -> windows::core::Result<Option<Guard>> {
        let handle = unsafe { CreateMutexW(None, false, w!(r"Local\IgrotekaStandalone"))? };
        if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
            unsafe { let _ = CloseHandle(handle); }
            focus_existing_window();
            return Ok(None);
        }
        Ok(Some(Guard(handle)))
    }
}

fn main() {
    #[cfg(windows)]
    let _single_instance = match single_instance::acquire() {
        Ok(Some(guard)) => Some(guard),
        Ok(None) => return,
        Err(error) => {
            eprintln!("[Igroteka] single-instance guard warning: {error}");
            None
        }
    };

    igroteka_standalone_lib::run();
}
