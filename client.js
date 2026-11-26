/**
 * dsh-weknora client half.
 *
 * Two surfaces, both fed by the Host config:
 *  - a "Knowledge" entry on the sidebar's New-session row, opening the WeKnora
 *    console in the desktop shell's built-in browser (or externally);
 *  - a Settings page that edits the connection fields through DSH's shared
 *    configuration forms, so installing the plugin needs no YAML editing.
 *
 * Nothing here hardcodes a deployment address: `consoleUrl` arrives as a
 * synced volatile Host config field, and the Settings page reads and writes
 * the same form the framework exposes.
 */

window.__ModuleLoader__.load({
  id: '@wxg-prc-cpg/dsh-weknora',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin's client half. */
    const NS = 'dsh-weknora'
    /** Settings namespace: the profile patch row id the Host config belongs to. */
    const SETTINGS_NS = 'weknora'

    const DICTS = {
      en: {
        'entry.label': 'Knowledge',
        'entry.tooltip': 'Open the WeKnora knowledge base in DSH',
        'settings.nav': 'WeKnora',
        'settings.title': 'WeKnora knowledge base',
        'settings.intro': 'Connection used by the WeKnora tools and the sidebar entry. Saving applies immediately; clearing a field removes the override and falls back to the plugin default.',
        'settings.baseUrl': 'API address (baseUrl)',
        'settings.baseUrlHint': 'Required. WeKnora API root, with or without /api/v1.',
        'settings.baseUrlRequired': 'The API address is required.',
        'settings.apiKey': 'API key',
        'settings.apiKeySet': 'A key is set; leave blank to keep it',
        'settings.apiKeyUnset': 'No key set',
        'settings.apiKeyHint': 'Needs the retrieve capability; ask also needs chat. It stays on the Host and is never sent to the browser.',
        'settings.clearKey': 'Clear key',
        'settings.clearKeyConfirm': 'Click again to confirm clearing the stored key.',
        'settings.keyCleared': 'Stored API key cleared; a key supplied by the plugin default layer still applies.',
        'settings.tenantId': 'Workspace id (tenantId)',
        'settings.tenantIdHint': 'Only for platform-level keys; tenant keys leave it empty.',
        'settings.consoleUrl': 'Console address (consoleUrl)',
        'settings.consoleUrlHint': 'Page the sidebar entry opens. Leave it empty to hide the entry, e.g. http://host:8980/platform/knowledge-bases.',
        'settings.knowledgeBaseIds': 'Knowledge base ids',
        'settings.knowledgeBaseIdsHint': 'Optional comma-separated scope; empty searches every visible base.',
        'settings.resourceUrls': 'Cited file link mode',
        'settings.resourceUrlsHint': 'public returns direct image links; handle keeps internal resource:// references.',
        'settings.resourceUrlsPublic': 'public (direct links)',
        'settings.resourceUrlsHandle': 'handle (internal refs)',
        'settings.save': 'Save',
        'settings.saving': 'Saving…',
        'settings.saved': 'Saved.',
        'settings.unchanged': 'Nothing changed.',
        'settings.rejected': 'The host refused the change.',
        'settings.invalidBaseUrl': 'The API address must be a valid http(s) URL.',
        'settings.invalidConsoleUrl': 'The console address must be a valid http(s) URL.',
        'settings.unavailable': 'This plugin row is not configurable right now.',
        'settings.loading': 'Loading the current configuration…',
      },
      zh: {
        'entry.label': '知识库',
        'entry.tooltip': '在 DSH 内置浏览器中打开 WeKnora 知识库',
        'settings.nav': 'WeKnora',
        'settings.title': 'WeKnora 知识库',
        'settings.intro': 'WeKnora 工具与侧边栏入口使用的连接配置。保存后立即生效；清空某一项会移除覆盖值，回落到插件默认层。',
        'settings.baseUrl': 'API 地址（baseUrl）',
        'settings.baseUrlHint': '必填。WeKnora API 根地址，可带或不带 /api/v1。',
        'settings.baseUrlRequired': 'API 地址必填。',
        'settings.apiKey': 'API Key',
        'settings.apiKeySet': '已设置，留空则保持不变',
        'settings.apiKeyUnset': '未设置',
        'settings.apiKeyHint': '需要 retrieve 能力（ask 还需要 chat）。Key 只保存在宿主侧，不会发送到浏览器。',
        'settings.clearKey': '清除 Key',
        'settings.clearKeyConfirm': '再点一次确认清除已保存的 Key。',
        'settings.keyCleared': '已清除保存的 API Key；若插件默认层仍提供 Key，则继续生效。',
        'settings.tenantId': '空间 ID（tenantId）',
        'settings.tenantIdHint': '仅平台级 Key 需要；租户级 Key 留空。',
        'settings.consoleUrl': '控制台地址（consoleUrl）',
        'settings.consoleUrlHint': '侧边栏入口打开的页面；留空则隐藏侧边栏入口，例如 http://主机:8980/platform/knowledge-bases。',
        'settings.knowledgeBaseIds': '知识库范围',
        'settings.knowledgeBaseIdsHint': '可选，逗号分隔的知识库 id；留空表示检索该凭据可见的全部知识库。',
        'settings.resourceUrls': '引用文件链接方式',
        'settings.resourceUrlsHint': 'public 返回可直接加载的图片直链；handle 保留内部 resource:// 引用。',
        'settings.resourceUrlsPublic': 'public（直链）',
        'settings.resourceUrlsHandle': 'handle（内部引用）',
        'settings.save': '保存',
        'settings.saving': '保存中…',
        'settings.saved': '已保存。',
        'settings.unchanged': '没有修改。',
        'settings.rejected': '宿主拒绝了这次修改。',
        'settings.invalidBaseUrl': 'API 地址必须是合法的 http(s) URL。',
        'settings.invalidConsoleUrl': '控制台地址必须是合法的 http(s) URL。',
        'settings.unavailable': 'WeKnora 插件行当前不可配置。',
        'settings.loading': '正在读取当前配置…',
      },
    }

    // Sidebar entry, styled after the sidebar's own New-session control (38px
    // row, same border, radius and fill) so it reads as part of the sidebar.
    // Only theme tokens are used, so light/dark, the macOS sidebar glass and
    // the host's focus ring all follow the host theme.
    const ENTRY_CSS = [
      '.dsh-weknora-kb{display:inline-flex;align-items:center;justify-content:center;gap:6px;',
      'flex:none;height:38px;padding:0 12px;box-sizing:border-box;',
      'border:0.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);',
      'background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);',
      'font-family:inherit;font-size:14px;font-weight:500;line-height:22px;',
      'text-decoration:none;white-space:nowrap;cursor:pointer;-webkit-app-region:no-drag;}',
      '@media (hover:hover){.dsh-weknora-kb:hover{background:var(--dsw-alias-button-floating-hover);}}',
      // The host's global :focus-visible rule owns the ring color and width;
      // only the gap from the border is ours.
      '.dsh-weknora-kb:focus-visible{outline-offset:2px;}',
      // 56px rail: the same transparent 36px control the shipped New-session
      // button becomes, with the primary ink and md radius the rail uses.
      '.dsh-weknora-kb--rail{width:36px;height:36px;padding:0;border-color:transparent;background:transparent;}',
      '@media (hover:hover){.dsh-weknora-kb--rail:hover{background:var(--dsw-alias-interactive-bg-hover);}}',
      // macOS keeps vibrancy behind the sidebar; the solid fill would fight it.
      "html[data-platform='darwin'] .dsh-weknora-kb:not(.dsh-weknora-kb--rail){",
      'background:var(--dsw-specific-sidebar-glass-fill);}',
      "@media (hover:hover){html[data-platform='darwin'] .dsh-weknora-kb:not(.dsh-weknora-kb--rail):hover{",
      'background:var(--dsw-specific-sidebar-glass-hover);}}',
    ].join('')

    // Settings page, built from the same row rhythm as shipped sections
    // (16px rows, 13–14px labels, 12px secondary hints) with host theme tokens.
    const SETTINGS_CSS = [
      '.dsh-weknora-settings{display:flex;flex-direction:column;gap:16px;width:100%;padding:8px 0 24px;',
      'box-sizing:border-box;font-family:inherit;color:var(--dsw-alias-label-primary);}',
      '.dsh-weknora-intro{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-weknora-form{display:flex;flex-direction:column;gap:16px;margin:0;}',
      '.dsh-weknora-row{display:flex;flex-direction:column;gap:6px;}',
      '.dsh-weknora-label{font-size:13px;line-height:20px;font-weight:500;}',
      '.dsh-weknora-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);}',
      '.dsh-weknora-input,.dsh-weknora-select{width:100%;height:36px;padding:0 10px;box-sizing:border-box;',
      'border:0.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);',
      'background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);',
      'font-family:inherit;font-size:13px;line-height:20px;outline-offset:2px;}',
      '.dsh-weknora-input:disabled,.dsh-weknora-select:disabled{opacity:.6;cursor:default;}',
      '.dsh-weknora-select{cursor:pointer;}',
      '.dsh-weknora-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}',
      '.dsh-weknora-button{height:32px;padding:0 14px;display:inline-flex;align-items:center;',
      'border:0.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);',
      'background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);',
      'font-family:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer;}',
      '@media (hover:hover){.dsh-weknora-button:hover{background:var(--dsw-alias-button-floating-hover);}}',
      '.dsh-weknora-button--primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);',
      'color:var(--dsw-alias-label-primary-foreground);}',
      '@media (hover:hover){.dsh-weknora-button--primary:hover{background:var(--dsw-alias-button-primary-hover);}}',
      '.dsh-weknora-button:disabled{opacity:.5;cursor:default;}',
      '.dsh-weknora-status{margin:0;font-size:12px;line-height:18px;}',
      '.dsh-weknora-status--saved{color:var(--dsw-alias-state-success-primary);}',
      '.dsh-weknora-status--error{color:var(--dsw-alias-state-error-primary);}',
      '.dsh-weknora-status--unchanged{color:var(--dsw-alias-label-secondary);}',
    ].join('')

    /** Accept only a usable http(s) absolute address. */
    function normalizeConsoleUrl(value) {
      if (typeof value !== 'string') return undefined
      const trimmed = value.trim()
      if (trimmed === '') return undefined
      try {
        const parsed = new URL(trimmed)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined
      } catch {
        return undefined
      }
    }

    /**
     * Read one synced config field. The page receives every volatile Host field
     * as a reference (`get()`); a plain resolved config keeps a plain value.
     * @param field - the activation config's field, reference or plain value.
     * @returns the console address, or undefined while it is not configured.
     */
    function readConsoleUrl(field) {
      if (field === null || field === undefined) return undefined
      try {
        return normalizeConsoleUrl(typeof field.get === 'function' ? field.get() : field)
      } catch {
        return undefined
      }
    }

    /** Subscribe a component to one observable snapshot source. */
    function useObservable(source) {
      return React.useSyncExternalStore(
        (listener) => source.subscribe(listener),
        () => source.getSnapshot(),
      )
    }

    /**
     * Follow the synced reference so a config edit reaches the button without
     * re-activating the plugin. A plain value never changes, so it is read once.
     * @param field - the activation config's `consoleUrl` field.
     * @returns the current console address, or undefined while unset.
     */
    function useConsoleUrl(field) {
      const [url, setUrl] = React.useState(() => readConsoleUrl(field))
      React.useEffect(() => {
        if (field === null || typeof field !== 'object' || typeof field.subscribe !== 'function') return undefined
        return field.subscribe(() => { setUrl(readConsoleUrl(field)) })
      }, [field])
      return url
    }

    /**
     * Windows desktop hosts the New-session control in the native caption while
     * the sidebar is collapsed; the rail has no room for a second control
     * there, so the entry stays out of that state instead of colliding with
     * the caption.
     */
    function captionOwnsRail() {
      return typeof document !== 'undefined'
        && document.documentElement.hasAttribute('data-windows-titlebar')
    }

    /**
     * Open the console in the desktop shell's built-in browser: the right
     * sidebar's Browser tab, which the desktop renders as an Electron webview
     * (the Web build renders it as an iframe, and a console that sends
     * `X-Frame-Options: SAMEORIGIN` is not usable there).
     *
     * The tab is per Session, so this needs a Session on screen. Everything
     * else — the Web build, no matching bridge, no Session, or a Session whose
     * surface is not mounted — returns false so the link keeps its native
     * new-window behavior.
     *
     * @param ctx - this plugin's client context.
     * @param url - console address from the Host config.
     * @returns whether the built-in browser took the request.
     */
    function openInBuiltInBrowser(ctx, url) {
      const carrier = globalThis.dshDesktop
      if (carrier?.protocolVersion !== 1 || carrier.browser === undefined) return false
      try {
        const tabs = ctx.get('sidebarRightTabs')
        const right = ctx.get('sidebarRight')
        if (tabs === undefined || right === undefined || tabs.get('browser') === undefined) return false
        if (right.mounted.getSnapshot() === undefined) return false
        right.openTab('browser', { params: { url } })
        return true
      } catch {
        // The service refuses a write with no mounted surface; the link below
        // then opens the console the ordinary way.
        return false
      }
    }

    /** A closed book, drawn as strokes so it stays legible at 16–18px. */
    function BookIcon(props) {
      return h('svg', {
        width: props.size,
        height: props.size,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      h('path', { d: 'M3.2 2.7h7.6a1.5 1.5 0 0 1 1.5 1.5v9.1H4.7a1.5 1.5 0 0 1-1.5-1.5V2.7Z' }),
      h('path', { d: 'M3.2 11.5a1.5 1.5 0 0 1 1.5-1.5h7.6' }),
      h('path', { d: 'M5.8 5.2h4.4M5.8 7.6h3.2' }),
      )
    }

    /**
     * The entry appended to the New-session row. Because the slot anchor is
     * `display: contents`, these nodes become direct children of the row: in
     * the wide sidebar they sit beside the New-session button, and in the 56px
     * rail the button degrades to an icon below the rail's New-session icon.
     *
     * A plain `target="_blank"` link stays the fallback (and the modifier-key
     * path): the desktop shell routes http(s) popups to the system browser, and
     * the Web build opens a tab, so Enter, middle-click and modified clicks
     * keep their native meaning.
     */
    function KnowledgeBaseEntry(props) {
      const url = useConsoleUrl(props.consoleField)
      const wide = props.wide === true
      const t = props.t
      if (url === undefined) return props.children
      if (!wide && captionOwnsRail()) return props.children
      const label = t('entry.label')
      return h(React.Fragment, null,
        props.children,
        h('style', { key: 'style' }, ENTRY_CSS),
        h('a', {
          key: 'entry',
          className: wide ? 'dsh-weknora-kb' : 'dsh-weknora-kb dsh-weknora-kb--rail',
          href: url,
          target: '_blank',
          rel: 'noopener noreferrer',
          title: t('entry.tooltip'),
          'aria-label': label,
          onClick: (event) => {
            // Modified clicks mean "open it the browser way", not "in the panel".
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            props.onOpen(event, url)
          },
        },
        h(BookIcon, { size: wide ? 16 : 18 }),
        wide ? h('span', null, label) : null),
      )
    }

    /** Split a comma/space separated id list, including full-width separators. */
    function parseIds(raw) {
      return String(raw ?? '').split(/[,\s，；;、]+/).map(entry => entry.trim()).filter(entry => entry !== '')
    }

    /** Whether two id lists carry the same ids in the same order. */
    function sameIds(left, right) {
      return left.length === right.length && left.every((id, index) => id === right[index])
    }

    /**
     * Fields the Settings page provides, as `{ op }` edits for the shared form.
     * Empty text clears an override (it re-inherits the profile layer); a new
     * API key is only ever written, never restated from a read.
     *
     * @param values - the submitted input values.
     * @param current - the effective form values read before editing.
     * @returns ordered path operations accepted by `form.mutate`.
     */
    function buildConfigOps(values, current) {
      const ops = []
      const existing = key => (current === undefined ? undefined : current[key])
      const text = (key, raw) => {
        const next = String(raw ?? '').trim()
        const before = existing(key)
        if (next === '') {
          if (before !== undefined) ops.push({ op: 'unset', path: [key] })
          return
        }
        if (next !== before) ops.push({ op: 'set', path: [key], value: next })
      }
      text('baseUrl', values.baseUrl)
      text('tenantId', values.tenantId)
      text('consoleUrl', values.consoleUrl)
      const ids = parseIds(values.knowledgeBaseIds)
      const beforeIds = Array.isArray(existing('knowledgeBaseIds')) ? existing('knowledgeBaseIds') : []
      if (!sameIds(ids, beforeIds)) {
        if (ids.length === 0) ops.push({ op: 'unset', path: ['knowledgeBaseIds'] })
        else ops.push({ op: 'set', path: ['knowledgeBaseIds'], value: ids })
      }
      const resourceUrls = String(values.resourceUrls ?? '')
      if (resourceUrls !== '' && resourceUrls !== (existing('resourceUrls') ?? 'public')) {
        ops.push({ op: 'set', path: ['resourceUrls'], value: resourceUrls })
      }
      const apiKey = String(values.apiKey ?? '').trim()
      if (apiKey !== '') ops.push({ op: 'set', path: ['apiKey'], value: apiKey })
      return ops
    }

    /**
     * Validate the connection fields client-side so a typo never becomes a
     * stored config the Host cannot serve. The API address is required because
     * clearing it would silently repoint the tools at the plugin default.
     * @param values - the submitted input values.
     * @returns the offending field and its message key, or undefined when valid.
     */
    function validateConfig(values) {
      if (String(values.baseUrl ?? '').trim() === '') {
        return { field: 'baseUrl', key: 'settings.baseUrlRequired' }
      }
      for (const field of ['baseUrl', 'consoleUrl']) {
        const raw = String(values[field] ?? '').trim()
        if (raw === '') continue
        let parsed
        try {
          parsed = new URL(raw)
        } catch {
          return { field, key: field === 'baseUrl' ? 'settings.invalidBaseUrl' : 'settings.invalidConsoleUrl' }
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { field, key: field === 'baseUrl' ? 'settings.invalidBaseUrl' : 'settings.invalidConsoleUrl' }
        }
      }
      return undefined
    }

    /** Initial control values for one effective config snapshot. */
    function draftsOf(value) {
      return {
        baseUrl: value.baseUrl ?? '',
        apiKey: '',
        tenantId: value.tenantId ?? '',
        consoleUrl: value.consoleUrl ?? '',
        knowledgeBaseIds: Array.isArray(value.knowledgeBaseIds) ? value.knowledgeBaseIds.join(', ') : '',
        resourceUrls: value.resourceUrls ?? 'public',
      }
    }

    /**
     * The Settings page: one form over the Host's `weknora` config section.
     * Controls are seeded from the live effective values and reseeded whenever
     * the form's revision moves, so an external change is visible instead of
     * being silently overwritten by a later save. Saving sends only the fields
     * the user changed, fenced by the revision the values were read at.
     */
    function WeknoraSettingsPage(props) {
      const t = props.t
      const form = props.form
      const snapshot = useObservable(form)
      const describe = useObservable(props.describe)
      const prefix = React.useId()
      const [draft, setDraft] = React.useState(() => draftsOf(snapshot.value ?? {}))
      const [status, setStatus] = React.useState('idle')
      const [message, setMessage] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [confirmClear, setConfirmClear] = React.useState(false)
      const revision = snapshot.revision
      React.useEffect(() => {
        setDraft(draftsOf(snapshot.value ?? {}))
        setConfirmClear(false)
      }, [revision])

      const namespace = describe?.view?.namespaces?.find(row => row.ns === SETTINGS_NS)
      const secretSet = Array.isArray(namespace?.secrets)
        && namespace.secrets.some(secret => secret.set && secret.path.length === 1 && secret.path[0] === 'apiKey')
      const value = snapshot.value ?? {}
      const writable = snapshot.writable === true
      const ready = snapshot.status === 'ready'
      const disabled = !writable || saving
      const fieldId = name => `${prefix}-${name}`
      const hintId = name => `${prefix}-${name}-hint`

      const row = (name, label, hint, control) => h('div', { className: 'dsh-weknora-row', key: name },
        h('label', { className: 'dsh-weknora-label', htmlFor: fieldId(name) }, label),
        control,
        h('p', { className: 'dsh-weknora-hint', id: hintId(name) }, hint),
      )

      const textInput = (name, props2 = {}) => h('input', {
        id: fieldId(name),
        className: 'dsh-weknora-input',
        name,
        type: 'text',
        value: draft[name],
        onChange: (event) => { setDraft(current => ({ ...current, [name]: event.target.value })) },
        'aria-describedby': hintId(name),
        disabled,
        spellCheck: false,
        autoComplete: 'off',
        ...props2,
      })

      const onSave = async (event) => {
        event.preventDefault()
        if (saving) return
        const elements = event.currentTarget?.elements
        const values = elements === undefined ? draft : {
          baseUrl: elements.baseUrl.value,
          apiKey: elements.apiKey.value,
          tenantId: elements.tenantId.value,
          consoleUrl: elements.consoleUrl.value,
          knowledgeBaseIds: elements.knowledgeBaseIds.value,
          resourceUrls: elements.resourceUrls.value,
        }
        const invalid = validateConfig(values)
        if (invalid !== undefined) {
          setStatus('error')
          setMessage(t(invalid.key))
          if (typeof document !== 'undefined') {
            const element = document.getElementById(fieldId(invalid.field))
            if (element !== null) element.focus()
          }
          return
        }
        const ops = buildConfigOps(values, value)
        if (ops.length === 0) {
          setStatus('unchanged')
          setMessage(t('settings.unchanged'))
          return
        }
        setSaving(true)
        try {
          const accepted = await form.mutate(ops, revision)
          setStatus(accepted ? 'saved' : 'error')
          setMessage(accepted ? t('settings.saved') : t('settings.rejected'))
        } catch (cause) {
          setStatus('error')
          setMessage(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setSaving(false)
        }
      }

      const onClearKey = async () => {
        if (saving) return
        if (!confirmClear) {
          setConfirmClear(true)
          setStatus('unchanged')
          setMessage(t('settings.clearKeyConfirm'))
          return
        }
        setSaving(true)
        try {
          const accepted = await form.unset('apiKey')
          setStatus(accepted ? 'saved' : 'error')
          setMessage(accepted ? t('settings.keyCleared') : t('settings.rejected'))
          if (accepted) {
            setDraft(current => ({ ...current, apiKey: '' }))
            setConfirmClear(false)
          }
        } catch (cause) {
          setStatus('error')
          setMessage(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setSaving(false)
        }
      }

      return h('div', { className: 'dsh-weknora-settings' },
        h('style', { key: 'style' }, SETTINGS_CSS),
        h('p', { className: 'dsh-weknora-intro' }, t('settings.intro')),
        writable ? null : h('p', { className: 'dsh-weknora-hint' }, t(ready ? 'settings.unavailable' : 'settings.loading')),
        h('form', { className: 'dsh-weknora-form', onSubmit: onSave, noValidate: true },
          row('baseUrl', t('settings.baseUrl'), t('settings.baseUrlHint'),
            textInput('baseUrl', { placeholder: 'http://localhost:8080/api/v1', required: true })),
          row('apiKey', t('settings.apiKey'), t('settings.apiKeyHint'), h('input', {
            id: fieldId('apiKey'),
            className: 'dsh-weknora-input',
            name: 'apiKey',
            type: 'password',
            value: draft.apiKey,
            onChange: (event) => { setDraft(current => ({ ...current, apiKey: event.target.value })) },
            'aria-describedby': hintId('apiKey'),
            placeholder: secretSet ? t('settings.apiKeySet') : t('settings.apiKeyUnset'),
            disabled,
            autoComplete: 'new-password',
          })),
          row('tenantId', t('settings.tenantId'), t('settings.tenantIdHint'),
            textInput('tenantId', { placeholder: '' })),
          row('consoleUrl', t('settings.consoleUrl'), t('settings.consoleUrlHint'),
            textInput('consoleUrl', { placeholder: 'http://localhost:8980/platform/knowledge-bases' })),
          row('knowledgeBaseIds', t('settings.knowledgeBaseIds'), t('settings.knowledgeBaseIdsHint'),
            textInput('knowledgeBaseIds', { placeholder: 'kb-1, kb-2' })),
          row('resourceUrls', t('settings.resourceUrls'), t('settings.resourceUrlsHint'), h('select', {
            id: fieldId('resourceUrls'),
            className: 'dsh-weknora-select',
            name: 'resourceUrls',
            value: draft.resourceUrls,
            onChange: (event) => { setDraft(current => ({ ...current, resourceUrls: event.target.value })) },
            'aria-describedby': hintId('resourceUrls'),
            disabled,
          },
          h('option', { value: 'public' }, t('settings.resourceUrlsPublic')),
          h('option', { value: 'handle' }, t('settings.resourceUrlsHandle')))),
          h('div', { className: 'dsh-weknora-actions' },
            h('button', { type: 'submit', className: 'dsh-weknora-button dsh-weknora-button--primary', disabled }, t('settings.save')),
            secretSet
              ? h('button', { type: 'button', className: 'dsh-weknora-button', onClick: onClearKey, disabled }, t('settings.clearKey'))
              : null,
            status === 'idle'
              ? null
              : h('p', {
                className: `dsh-weknora-status dsh-weknora-status--${status}`,
                role: 'status',
                'aria-live': 'polite',
              }, saving ? t('settings.saving') : message)),
        ),
      )
    }

    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx, config) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, DICTS), 'weknora: copy')

        // Sidebar entry: register whenever the Host syncs the config (the
        // console URL may legitimately arrive later from the Settings page).
        const field = config !== null && typeof config === 'object' ? config.consoleUrl : undefined
        const reference = field !== null && typeof field === 'object' && typeof field.get === 'function'
        if (reference || readConsoleUrl(field) !== undefined) {
          const onOpen = (event, url) => {
            if (openInBuiltInBrowser(ctx, url)) event.preventDefault()
          }
          ctx.effect(() => ctx.slots.inject('sidebar.session.action', () => ctx.slots.register({
            name: 'sidebar.session.action',
            id: 'weknora-console-entry',
          }, (props) => KnowledgeBaseEntry({ ...props, t, consoleField: field, onOpen }))), 'weknora: sidebar entry')
        }

        // Settings page: edit the same config row through the shared forms.
        const form = ctx.configForms.get(SETTINGS_NS)
        const describe = ctx.configForms.describe()
        ctx.effect(() => ctx.configForms.whileServed([SETTINGS_NS], () => ctx.slots.inject('settings.section', () =>
          ctx.slots.register({
            name: 'settings.section',
            id: 'weknora',
            order: 60,
            label: () => t('settings.nav'),
            locale: NS,
          }, (props) => WeknoraSettingsPage({ ...props, t, form, describe })))), 'weknora: settings page')
      },
    }
  },
})
