/**
 * Client-half contract: the sidebar entry registers into the shipped
 * `sidebar.session.action` HOC seat, the Settings page edits the Host config
 * through the shared forms, and both surfaces follow the synced Host config.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(packageRoot, 'client.js'), 'utf8')
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))

const CONSOLE_URL = 'http://172.16.10.43:8980/platform/knowledge-bases'

/** Minimal React stand-in with a persistent per-render hook store. */
let hookIndex = 0
const hookStates = new Map()
const React = {
  Fragment: 'Fragment',
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState(init) {
    const slot = hookIndex++
    if (!hookStates.has(slot)) hookStates.set(slot, typeof init === 'function' ? init() : init)
    return [hookStates.get(slot), (next) => {
      hookStates.set(slot, typeof next === 'function' ? next(hookStates.get(slot)) : next)
    }]
  },
  useEffect: () => undefined,
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
  useId: () => 'dsh-weknora-test',
}

/** Evaluate client.js against a fake browser window and return its module. */
function loadDefinition() {
  const definitions = []
  const window = { __ModuleLoader__: { load: (definition) => { definitions.push(definition) } } }
  // The bundle is a plain browser script; evaluate it with its own `window`.
  new Function('window', source)(window)
  assert.equal(definitions.length, 1)
  return definitions[0]
}

/** Shared settings form stand-in, recording writes. */
function settingsService(options = {}) {
  const snapshot = {
    status: 'ready',
    value: options.value ?? {},
    base: undefined,
    user: undefined,
    revision: 1,
    writable: options.writable ?? true,
  }
  const describeSnapshot = {
    status: 'ready',
    error: null,
    view: {
      writable: options.writable ?? true,
      hasDocument: false,
      namespaces: [{ ns: 'weknora', secrets: options.secrets ?? [] }],
    },
  }
  const calls = { mutate: [], unset: [] }
  const form = {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    mutate: async (ops, revision) => { calls.mutate.push({ ops, revision }); return true },
    unset: async (field) => { calls.unset.push(field); return true },
  }
  const describe = {
    getSnapshot: () => describeSnapshot,
    subscribe: () => () => undefined,
    ensure: async () => undefined,
  }
  const service = {
    get: (ns) => {
      assert.equal(ns, 'weknora')
      return form
    },
    describe: () => describe,
    whileServed: (namespaces, register) => {
      assert.deepEqual(namespaces, ['weknora'])
      return register(new Set(['weknora']))
    },
  }
  return { service, calls, snapshot, form }
}

/** Cordis stand-in capturing what the plugin registers. */
function createContext(services = {}) {
  const registrations = []
  const dictionaries = {}
  const effects = []
  const settings = services.configForms ?? settingsService().service
  const context = {
    get: (name) => services[name],
    effect: (callback, label) => {
      effects.push(label)
      return callback()
    },
    locale: {
      register: (namespace, dicts) => {
        Object.assign(dictionaries, dicts)
        return () => undefined
      },
      bind: (namespace) => (key) => dictionaries.zh?.[key] ?? key,
    },
    slots: {
      inject: (name, callback) => callback(),
      register: (options, component) => {
        registrations.push({ options, component })
        return () => undefined
      },
    },
    configForms: settings,
  }
  return { context, registrations, effects, dictionaries }
}

/** The synced config the page receives: volatile fields are references. */
function syncedConfig(url = CONSOLE_URL) {
  return { consoleUrl: { get: () => url, subscribe: () => () => undefined } }
}

/** Load, apply, and return the captured registrations. */
function mount(services = {}, config = syncedConfig()) {
  const definition = loadDefinition()
  const plugin = definition.factory((name) => {
    assert.equal(name, 'react')
    return React
  })
  const created = createContext(services)
  plugin.apply(created.context, config)
  return created
}

/** Find one registration by slot name. */
function registrationOf(registrations, slotName) {
  return registrations.find(entry => entry.options.name === slotName)
}

/** Desktop bridge plus a mounted Session, as the shell provides them. */
function desktopServices() {
  const opened = []
  const services = {
    sidebarRightTabs: { get: (kind) => (kind === 'browser' ? { kind } : undefined) },
    sidebarRight: {
      mounted: { getSnapshot: () => 'session-1' },
      openTab: (kind, options) => { opened.push([kind, options]) },
    },
  }
  return { services, opened }
}

