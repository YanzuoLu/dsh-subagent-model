# dsh-subagent-model

Choose, per session, which model and reasoning effort every dsh subagent uses.
The setting lives in a composer button next to the official model picker.

## Behavior

Each top-level session has one of three settings. A session starts with no override.

- **Default** — no override. Subagents keep dsh's own behavior, including a model a workflow script names in `agent()`.
- **Follow main** — every subagent uses the session's current model, including a model just picked in the official picker that has not been requested yet. It follows the session's reasoning effort too, unless a separate subagent effort is chosen. A separate effort is clamped to the nearest supported lower level when the main model changes.
- **Custom** — every subagent uses the chosen provider, model, and reasoning effort.

The override covers every in-process subagent below the session at any depth: `subagent`, `subagent_fork`, workflow `agent()` children, and Ralph workers.
All of them are created through dsh's in-process subagent providers, so one host-side `agent/request` listener sees each of their requests.
The subagent override never changes top-level request routing, including sessions forked from the session menu. The main model picker separately preserves effort on model changes as described below.

With the current dsh-side-chat plugin, a new side chat copies its main session's subagent setting, including any separately selected reasoning effort. The copy is independent, and existing or resumed side chats are not reset. “Follow main model” in a side chat follows that side chat's own model. Its subagents resolve the side chat's setting rather than the original main session's later choices.

- The setting applies to every subsequent subagent request, so changing it also switches running subagents at their next step. Their next request is then uncached.
- The subagent's `{{provider}}`/`{{model}}` prompt variables follow the override, so its persona names the model it actually runs on.
- A custom route is validated by dsh's LLM runtime before it is saved.
- Settings persist in the `subagent_model` storage domain, `~/.dsh/storages/subagent_model.json` with the default JSON backend, and survive restarts.
- No tool schema, agent preset, or tool configuration is changed. A workflow script can still pass `provider`/`model`, and a session override takes precedence over it.
- A `subagent_fork` child carries the parent's whole history. A custom model whose context window is smaller than that history makes the fork's requests fail.

## Preserve reasoning effort

Switching models in the main composer picker, `/model`, or the subagent picker retains the current effective reasoning effort instead of resetting it to the new model's default. Each session and each picker uses its own current selection. Effort-only changes, including an explicit default choice, are left alone.

- An exact supported effort is kept, including adapter-specific ids.
- Otherwise the known levels are compared by strength, not catalog display order. The ordering is `off` / `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`.
- The nearest supported lower level is used. For example, `xhigh` becomes `high` on a model whose highest available level is `high`, even if that model defaults to `medium`.
- If the target supports only higher levels, its lowest level is used. A Boolean `off` / `on` capability stays enabled for a nonzero preference.
- A model without reasoning controls receives no explicit effort. Unknown nonmatching adapter-specific levels use the target's default rather than guessing their strength.
- A downgraded custom or main selection becomes the current level for subsequent switches. “Follow main” with a separately chosen effort retains that preference and clamps it against the main model on each request.
- The main-picker integration decorates DSH's public `ModelDirectory.select` method and restores it when the plugin unloads. It does not intercept global fetch or rewrite provider requests. Subagent overrides are validated on the host before being saved.

The browser entry is built from `client.js`. After editing it or the shared helpers, run `pnpm run build` to regenerate `lib/client.js`.

## Composer button

The button renders in the composer's `conversation.input.right` slot, beside the model button, and is hidden in subagent views.
It shows a caption-toned "Subagent" prefix before the current setting, and follows the composer's compact contract: when the control row is short of space, or a mobile layout pins compact mode, the text hides and only the icon stays.

The menu mirrors the official model picker. Its root pane lists "Default (no override)" and "Follow main model", then the subagent model and subagent reasoning-effort cells.
The model cell opens the official provider-grouped catalog, with search once more than four models are listed.
The effort cell is always listed. It opens the effort levels of the custom model, or of the main model when following it, and otherwise shows, read-only, the effort subagents actually get.
Labels follow the dsh language preference (Chinese or English).

## Install

```sh
dsh plugin --profile web add github:YanzuoLu/dsh-subagent-model
```

Enable the bundle in the Web profile and refresh the page to load its client code.

When upgrading a running DSH, replacing package files alone does not refresh an already-loaded Host module. Apply a targeted Host module reload for this plugin, or load it on the next DSH start, and refresh the browser client. A targeted reload does not require restarting DSH or recreating Agents. The published package contains both the host preservation logic and the built browser adapter; no local-checkout override is needed.

## Requirements

- dsh `>=0.2.0-rc.2 <0.3.0`
- A web profile that includes `@deepseek-ai/dsh-web-app` (session controller, composer slots, and the official model picker)
