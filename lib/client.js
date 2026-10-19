// Browser half, loaded by the dsh web shell as a classic script (no import/export).
window.__ModuleLoader__.load({
  id: 'dsh-subagent-model',
  factory: (require) => {
    const { useCallback, useEffect, useState, useSyncExternalStore } = require('react')
    const { jsx, jsxs } = require('react/jsx-runtime')
    const {
      Menu,
      IconChevronDownOutlineRegular,
      IconChevronLeftOutlineRegular,
      IconChevronRightOutlineRegular,
      IconWorkspaceTreeOutlineRegular,
    } = require('@deepseek-ai/dsh-client-ui-primitives')

    const ID = 'dsh-subagent-model'
    const NS = 'subagent-model'
    const CHANNEL = '/subagent-model'

    const zh = {
      title: '子智能体模型',
      none: '默认',
      inherit: '跟随主模型',
      menuNone: '不覆盖',
      menuInherit: '跟随主会话模型',
      defaultEffort: '默认强度',
      loading: '正在加载模型…',
      failed: '保存失败：{message}',
    }
    const en = {
      title: 'Subagent model',
      none: 'Default',
      inherit: 'Follow main',
      menuNone: 'No override',
      menuInherit: 'Follow the session model',
      defaultEffort: 'Default effort',
      loading: 'Loading models…',
      failed: 'Save failed: {message}',
    }

    // Class names avoid underscores so dsh-web-mobile's [class*="_trigger"]-style
    // selectors, which target the official hashed classes, never match them.
    const CSS = `
.dsh-sam-anchor{display:flex;min-width:0}
.dsh-sam-trigger{height:28px;padding:0 4px 0 6px;gap:4px;display:flex;align-items:center;min-width:0;max-width:min(260px,30cqw);border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.dsh-sam-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-sam-trigger[data-override]{color:var(--dsw-alias-label-primary)}
.dsh-sam-icon,.dsh-sam-chevron{flex:none;display:block}
.dsh-sam-chevron{color:var(--dsw-alias-label-caption)}
.dsh-sam-label{display:var(--dsh-composer-model-text-display,block);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-sam-list{max-height:min(360px,calc(100vh - 96px));overflow-y:auto}
.dsh-sam-row{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%}
`

    const modelId = (provider, model) => `m:${JSON.stringify([provider, model])}`

    function findModel(snapshot, provider, model) {
      return snapshot.groups.find((group) => group.id === provider)?.models.find((entry) => entry.id === model)
    }

    function overrideLabel(override, snapshot, t) {
      if (override === null || override === undefined) return t('none')
      if (override.mode === 'inherit') return t('inherit')
      const model = findModel(snapshot, override.provider, override.model)
      const effort = model?.reasoning?.efforts.find((entry) => entry.id === override.reasoningEffort)
      const name = model?.name ?? override.model
      return override.reasoningEffort === undefined ? name : `${name} · ${effort?.name ?? override.reasoningEffort}`
    }

    function rootItems(snapshot, error, t) {
      const items = []
      if (error !== null) items.push({ id: 'error', label: t('failed', { message: error }), disabled: true })
      items.push({ id: 'none', label: t('menuNone') }, { id: 'inherit', label: t('menuInherit') })
      if (snapshot.groups.length === 0) {
        items.push({ type: 'separator', id: 'loading-sep' }, { id: 'loading', label: t('loading'), disabled: true })
      }
      for (const group of snapshot.groups) {
        items.push({ type: 'separator', id: `sep:${group.id}` }, { type: 'label', id: `group:${group.id}`, text: group.name })
        for (const model of group.models) {
          const drill = (model.reasoning?.efforts.length ?? 0) > 0
          items.push({
            id: modelId(group.id, model.id),
            label: drill
              ? jsxs('span', { className: 'dsh-sam-row', children: [model.name, jsx(IconChevronRightOutlineRegular, { size: 14 })] })
              : model.name,
          })
        }
      }
      return items
    }

    function effortItems(model, t) {
      const items = [
        { id: 'back', label: model.name, icon: jsx(IconChevronLeftOutlineRegular, { size: 14 }) },
        { type: 'separator', id: 'back-sep' },
      ]
      if (model.reasoning.defaultEffort === undefined) items.push({ id: 'e:', label: t('defaultEffort') })
      for (const effort of model.reasoning.efforts) items.push({ id: `e:${effort.id}`, label: effort.name })
      return items
    }

    function selectedIdFor(override, pane) {
      if (pane !== null) {
        return override?.mode === 'custom' && override.provider === pane.provider && override.model === pane.model
          ? `e:${override.reasoningEffort ?? ''}`
          : undefined
      }
      if (override === null || override === undefined) return 'none'
      return override.mode === 'inherit' ? 'inherit' : modelId(override.provider, override.model)
    }

    function SubagentModelMenu({ sessionId, directory, load, rpc, t }) {
      const snapshot = useSyncExternalStore((listener) => directory.subscribe(listener), () => directory.getSnapshot())
      const [override, setOverride] = useState(undefined)
      const [open, setOpen] = useState(false)
      const [pane, setPane] = useState(null)
      const [error, setError] = useState(null)

      const refresh = useCallback(() => {
        rpc.call(CHANNEL, 'get', { sessionId }).then((result) => {
          if (result.ok) setOverride(result.value.override)
        }, () => {})
      }, [rpc, sessionId])
      useEffect(refresh, [refresh])

      const close = () => {
        setOpen(false)
        setPane(null)
      }
      const save = (next) => {
        close()
        rpc.call(CHANNEL, 'set', { sessionId, override: next }).then((result) => {
          if (result.ok) {
            setOverride(result.value.override)
            setError(null)
          } else setError(result.error.message)
        }, (failure) => setError(failure instanceof Error ? failure.message : String(failure)))
      }
      const onSelect = (id) => {
        if (id === 'none') save(null)
        else if (id === 'inherit') save({ mode: 'inherit' })
        else if (id === 'back') setPane(null)
        else if (id.startsWith('m:')) {
          const [provider, model] = JSON.parse(id.slice(2))
          if ((findModel(snapshot, provider, model)?.reasoning?.efforts.length ?? 0) > 0) setPane({ provider, model })
          else save({ mode: 'custom', provider, model })
        } else if (id.startsWith('e:') && pane !== null) {
          const effort = id.slice(2)
          save({ mode: 'custom', provider: pane.provider, model: pane.model, ...effort === '' ? {} : { reasoningEffort: effort } })
        }
      }

      const paneModel = pane === null ? undefined : findModel(snapshot, pane.provider, pane.model)
      const items = paneModel === undefined ? rootItems(snapshot, error, t) : effortItems(paneModel, t)
      const label = overrideLabel(override, snapshot, t)
      const trigger = jsxs('button', {
        type: 'button',
        className: 'dsh-sam-trigger',
        title: `${t('title')}: ${label}`,
        'aria-label': `${t('title')}: ${label}`,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        ...override === null || override === undefined ? {} : { 'data-override': '' },
        onClick: () => {
          if (open) close()
          else {
            load()
            refresh()
            setOpen(true)
          }
        },
        children: [
          jsx(IconWorkspaceTreeOutlineRegular, { size: 16, className: 'dsh-sam-icon' }),
          jsx('span', { className: 'dsh-sam-label', children: label }),
          jsx(IconChevronDownOutlineRegular, { size: 12, className: 'dsh-sam-chevron' }),
        ],
      })
      return jsx(Menu, {
        open,
        anchor: trigger,
        items,
        selectedId: selectedIdFor(override, paneModel === undefined ? null : pane),
        onSelect,
        onClose: close,
        side: 'top',
        align: 'end',
        portal: true,
        dense: true,
        className: 'dsh-sam-anchor',
        listClassName: 'dsh-sam-list',
      })
    }

    /** Subagent views follow their top-level session, so the control is absent there. */
    function SubagentModelButton(props) {
      return props.available ? jsx(SubagentModelMenu, props) : null
    }

    const inject = ['slots', 'sessions', 'locale', 'modelDirectories', 'connection']

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'subagent-model: dictionaries')
      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', ID)
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'subagent-model: styles')
      const models = ctx.modelDirectories
      const sessions = ctx.sessions
      const rpc = ctx.connection.rpc
      ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
        name: 'conversation.input.right',
        id: ID,
        locale: NS,
        inject: (sessionId) => {
          const directory = models.directoryFor(sessionId)
          const available = sessions.subagentAddress(sessionId) === undefined
          return {
            available,
            directory: directory.store,
            load: () => {
              if (available) directory.load().catch(() => {})
            },
            rpc,
          }
        },
      }, SubagentModelButton))
    }

    return { name: ID, inject, apply }
  },
})