/** Click the wide entry once, without modifier keys. */
function clickWide(registration) {
  const link = registration.component({ wide: true, children: null }).children[2]
  let prevented = false
  link.props.onClick({ preventDefault: () => { prevented = true }, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })
  return { link, prevented }
}

/** Collect every element of a rendered tree. */
function collect(node, out = []) {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out)
    return out
  }
  if (node === null || node === undefined || typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children ?? []) collect(child, out)
  return out
}

/** Render the settings section and return helpers over its tree. */
function renderSettings(settings, props = {}) {
  hookIndex = 0
  hookStates.clear()
  const render = () => {
    hookIndex = 0
    return settings.component({ close: () => undefined, ...props })
  }
  const describe = (tree) => {
    const nodes = collect(tree)
    return {
      tree,
      nodes,
      byName: (name) => nodes.find(node => node.props?.name === name),
      form: nodes.find(node => node.type === 'form'),
    }
  }
  const first = describe(render())
  return { ...first, rerender: () => describe(render()) }
}

/** Submit the settings form with the given input values. */
function submit(form, values) {
  const elements = {}
  for (const [name, value] of Object.entries(values)) elements[name] = { value }
  return form.props.onSubmit({ preventDefault: () => undefined, currentTarget: { elements } })
}

test('client manifest points the loader at the sidebar build', () => {
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.dsh.client.immediately, true)
  assert.deepEqual(manifest.dsh.client.inject, ['@deepseek-ai/dsh-client-ui-sidebar'])
  assert.equal(manifest.exports['./client'], './client.js')
  assert.ok(manifest.files.includes('client.js'))
  assert.ok(manifest.files.includes('locale'))
})

test('the bundle keeps the host theme, avoids Harness Client modules, and carries no address', () => {
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(source), 'client.js must style with theme tokens only')
  assert.ok(!source.includes('@deepseek-ai/dsh-client-'), 'client.js must not import Harness Client packages')
  assert.ok(!source.includes('172.16.10.43'), 'addresses must come from the Host config, not this bundle')
})

test('apply registers the sidebar entry and the Settings page', () => {
  const definition = loadDefinition()
  assert.equal(definition.id, '@wxg-prc-cpg/dsh-weknora')
  const plugin = definition.factory(() => React)
  assert.deepEqual(plugin.inject, ['slots', 'locale', 'configForms'])

  const { context, registrations, effects, dictionaries } = createContext()
  plugin.apply(context, syncedConfig())
  const sidebar = registrationOf(registrations, 'sidebar.session.action')
  const settings = registrationOf(registrations, 'settings.section')
  assert.equal(sidebar.options.id, 'weknora-console-entry')
  assert.equal(settings.options.id, 'weknora')
  assert.equal(settings.options.order, 60)
  assert.equal(settings.options.label(), 'WeKnora')
  assert.deepEqual(effects, ['weknora: copy', 'weknora: sidebar entry', 'weknora: settings page'])
  assert.equal(dictionaries.en['entry.label'], 'Knowledge')
  assert.equal(dictionaries.zh['entry.label'], '知识库')
  assert.equal(dictionaries.zh['settings.save'], '保存')
})

test('without a synced consoleUrl the sidebar entry is skipped, the Settings page stays', () => {
  const { registrations } = mount({}, {})
  assert.equal(registrationOf(registrations, 'sidebar.session.action'), undefined)
  assert.ok(registrationOf(registrations, 'settings.section'))
})

test('an unset synced reference registers, then stays invisible until a value arrives', () => {
  const { registrations } = mount({}, { consoleUrl: { get: () => undefined, subscribe: () => () => undefined } })
  const sidebar = registrationOf(registrations, 'sidebar.session.action')
  assert.ok(sidebar)
  const child = { type: 'shipped-new-session' }
  assert.equal(sidebar.component({ wide: true, children: child }), child)
})

test('the wide entry keeps the New-session content and links to the configured console', () => {
  const { registrations } = mount()
  const sidebar = registrationOf(registrations, 'sidebar.session.action')
  const originalChild = { type: 'shipped-new-session' }
  const tree = sidebar.component({ wide: true, children: originalChild })
  assert.equal(tree.children[0], originalChild)

  const link = tree.children[2]
  assert.equal(link.type, 'a')
  assert.equal(link.props.href, CONSOLE_URL)
  assert.equal(link.props.target, '_blank')
  assert.equal(link.props.rel, 'noopener noreferrer')
  assert.match(link.props.className, /dsh-weknora-kb/)
  assert.ok(!/--rail/.test(link.props.className))
  assert.equal(link.props['aria-label'], '知识库')
  assert.equal(link.children[1].children[0], '知识库')
})

