#[cfg(windows)]
pub struct ProcessGroup(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)]
impl ProcessGroup {
    pub fn attach(child: &std::process::Child) -> std::io::Result<Self> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::System::JobObjects::{AssignProcessToJobObject, CreateJobObjectW};
        // The owned job handle tracks descendants even when Git's intermediate shells exit.
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() {
            return Err(std::io::Error::last_os_error());
        }
        let group = Self(handle);
        if unsafe { AssignProcessToJobObject(handle, child.as_raw_handle()) } == 0 {
            return Err(std::io::Error::last_os_error());
        }
        Ok(group)
    }
    pub fn terminate(&self) {
        unsafe {
            windows_sys::Win32::System::JobObjects::TerminateJobObject(self.0, 1);
        }
    }
}
#[cfg(windows)]
impl Drop for ProcessGroup {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0);
        }
    }
}
#[cfg(not(windows))]
pub struct ProcessGroup;
#[cfg(not(windows))]
impl ProcessGroup {
    pub fn attach(_child: &std::process::Child) -> std::io::Result<Self> {
        Ok(Self)
    }
    pub fn terminate(&self) {}
}
