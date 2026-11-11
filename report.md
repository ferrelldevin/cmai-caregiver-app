# CMAI browser checks

RESULT: FAIL

- Commit: f392b17 Merge main into logs before start
- Branch: claude/logs-before-start
- Ran at: 2026-11-11T16:10:57.990Z
- Node v24.19.0 on win32

## Setup

```
Install dependencies failed:
    at Module._load (node:internal/modules/cjs/loader:1396:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)
    at node:internal/main/run_main_module:33:47 {
  errno: -4094,
  code: 'UNKNOWN',
  syscall: 'spawn'
}

Node.js v24.19.0
npm error code 1
npm error path C:\lab\cmai-tracker
npm error command failed
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c lefthook install
npm error A complete log of this run can be found in: C:\Users\Devin\AppData\Local\npm-cache\_logs\2026-11-11T16_09_48_855Z-debug-0.log
```

Written by scripts/run-checks.mjs. Screenshots stay on the machine that ran it.