test('a plain resolved config value works too', () => {
  const { registrations } = mount({}, { consoleUrl: 'https://kb.example.com/platform/kb' })
  const sidebar = registrationOf(registrations, 'sidebar.session.action')
  const link = sidebar.component({ wide: true, children: null }).children[2]
  assert.equal(link.props.href, 'https://kb.example.com/platform/kb')
})

test('the rail entry collapses to an icon-only control', () => {
  const { registrations } = mount()
  const sidebar = registrationOf(registrations, 'sidebar.session.action')
  const tree = sidebar.component({ wide: false, children: null })
  const link = tree.children[2]
  assert.match(link.props.className, /dsh-weknora-kb--rail/)
  assert.equal(link.children[1], null)
  assert.equal(link.props.title, '在 DSH 内置浏览器中打开 WeKnora 知识库')
})

test('the Windows caption owns the collapsed rail, so the entry stays out of it', () => {
  const { registrations } = mount()
  const sidebar = registrationOf(registrations, 'sidebar.session.action')
  globalThis.document = { documentElement: { hasAttribute: (name) => name === 'data-windows-titlebar' } }
  try {
    const child = { type: 'shipped-new-session' }
    assert.equal(sidebar.component({ wide: false, children: child }), child)
    const wide = sidebar.component({ wide: true, children: child })
    assert.equal(wide.children.length, 3, 'the expanded sidebar still shows the entry')
  } finally {
    delete globalThis.document
  }
})

test('a click opens the configured console in the desktop built-in browser', () => {
  const { services, opened } = desktopServices()
  const created = mount(services)
  const sidebar = registrationOf(created.registrations, 'sidebar.session.action')

  globalThis.dshDesktop = { protocolVersion: 1, browser: {} }
  try {
    const { prevented } = clickWide(sidebar)
    assert.equal(prevented, true, 'the native new-window path must not also run')
    assert.deepEqual(opened, [['browser', { params: { url: CONSOLE_URL } }]])
  } finally {
    delete globalThis.dshDesktop
  }
})

test('without a mounted Session the link keeps its native new-window behavior', () => {
  const { services, opened } = desktopServices()
  services.sidebarRight.mounted.getSnapshot = () => undefined
  const created = mount(services)
  const sidebar = registrationOf(created.registrations, 'sidebar.session.action')

  globalThis.dshDesktop = { protocolVersion: 1, browser: {} }
  try {
    const { prevented } = clickWide(sidebar)
    assert.equal(prevented, false)
    assert.deepEqual(opened, [])
  } finally {
    delete globalThis.dshDesktop
  }
})

test('the Web build keeps its native new-window behavior', () => {
  const { services, opened } = desktopServices()
  const created = mount(services)
  const sidebar = registrationOf(created.registrations, 'sidebar.session.action')
  const { prevented } = clickWide(sidebar)
  assert.equal(prevented, false)
  assert.deepEqual(opened, [])
})

test('modified clicks keep their native browser meaning', () => {
  const { services, opened } = desktopServices()
  const created = mount(services)
  const sidebar = registrationOf(created.registrations, 'sidebar.session.action')

  globalThis.dshDesktop = { protocolVersion: 1, browser: {} }
  try {
    const link = sidebar.component({ wide: true, children: null }).children[2]
    let prevented = false
    link.props.onClick({ preventDefault: () => { prevented = true }, metaKey: false, ctrlKey: true, shiftKey: false, altKey: false })
    assert.equal(prevented, false)
    assert.deepEqual(opened, [])
  } finally {
    delete globalThis.dshDesktop
  }
})

