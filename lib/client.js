// Browser half, loaded by the dsh web shell as a classic script (no import/export).
// The seat mirrors the official composer model picker (dsh-client-ui-model-selection):
// a two-level menu whose root pane holds the model and reasoning-effort cells, a
// searchable provider-grouped model pane, and an effort pane.
window.__ModuleLoader__.load({
  id: 'dsh-subagent-model',
  factory: (require) => {
    const { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, useId } = require('react')
    const { Fragment, jsx, jsxs } = require('react/jsx-runtime')
    const { createPortal } = require('react-dom')
    const {
      Input,
      MenuGroup,
      MenuSurface,
      Toast,
      IconCheckOutlineRegular,
      IconChevronDownOutlineRegular,
      IconChevronRightOutlineRegular,
      IconCloseFillRegular,
      IconWarningOutlineRegular,
      IconWorkspaceTreeOutlineRegular,
      observeStickyMenuGroups,
      rankByName,
    } = require('@deepseek-ai/dsh-client-ui-primitives')

    const ID = 'dsh-subagent-model'
    const NS = 'subagent-model'

    const zh = {
      'trigger.prefix': '子智能体',
      'trigger.aria': '选择子智能体模型，当前 {value}',
      'value.none': '默认',
      'value.inherit': '跟随主模型',
      'value.choose': '选择模型',
      'value.unsupported': '不支持',
      'menu.aria': '子智能体模型与推理等级',
      'menu.model': '子智能体模型',
      'menu.effort': '子智能体推理等级',
      'option.none': '默认（不覆盖）',
      'option.inherit': '跟随主模型',
      'effort.default': '默认',
      'search.placeholder': '搜索模型…',
      'search.clear': '清除搜索',
      'search.empty': '没有匹配的模型。',
      'empty.models': '没有可用的模型。',
      'status.loading': '正在刷新模型列表…',
      'error.save': '子智能体模型设置失败：{message}',
    }
    const en = {
      'trigger.prefix': 'Subagent',
      'trigger.aria': 'Select subagent model, current {value}',
      'value.none': 'Default',
      'value.inherit': 'Follow main',
      'value.choose': 'Choose model',
      'value.unsupported': 'Not supported',
      'menu.aria': 'Subagent model and effort',
      'menu.model': 'Subagent model',
      'menu.effort': 'Subagent effort',
      'option.none': 'Default (no override)',
      'option.inherit': 'Follow main model',
      'effort.default': 'Default',
      'search.placeholder': 'Search models…',
      'search.clear': 'Clear search',
      'search.empty': 'No matching models.',
      'empty.models': 'No models available.',
      'status.loading': 'Refreshing model list…',
      'error.save': 'Subagent model update failed: {message}',
    }

    // The official picker's stylesheet under this plugin's own class prefix, plus
    // the caption-toned prefix label. Class names avoid underscores so
    // dsh-web-mobile's [class*="_trigger"]-style selectors never match them.
    const CSS = `
.dsh-sam-root{min-width:0;position:relative}
.dsh-sam-trigger{border-radius:var(--dsw-radius-sm);min-width:0;max-width:min(320px,40cqw);height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:400;line-height:20px;display:flex}
.dsh-sam-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-sam-trigger:focus-visible:not([data-selection-focus]){box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}
.dsh-sam-triggerPrefix{white-space:nowrap;flex:none;color:var(--dsw-alias-label-caption)}
.dsh-sam-triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}
.dsh-sam-triggerEffort{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-caption);flex-shrink:1000;overflow:hidden}
.dsh-sam-triggerIcon{display:var(--dsh-composer-model-icon-display,none);flex:none}
.dsh-sam-triggerPrefix,.dsh-sam-triggerLabel,.dsh-sam-triggerEffort{display:var(--dsh-composer-model-text-display,block)}
.dsh-sam-chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}
.dsh-sam-chevronOpen{transform:rotate(180deg)}
.dsh-sam-menu{z-index:1100;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);width:max-content;min-width:min(240px,100vw - 32px);max-width:min(420px,100vw - 32px);max-height:min(360px,100vh - 96px);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:0;flex-direction:column;padding:4px;display:flex;position:fixed;overflow:hidden}
.dsh-sam-status,.dsh-sam-empty{color:var(--dsw-alias-label-tertiary);padding:8px;font-size:12px;line-height:18px}
.dsh-sam-searchRow{flex-shrink:0;margin:2px 0 3px;position:relative}
.dsh-sam-searchRow .dsh-sam-search{border-radius:var(--dsw-radius-md);background:0 0;border:0 solid #0000;height:auto;padding:5px 7px;display:flex}
.dsh-sam-searchRow .dsh-sam-searchWithQuery{padding-right:34px}
.dsh-sam-searchClear{corner-shape:round;width:24px;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:50%;justify-content:center;align-items:center;padding:0;display:inline-flex;position:absolute;top:50%;right:4px;transform:translateY(-50%)}
.dsh-sam-searchClear:hover,.dsh-sam-searchClear:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dsh-sam-searchRow .dsh-sam-search:focus-within{border-color:#0000}
.dsh-sam-searchRow .dsh-sam-search input{padding:0;font-size:12px;line-height:normal}
.dsh-sam-searchRow .dsh-sam-search input::placeholder{color:var(--dsw-alias-label-caption)}
.dsh-sam-groups{min-height:0;overflow-y:auto}
.dsh-sam-option{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;min-height:34px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:5px 7px;display:flex}
.dsh-sam-option:not(.dsh-sam-modelOption):hover:not(:disabled),.dsh-sam-option:focus-visible,.dsh-sam-optionActive:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-sam-selected{background:0 0}
.dsh-sam-optionCopy{flex-direction:column;flex:1;min-width:0;display:flex}
.dsh-sam-modelName{color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:400;line-height:18px;overflow:hidden}
.dsh-sam-check{color:var(--dsw-alias-label-primary);flex:0 0 14px;place-items:center;display:grid}
.dsh-sam-check svg{width:14px;height:14px}
.dsh-sam-cell{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:0 8px;font-size:13px;line-height:20px;display:flex}
.dsh-sam-cell:hover:not(:disabled),.dsh-sam-cell:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-sam-cell:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
.dsh-sam-cell:disabled .dsh-sam-cellChevron{visibility:hidden}
.dsh-sam-cellLabel{white-space:nowrap;flex:none}
.dsh-sam-cellValue{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:var(--dsw-alias-label-tertiary);flex:auto;overflow:hidden}
.dsh-sam-cellChevron{width:12px;height:12px;color:var(--dsw-alias-menu-icon);flex:none}
.dsh-sam-separator{flex:none;height:1px;margin:4px 8px;background:var(--dsw-alias-border-l1)}
`

    /** Unplaced portal card: laid out but hidden so its size can be measured before placement. */
    const MEASURE_STYLE = { visibility: 'hidden', left: 0, top: 0 }

    const cx = (...names) => names.filter(Boolean).join(' ')

    /** Same provider order as the official picker: DeepSeek account, then DeepSeek official, then catalog order. */
    const providerRank = (id) => id === 'deepseek-account' ? 0 : id === 'deepseek-official' ? 1 : 2
    const orderProviders = (groups) => groups.toSorted((left, right) => providerRank(left.id) - providerRank(right.id))

    const rowKey = (row) => row.kind === 'model' ? `model:${JSON.stringify([row.provider, row.model])}` : row.kind

    /**
     * Host routes on the shared /api channel. The relative path resolves against
     * the page like the shell's own API calls, so a path-prefixed gateway works.
     */
    async function callHost(endpoint, payload) {
      const response = await fetch(`api/subagent-model/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    }

    function SubagentModelSelect({ sessionId, directory, load, t }) {
      const state = useSyncExternalStore((listener) => directory.subscribe(listener), () => directory.getSnapshot())
      const [override, setOverride] = useState(null)
      const [open, setOpen] = useState(false)
      const [pane, setPane] = useState('root')
      const [query, setQuery] = useState('')
      const [highlighted, setHighlighted] = useState(null)
      const [selectionFocus, setSelectionFocus] = useState(false)
      const [toast, setToast] = useState(null)
      const [menuPos, setMenuPos] = useState(null)
      const toastSeq = useRef(0)
      const rootRef = useRef(null)
      const triggerRef = useRef(null)
      const menuRef = useRef(null)
      const searchRef = useRef(null)
      const groupsRef = useRef(null)
      const itemRefs = useRef([])
      const paneFocus = useRef(null)
      const id = useId()

      const refresh = () => {
        callHost('get', { sessionId }).then((result) => {
          if (result.ok) setOverride(result.value.override)
        }, () => {})
      }
      useEffect(refresh, [sessionId])

      const groups = useMemo(() => orderProviders(state.groups), [state.groups])
      const choiceCount = groups.reduce((sum, group) => sum + group.models.length, 0)
      const showSearch = choiceCount > 4
      const trimmed = showSearch ? query.trim() : ''
      const filteredGroups = useMemo(() => groups
        .map((group) => ({ ...group, models: rankByName(group.models, trimmed) }))
        .filter((group) => group.models.length > 0), [groups, trimmed])
      const rows = filteredGroups.flatMap((group) => group.models.map((model) => ({ kind: 'model', provider: group.id, model: model.id })))

      const custom = override?.mode === 'custom' ? override : undefined
      const customModel = custom === undefined
        ? undefined
        : groups.find((group) => group.id === custom.provider)?.models.find((model) => model.id === custom.model)
      const reasoning = customModel?.reasoning
      const effectiveEffort = custom?.reasoningEffort ?? reasoning?.defaultEffort
      const effortLabel = custom === undefined
        ? undefined
        : reasoning === undefined
          ? custom.reasoningEffort
          : effectiveEffort === undefined
            ? t('effort.default')
            : reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort
      const effortChoices = reasoning === undefined ? [] : [
        ...reasoning.defaultEffort === undefined ? [{ key: 'default', effort: undefined, label: t('effort.default') }] : [],
        ...reasoning.efforts.map((level) => ({ key: `effort:${level.id}`, effort: level.id, label: level.name })),
      ]
      const valueLabel = override === null
        ? t('value.none')
        : override.mode === 'inherit'
          ? t('value.inherit')
          : customModel?.name ?? `${override.provider}/${override.model}`
      // The effort cell is always listed. Outside a custom model with reasoning
      // levels it is read-only and names the effort subagents actually get.
      const effortCellLabel = (() => {
        if (custom !== undefined) return effortChoices.length > 0 ? effortLabel : effortLabel ?? t('value.unsupported')
        if (override?.mode !== 'inherit') return t('value.none')
        const main = state.current
        const mainReasoning = main === null
          ? undefined
          : groups.find((group) => group.id === main.provider)?.models.find((model) => model.id === main.model)?.reasoning
        const mainEffort = main?.reasoningEffort ?? mainReasoning?.defaultEffort
        if (mainEffort === undefined) return mainReasoning === undefined ? t('value.inherit') : t('effort.default')
        return mainReasoning?.efforts.find((level) => level.id === mainEffort)?.name ?? mainEffort
      })()
      const selectedKey = override === null
        ? 'none'
        : override.mode === 'inherit' ? 'inherit' : rowKey({ kind: 'model', provider: override.provider, model: override.model })
      const selectedIndex = rows.findIndex((row) => rowKey(row) === selectedKey)
      const activeIndex = rows.length === 0 ? -1 : Math.min(highlighted ?? Math.max(0, selectedIndex), rows.length - 1)

      useEffect(() => {
        if (!open) return
        const closeOutside = (event) => {
          if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
          setOpen(false)
          setPane('root')
        }
        document.addEventListener('mousedown', closeOutside)
        return () => document.removeEventListener('mousedown', closeOutside)
      }, [open])

      useEffect(() => {
        const intent = paneFocus.current
        paneFocus.current = null
        if (!open || intent === null) return
        if (intent === 'drill') {
          if (pane === 'model' && showSearch) {
            searchRef.current?.focus()
            return
          }
          const checked = menuRef.current?.querySelector('[role="menuitemradio"][aria-checked="true"]')
          ;(checked ?? itemRefs.current.find((item) => item !== null) ?? triggerRef.current)?.focus()
          return
        }
        // Root pane order: default, follow main, model cell, effort cell.
        ;(itemRefs.current[intent === 'effort' ? 3 : 2] ?? triggerRef.current)?.focus()
      }, [open, pane, showSearch])

      useEffect(() => {
        const viewport = groupsRef.current
        if (viewport === null) return
        return observeStickyMenuGroups(viewport)
      }, [open, pane, filteredGroups])

      useLayoutEffect(() => {
        if (open && pane === 'model' && activeIndex >= 0) itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
      }, [open, pane, activeIndex])

      // Same placement as the official menu: right-aligned to the trigger, 8px
      // above it, kept 12px inside the viewport, and re-placed on scroll/resize.
      useLayoutEffect(() => {
        if (!open) {
          setMenuPos(null)
          return
        }
        const place = () => {
          const rect = triggerRef.current?.getBoundingClientRect()
          if (rect === undefined) return
          const MARGIN = 12
          const width = menuRef.current?.offsetWidth ?? 0
          const height = menuRef.current?.offsetHeight ?? 0
          let x = rect.right - width
          let y = rect.top - 8 - height
          if (width > 0) x = Math.min(Math.max(x, MARGIN), window.innerWidth - width - MARGIN)
          if (height > 0) y = Math.min(Math.max(y, MARGIN), window.innerHeight - height - MARGIN)
          setMenuPos({ left: x, top: y })
        }
        place()
        window.addEventListener('scroll', place, true)
        window.addEventListener('resize', place)
        return () => {
          window.removeEventListener('scroll', place, true)
          window.removeEventListener('resize', place)
        }
      }, [open, pane, state, query, override])

      const show = () => {
        setSelectionFocus(false)
        triggerRef.current?.focus()
        setQuery('')
        setHighlighted(null)
        setPane('root')
        setOpen(true)
        load()
        refresh()
      }
      const close = (restoreFocus = false) => {
        setOpen(false)
        setPane('root')
        if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus())
      }
      const drill = (next) => {
        setQuery('')
        setHighlighted(null)
        paneFocus.current = 'drill'
        setPane(next)
      }
      const back = (from) => {
        paneFocus.current = from
        setPane('root')
      }
      const save = (next) => {
        setSelectionFocus(true)
        close(true)
        callHost('set', { sessionId, override: next }).then((result) => {
          if (result.ok) {
            setOverride(result.value.override)
            return
          }
          throw new Error(result.error.message)
        }).catch((error) => {
          toastSeq.current += 1
          setToast({ seq: toastSeq.current, text: t('error.save', { message: error instanceof Error ? error.message : String(error) }) })
        })
      }
      const choose = (row) => {
        if (rowKey(row) === selectedKey) {
          setSelectionFocus(true)
          close(true)
          return
        }
        if (row.kind === 'none') save(null)
        else if (row.kind === 'inherit') save({ mode: 'inherit' })
        else {
          const model = groups.find((group) => group.id === row.provider)?.models.find((entry) => entry.id === row.model)
          const effort = model?.reasoning?.defaultEffort
          save({ mode: 'custom', provider: row.provider, model: row.model, ...effort === undefined ? {} : { reasoningEffort: effort } })
        }
      }
      const chooseEffort = (effort) => {
        if (custom === undefined) return
        if (effort === effectiveEffort) {
          setSelectionFocus(true)
          close(true)
          return
        }
        save({ mode: 'custom', provider: custom.provider, model: custom.model, ...effort === undefined ? {} : { reasoningEffort: effort } })
      }
      const moveFocus = (offset) => {
        const items = itemRefs.current.filter((item) => item !== null && !item.disabled)
        if (items.length === 0) return
        const current = items.indexOf(document.activeElement)
        items[current === -1 ? (offset > 0 ? 0 : items.length - 1) : (current + offset + items.length) % items.length]?.focus()
      }
      const onKeyDown = (event) => {
        if (event.nativeEvent.isComposing || !open) return
        if (event.key === 'Escape') {
          event.preventDefault()
          if (pane !== 'root') back(pane)
          else close(true)
          return
        }
        if (pane === 'model' && showSearch && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault()
          if (rows.length > 0) {
            setHighlighted((activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length)
            searchRef.current?.focus()
          }
          return
        }
        if (pane === 'model' && showSearch && event.target instanceof HTMLInputElement && event.key === 'Enter') {
          event.preventDefault()
          if (rows[activeIndex] !== undefined) choose(rows[activeIndex])
          return
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          moveFocus(event.key === 'ArrowDown' ? 1 : -1)
        }
      }
      const onBlur = (event) => {
        const next = event.relatedTarget
        if (next instanceof Node && (rootRef.current?.contains(next) || menuRef.current?.contains(next))) return
        close()
      }

      itemRefs.current = []
      let itemIndex = 0
      const itemRef = () => {
        const at = itemIndex++
        return (node) => {
          itemRefs.current[at] = node
        }
      }
      let rowIndex = 0
      const option = (row, label) => {
        const index = rowIndex++
        const selected = rowKey(row) === selectedKey
        return jsxs('button', {
          ref: itemRef(),
          type: 'button',
          role: 'menuitemradio',
          'aria-checked': selected,
          id: `${id}-row-${index}`,
          tabIndex: showSearch ? -1 : 0,
          title: label,
          className: cx('dsh-sam-option', row.kind === 'model' && 'dsh-sam-modelOption', selected && 'dsh-sam-selected', index === activeIndex && 'dsh-sam-optionActive'),
          onFocus: () => setHighlighted(index),
          onMouseMove: index === activeIndex ? undefined : () => {
            if (showSearch) setHighlighted(index)
            else itemRefs.current[index]?.focus()
          },
          onClick: () => choose(row),
          children: [
            jsx('span', { className: 'dsh-sam-optionCopy', children: jsx('span', { className: 'dsh-sam-modelName', children: label }) }),
            jsx('span', { className: 'dsh-sam-check', children: selected ? jsx(IconCheckOutlineRegular, {}) : null }),
          ],
        }, rowKey(row))
      }
      const modeOption = (kind, label) => {
        const selected = selectedKey === kind
        return jsxs('button', {
          ref: itemRef(),
          type: 'button',
          role: 'menuitemradio',
          'aria-checked': selected,
          title: label,
          className: cx('dsh-sam-option', selected && 'dsh-sam-selected'),
          onClick: () => choose({ kind }),
          children: [
            jsx('span', { className: 'dsh-sam-optionCopy', children: jsx('span', { className: 'dsh-sam-modelName', children: label }) }),
            jsx('span', { className: 'dsh-sam-check', children: selected ? jsx(IconCheckOutlineRegular, {}) : null }),
          ],
        }, kind)
      }
      const cell = (label, value, onClick) => jsxs('button', {
        ref: itemRef(),
        type: 'button',
        role: 'menuitem',
        className: 'dsh-sam-cell',
        disabled: onClick === undefined,
        onClick,
        children: [
          jsx('span', { className: 'dsh-sam-cellLabel', children: label }),
          jsx('span', { className: 'dsh-sam-cellValue', children: value }),
          jsx(IconChevronRightOutlineRegular, { className: 'dsh-sam-cellChevron' }),
        ],
      })

      const triggerTitle = `${t('trigger.prefix')}: ${effortLabel === undefined ? valueLabel : `${valueLabel} · ${effortLabel}`}`
      return jsxs('div', {
        ref: rootRef,
        className: 'dsh-sam-root',
        onKeyDown,
        onBlur,
        onMouseDown: (event) => {
          if (event.target instanceof Element && event.target.closest('button') !== null) event.preventDefault()
        },
        children: [
          jsxs('button', {
            ref: triggerRef,
            type: 'button',
            className: 'dsh-sam-trigger',
            'aria-label': t('trigger.aria', { value: valueLabel }),
            'aria-haspopup': 'menu',
            'aria-expanded': open,
            'aria-controls': open ? `${id}-menu` : undefined,
            title: triggerTitle,
            'data-selection-focus': selectionFocus ? '' : undefined,
            onBlur: () => setSelectionFocus(false),
            onClick: () => {
              if (open) close(true)
              else show()
            },
            children: [
              jsx(IconWorkspaceTreeOutlineRegular, { className: 'dsh-sam-triggerIcon', size: 16 }),
              jsx('span', { className: 'dsh-sam-triggerPrefix', children: t('trigger.prefix') }),
              jsx('span', { className: 'dsh-sam-triggerLabel', children: valueLabel }),
              effortLabel !== undefined && jsx('span', { className: 'dsh-sam-triggerEffort', children: effortLabel }),
              jsx(IconChevronDownOutlineRegular, { className: cx('dsh-sam-chevron', open && 'dsh-sam-chevronOpen') }),
            ],
          }),
          open && createPortal(jsxs(MenuSurface, {
            ref: menuRef,
            id: `${id}-menu`,
            className: 'dsh-sam-menu',
            style: menuPos ?? MEASURE_STYLE,
            role: pane === 'model' ? 'group' : 'menu',
            'aria-label': t('menu.aria'),
            children: [
              pane === 'root' && jsxs(Fragment, {
                children: [
                  modeOption('none', t('option.none')),
                  modeOption('inherit', t('option.inherit')),
                  jsx('div', { className: 'dsh-sam-separator', role: 'separator' }),
                  cell(t('menu.model'), custom === undefined ? t('value.choose') : valueLabel, () => drill('model')),
                  cell(t('menu.effort'), effortCellLabel, effortChoices.length > 0 ? () => drill('effort') : undefined),
                ],
              }),
              pane === 'model' && jsxs(Fragment, {
                children: [
                  showSearch && jsxs('div', {
                    className: 'dsh-sam-searchRow',
                    children: [
                      jsx(Input, {
                        ref: searchRef,
                        className: cx('dsh-sam-search', query !== '' && 'dsh-sam-searchWithQuery'),
                        type: 'text',
                        role: 'searchbox',
                        'aria-label': t('search.placeholder'),
                        'aria-controls': `${id}-rows`,
                        'aria-activedescendant': activeIndex < 0 ? undefined : `${id}-row-${activeIndex}`,
                        placeholder: t('search.placeholder'),
                        value: query,
                        onChange: (event) => {
                          setQuery(event.target.value)
                          setHighlighted(0)
                        },
                      }),
                      query !== '' && jsx('button', {
                        type: 'button',
                        className: 'dsh-sam-searchClear',
                        'aria-label': t('search.clear'),
                        onClick: () => {
                          setQuery('')
                          setHighlighted(0)
                          searchRef.current?.focus()
                        },
                        children: jsx(IconCloseFillRegular, {}),
                      }),
                    ],
                  }),
                  state.status === 'loading' && jsx('div', { className: 'dsh-sam-status', children: t('status.loading') }),
                  jsxs('div', {
                    ref: groupsRef,
                    id: `${id}-rows`,
                    className: cx('dsh-sam-groups', 'scrollable'),
                    role: 'menu',
                    'aria-label': t('menu.model'),
                    hidden: rows.length === 0,
                    children: filteredGroups.map((group) => jsx(MenuGroup, {
                      label: group.name,
                      children: group.models.map((model) => option({ kind: 'model', provider: group.id, model: model.id }, model.name)),
                    }, group.id)),
                  }),
                  state.status === 'ready' && filteredGroups.length === 0 && jsx('div', {
                    className: 'dsh-sam-empty',
                    role: 'status',
                    children: t(choiceCount === 0 ? 'empty.models' : 'search.empty'),
                  }),
                ],
              }),
              pane === 'effort' && effortChoices.map((level) => jsxs('button', {
                ref: itemRef(),
                type: 'button',
                role: 'menuitemradio',
                'aria-checked': effectiveEffort === level.effort,
                className: cx('dsh-sam-option', effectiveEffort === level.effort && 'dsh-sam-selected'),
                onClick: () => chooseEffort(level.effort),
                children: [
                  jsx('span', { className: 'dsh-sam-optionCopy', children: jsx('span', { className: 'dsh-sam-modelName', children: level.label }) }),
                  jsx('span', { className: 'dsh-sam-check', children: effectiveEffort === level.effort ? jsx(IconCheckOutlineRegular, {}) : null }),
                ],
              }, level.key)),
            ],
          }), document.body),
          toast !== null && jsx(Toast, {
            text: toast.text,
            icon: jsx(IconWarningOutlineRegular, {}),
            anchor: rootRef.current?.closest('[data-composer-card]') ?? null,
            onDone: () => setToast(null),
          }, toast.seq),
        ],
      })
    }

    /** Subagent views follow their top-level session, so the seat is absent there. */
    function SubagentModelSeat(props) {
      return props.available ? jsx(SubagentModelSelect, props) : null
    }

    const inject = ['slots', 'sessions', 'locale', 'modelDirectories']

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
          }
        },
      }, SubagentModelSeat))
    }

    return { name: ID, inject, apply }
  },
})
