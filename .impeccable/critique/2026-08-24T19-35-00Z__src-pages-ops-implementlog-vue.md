---
target: 项目实施闭环与实施日志
total_score: 11
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-24T19-35-00Z
slug: src-pages-ops-implementlog-vue
---
## Design Health Score

| # | Heuristic | Score | Key issue |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 1 | No persisted implementation-session status in the current app |
| 2 | Match with real world | 2 | Domain fields are good, but check-in/log/check-out were split |
| 3 | User control and freedom | 1 | No draft recovery, abnormal close, or resume flow |
| 4 | Consistency and standards | 1 | Offline repair has a closed loop; project implementation does not |
| 5 | Error prevention | 0 | Current app permits log submission without check-in and check-out without a submitted log |
| 6 | Recognition rather than recall | 1 | Users must remember project/order context across pages |
| 7 | Flexibility and efficiency | 1 | No continue-current-session shortcut or context carry-over |
| 8 | Aesthetic and minimalist design | 2 | Consistent cards, but generic hierarchy and too many equal-weight entries |
| 9 | Error recovery | 1 | Many load errors are silently ignored |
| 10 | Help and documentation | 1 | Closed-loop rules and exception handling are not explained |
| **Total** | | **11/40** | **Critical** |

## Design Specificity Verdict

The project/process/material/SG-number content is domain-specific, but the current implementation is structurally interchangeable with a generic work-order app. The product's defining object, one traceable on-site implementation session, is not yet the page skeleton.

The deterministic scan over `src/pages/ops` returned zero mechanical findings. This is not evidence that the flow is correct: the detector cannot identify cross-page state-machine gaps. The supplied `实施日志.zip` gives the authoritative 12-screen sequence: order selection, check-in, log steps 1/3 to 3/3, check-out, and completion.

## What's Working

- The supplied design has the correct overall closed-loop mental model.
- The three log stages cover project context, site evidence, people, vehicle, and materials.
- The completion result includes SG number, arrival/end time, duration, and a link to the log.

## Priority Issues

### P0: The current app breaks the designed implementation loop

The implemented log page and the deleted standalone internal punch page were independent. Replace them with one persisted implementation session and server-enforced transitions.

### P1: State cannot be resumed or audited reliably

Add `implementationSessionId`, active-session lookup, drafts, idempotency, server timestamps, location status, and check-in/check-out evidence.

### P1: Critical actions are placeholders or lack gates

Project start and submit-for-acceptance are currently toast-only interactions. Acceptance must be blocked while any implementation session is open.

### P1: Failure and location handling is unsafe

Do not silently swallow load failures or use simulated locations in production. Provide visible error, retry, draft preservation, and an abnormal-location path.

### P2: Prototype copy and example data need correction

The abnormal completion screen uses `WX...` instead of `SG...`; example timestamps conflict; the order picker mixes XM and GZ; and the log step-3 `完成` label should be `提交实施日志`.

## Persona Red Flags

- First-time operator: cannot infer whether to start from project management or implementation log.
- Interrupted field worker: risks losing a long log, repeating check-in, or forgetting check-out after returning to the app.
- Auditor/manager: cannot prove that check-in, log, and check-out belong to the same on-site session.

## Minor Observations

- Use a single vocabulary: `签到 / 签退`, with action labels `签到并开始实施 / 签退并完成本次实施`.
- Keep the current check-in duration and process visible at the top of all three log steps.
- Confirm material quantity limits and inspection-completion gates.

## Questions to Consider

- Should one user be allowed to keep more than one active project session?
- How should cross-day missed check-out be resolved: abnormal close, correction, or approval?
- Which fields are mandatory before the log can be submitted for different project types?