test('the Settings page renders the live config with secret state', () => {
  const settings = settingsService({
    value: {
      baseUrl: 'http://api.example.com:8899/api/v1',
      consoleUrl: 'http://console.example.com:8980/platform/knowledge-bases',
      knowledgeBaseIds: ['kb-1'],
      resourceUrls: 'handle',
    },
    secrets: [{ path: ['apiKey'], set: true }],
  })
  const created = mount({ configForms: settings.service })
  const section = registrationOf(created.registrations, 'settings.section')
  const { byName, nodes } = renderSettings(section)

  assert.equal(byName('baseUrl').props.value, 'http://api.example.com:8899/api/v1')
  assert.equal(byName('consoleUrl').props.value, 'http://console.example.com:8980/platform/knowledge-bases')
  assert.equal(byName('knowledgeBaseIds').props.value, 'kb-1')
  assert.equal(byName('resourceUrls').props.value, 'handle')
  assert.equal(byName('apiKey').props.value, '')
  assert.equal(byName('apiKey').props.placeholder, '已设置，留空则保持不变')
  assert.ok(nodes.some(node => node.children?.includes('清除 Key')), 'a clear-key action is offered')
})

test('saving sends only the changed fields', async () => {
  const settings = settingsService({
    value: {
      baseUrl: 'https://old.example.com',
      consoleUrl: 'http://old.example.com:8980/platform/knowledge-bases',
      resourceUrls: 'public',
    },
  })
  const created = mount({ configForms: settings.service })
  const section = registrationOf(created.registrations, 'settings.section')
  const { form } = renderSettings(section)

  await submit(form, {
    baseUrl: 'https://new.example.com',
    apiKey: 'sk-new-key',
    tenantId: '',
    consoleUrl: '',
    knowledgeBaseIds: 'kb-1, kb-2',
    resourceUrls: 'handle',
  })

  assert.equal(settings.calls.mutate.length, 1)
  assert.equal(settings.calls.mutate[0].revision, 1)
  assert.deepEqual(settings.calls.mutate[0].ops, [
    { op: 'set', path: ['baseUrl'], value: 'https://new.example.com' },
    { op: 'unset', path: ['consoleUrl'] },
    { op: 'set', path: ['knowledgeBaseIds'], value: ['kb-1', 'kb-2'] },
    { op: 'set', path: ['resourceUrls'], value: 'handle' },
    { op: 'set', path: ['apiKey'], value: 'sk-new-key' },
  ])
})

test('an invalid URL is refused before any write', async () => {
  const settings = settingsService({ value: { baseUrl: 'https://old.example.com' } })
  const created = mount({ configForms: settings.service })
  const section = registrationOf(created.registrations, 'settings.section')
  const { form } = renderSettings(section)

  await submit(form, {
    baseUrl: 'ftp://bad.example.com',
    apiKey: '',
    tenantId: '',
    consoleUrl: '',
    knowledgeBaseIds: '',
    resourceUrls: 'public',
  })
  assert.deepEqual(settings.calls.mutate, [])
})

test('an empty API address is refused instead of silently unset', async () => {
  const settings = settingsService({ value: { baseUrl: 'https://kb.example.com' } })
  const created = mount({ configForms: settings.service })
  const section = registrationOf(created.registrations, 'settings.section')
  const { form } = renderSettings(section)

  await submit(form, {
    baseUrl: '   ',
    apiKey: '',
    tenantId: '',
    consoleUrl: '',
    knowledgeBaseIds: '',
    resourceUrls: 'public',
  })
  assert.deepEqual(settings.calls.mutate, [])
})

test('an unchanged form writes nothing', async () => {
  const settings = settingsService({
    value: { baseUrl: 'https://kb.example.com', resourceUrls: 'public', knowledgeBaseIds: [] },
  })
  const created = mount({ configForms: settings.service })
  const section = registrationOf(created.registrations, 'settings.section')
  const { form } = renderSettings(section)

  await submit(form, {
    baseUrl: 'https://kb.example.com',
    apiKey: '',
    tenantId: '',
    consoleUrl: '',
    knowledgeBaseIds: '',
    resourceUrls: 'public',
  })
  assert.deepEqual(settings.calls.mutate, [])
})

test('the clear-key action asks for confirmation, then unsets the stored secret', async () => {
  const settings = settingsService({ secrets: [{ path: ['apiKey'], set: true }] })
  const created = mount({ configForms: settings.service })
  const section = registrationOf(created.registrations, 'settings.section')
  const first = renderSettings(section)

  await first.nodes.find(node => node.children?.includes('清除 Key')).props.onClick()
  assert.deepEqual(settings.calls.unset, [], 'the first click only asks for confirmation')

  const second = first.rerender()
  assert.ok(second.nodes.some(node => String(node.children?.[0] ?? '').includes('再点一次')))
  await second.nodes.find(node => node.children?.includes('清除 Key')).props.onClick()
  assert.deepEqual(settings.calls.unset, ['apiKey'])
})
