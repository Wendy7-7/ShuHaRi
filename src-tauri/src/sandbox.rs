//! 判题进程资源限制（Windows Job Object）
//!
//! 替代裸 `child.kill()` 的三重保护：
//! 1. 内存上限（默认 2GB）——死循环吃内存的学生代码被 Job 挡住而不是拖垮整机
//! 2. 进程数上限（默认 16）——防进程炸弹
//! 3. KILL_ON_JOB_CLOSE——超时/结束时关闭 Job 句柄，整棵进程树（含孙进程）一起死，
//!    不留后台残留进程
//!
//! 注意：这是「资源限制」，不是安全沙盒——学生代码仍以当前用户权限运行。

#[cfg(windows)]
pub use win::*;

#[cfg(windows)]
mod win {
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_ACTIVE_PROCESS, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        JOB_OBJECT_LIMIT_PROCESS_MEMORY,
    };

    /// Job 句柄守卫：Drop 时 CloseHandle，触发 KILL_ON_JOB_CLOSE 杀掉 job 内所有进程
    pub struct Sandbox {
        job: HANDLE,
    }

    // Job 句柄可跨线程传递（只用于 Drop 关闭）
    unsafe impl Send for Sandbox {}

    impl Drop for Sandbox {
        fn drop(&mut self) {
            unsafe {
                let _ = CloseHandle(self.job);
            }
        }
    }

    /// 把已启动的进程纳入 Job。
    /// `process` 传 `std::process::Child::as_raw_handle()`；
    /// 失败（极少数：外层已有不兼容 Job）时返回 None，判题退化为原有裸进程模式，不致命。
    pub fn attach(
        process: std::os::windows::io::RawHandle,
        mem_limit_mb: u64,
        max_procs: u32,
    ) -> Option<Sandbox> {
        let proc_handle = HANDLE(process);
        unsafe {
            let job = CreateJobObjectW(None, None).ok()?;
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                | JOB_OBJECT_LIMIT_PROCESS_MEMORY
                | JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
            info.ProcessMemoryLimit = (mem_limit_mb * 1024 * 1024) as usize;
            info.BasicLimitInformation.ActiveProcessLimit = max_procs;

            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
            .is_err()
            {
                let _ = CloseHandle(job);
                return None;
            }
            if AssignProcessToJobObject(job, proc_handle).is_err() {
                let _ = CloseHandle(job);
                return None;
            }
            Some(Sandbox { job })
        }
    }
}

/// 非 Windows 平台：空实现（项目当前只发布 Windows 便携版）
#[cfg(not(windows))]
pub struct Sandbox;

#[cfg(not(windows))]
pub fn attach(
    _process: std::os::windows::io::RawHandle,
    _mem_limit_mb: u64,
    _max_procs: u32,
) -> Option<Sandbox> {
    None
}

#[cfg(all(test, windows))]
mod tests {
    use super::attach;

    /// 关键行为：spawn → attach → Drop 关 Job → 子进程必须死
    #[test]
    fn attach_then_drop_kills_child() {
        use std::os::windows::io::AsRawHandle;
        let mut child = std::process::Command::new("cmd")
            .args(["/c", "ping -n 30 127.0.0.1 > nul"])
            .spawn()
            .expect("spawn 失败");
        let sb = attach(child.as_raw_handle(), 512, 8);
        assert!(sb.is_some(), "attach Job 应成功（嵌套 Job 环境除外）");
        drop(sb);
        std::thread::sleep(std::time::Duration::from_millis(800));
        let status = child.try_wait().expect("try_wait 失败");
        assert!(status.is_some(), "关 Job 后子进程应被 KILL_ON_JOB_CLOSE 杀掉");
    }
}
