# dsh-subagent-model

Choose, per session, which model and reasoning effort every dsh subagent uses.
The setting lives in a composer button next to the official model picker.

## Behavior

Each top-level session has one of three settings. A session starts with no override.

- **Default** — no override. Subagents keep dsh's own behavior, including a model a workflow script names in `agent()`.
- **Follow main** — every subagent uses the session's current model and reasoning effort, including a model just picked in the official picker that has not been requested yet.
- **Custom** — every subagent uses the chosen provider, model, and reasoning effort.

The override covers every in-process subagent below the session at any depth: `subagent`, `subagent_fork`, workflow `agent()` children, and Ralph workers.
All of them are created through dsh's in-process subagent providers, so one host-side `agent/request` listener sees each of their requests.
Top-level sessions, including sessions forked from the session menu, are never changed.

- The setting applies to every subsequent subagent request, so changing it also switches running subagents at their next step. Their next request is then uncached.
- The subagent's `{{provider}}`/`{{model}}` prompt variables follow the override, so its persona names the model it actually runs on.
- A custom route is validated by dsh's LLM runtime before it is saved.
- Settings persist in the `subagent_model` storage domain, `~/.dsh/storages/subagent_model.json` with the default JSON backend, and survive restarts.
- No tool schema, agent preset, or tool configuration is changed. A workflow script can still pass `provider`/`model`, and a session override takes precedence over it.

## Composer button

The button renders in the composer's `conversation.input.right` slot, beside the model button, and is hidden in subagent views.
It follows the composer's compact contract: when the control row is short of space, or a mobile layout pins compact mode, the label hides and only the icon stays.
The menu lists the same model catalog as the official picker. Models with reasoning levels open a second pane for the effort.

## Install

```sh
dsh plugin --profile web add github:YanzuoLu/dsh-subagent-model
```

Restart `dsh web` after installation, then reload the page.

## Requirements

- dsh `>=0.2.0-rc.2 <0.3.0`
- A web profile that includes `@deepseek-ai/dsh-web-app` (session controller, composer slots, and the official model picker)
