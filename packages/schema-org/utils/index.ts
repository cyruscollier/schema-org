import { hasProtocol, joinURL, withBase } from 'ufo'
import { defu } from 'defu'
import type { DeepPartial } from 'utility-types'
import type { Arrayable, Id, IdReference, SchemaNode, SchemaNodeInput } from './types'
import type { SchemaOrgClient } from './createSchemaOrg'
import { useSchemaOrg } from './useSchemaOrg'
import { resolveImages } from './shared/resolveImages'

export const idReference = (node: SchemaNode|string) => ({
  '@id': typeof node !== 'string' ? node['@id'] : node,
})

export const resolveDateToIso = (val: Date|string) => {
  if (val instanceof Date)
    return val.toISOString()
  else
    return new Date(Date.parse(val)).toISOString()
}

export const IdentityId = '#identity'

export const setIfEmpty = <T extends SchemaNode|SchemaNodeInput<SchemaNode>>(node: T, field: keyof T, value: any) => {
  if (!node?.[field])
    node[field] = value
}

type ResolverInput<T extends SchemaNode = SchemaNode> = SchemaNodeInput<T> | IdReference | string

export const isIdReference = (input: ResolverInput) =>
  typeof input !== 'string' && Object.keys(input).length === 1 && input['@id']

export interface ResolverOptions {
  /**
   * Return single images as an object
   */
  array?: boolean
}

export function resolver<
  Input extends SchemaNodeInput<any> | string = SchemaNodeInput<any>,
  Output extends Input = Input>(input: Arrayable<Input>,
  fn: (node: Exclude<Input, IdReference>, client: SchemaOrgClient) => Input,
  options: ResolverOptions = {},
):
  Arrayable<Output | IdReference> {
  const client = injectSchemaOrg()
  const ids = (Array.isArray(input) ? input : [input]).map((a) => {
    // filter out id references
    if (isIdReference(a))
      return a as IdReference
    return fn(a as Exclude<Input, IdReference>, client)
  }) as Arrayable<Exclude<Input, string>>
  // avoid arrays for single entries
  if (!options.array && ids.length === 1)
    return ids[0]
  return ids
}

export const includesType = <T extends SchemaNodeInput<any>>(node: T, type: string) => {
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']]
  return types.includes(type)
}

export const prefixId = (url: string, id: Id) => {
  // already prefixed
  if (hasProtocol(id))
    return url as Id
  if (!id.startsWith('#'))
    id = `#${id}`
  return joinURL(url, id) as Id
}

export const trimLength = (val: string, length: number) => {
  if (val.length > length) {
    const trimmedString = val.substring(0, length)
    return trimmedString.substring(0, Math.min(trimmedString.length, trimmedString.lastIndexOf(' ')))
  }
  return val
}

export const resolveType = (val: Arrayable<string>, defaultType: Arrayable<string>) => {
  if (val === defaultType)
    return val
  const types = new Set<string>([
    ...(Array.isArray(defaultType) ? defaultType : [defaultType]),
    ...(Array.isArray(val) ? val : [val]),
  ])
  return types.size === 1 ? val : [...types.values()]
}

export const resolveWithBaseUrl = (base: string, urlOrPath: string) => {
  // can't apply base if there's a protocol
  if (!urlOrPath || hasProtocol(urlOrPath) || (!urlOrPath.startsWith('/') && !urlOrPath.startsWith('#')))
    return urlOrPath
  return withBase(urlOrPath, base)
}

export const resolveUrl = <T extends SchemaNode>(node: T, key: keyof T, prefix: string) => {
  if (node[key] && typeof node[key] === 'string')
    // @ts-expect-error untyped
    node[key] = resolveWithBaseUrl(prefix, node[key])
}

export const resolveId = <T extends SchemaNodeInput<any>>(node: T, prefix: string) => {
  if (node['@id'])
    node['@id'] = resolveWithBaseUrl(prefix, node['@id']) as Id
}

export const resolveRawId = <T extends SchemaNode>(node: T) => node['@id'].substring(node['@id'].lastIndexOf('#')) as Id

/**
 * Removes attributes which have a null or undefined value
 */
export const cleanAttributes = (obj: any) => {
  Object.keys(obj).forEach((k) => {
    if (obj[k] && typeof obj[k] === 'object') {
      cleanAttributes(obj[k])
      return
    }
    if (obj[k] === '' || obj[k] === null || typeof obj[k] === 'undefined')
      delete obj[k]
  })
  return obj
}

export const callAsPartial = <T extends (...args: any) => any>(fn: T, data: any): ReturnType<T> => fn(data || {}, { strategy: 'patch' })

export const resolveRouteMeta = <T extends SchemaNodeInput<any> = SchemaNodeInput<any>>(defaults: T, routeMeta: Record<string, unknown>, keys: (keyof T)[]) => {
  if (typeof routeMeta.title === 'string') {
    if (keys.includes('headline'))
      setIfEmpty(defaults, 'headline', routeMeta.title)

    if (keys.includes('name'))
      setIfEmpty(defaults, 'name', routeMeta.title)
  }
  if (typeof routeMeta.description === 'string' && keys.includes('description'))
    setIfEmpty(defaults, 'description', routeMeta.description)

  if (typeof routeMeta.image === 'string' && keys.includes('image'))
    setIfEmpty(defaults, 'image', routeMeta.image)

  if (keys.includes('dateModified') && (typeof routeMeta.dateModified === 'string' || routeMeta.dateModified instanceof Date))
    setIfEmpty(defaults, 'dateModified', routeMeta.dateModified)

  if (keys.includes('datePublished') && (typeof routeMeta.datePublished === 'string' || routeMeta.datePublished instanceof Date))
    setIfEmpty(defaults, 'datePublished', routeMeta.datePublished)
  // video
  if (keys.includes('uploadDate') && (typeof routeMeta.datePublished === 'string' || routeMeta.datePublished instanceof Date))
    setIfEmpty(defaults, 'uploadDate', routeMeta.datePublished)
}

export interface NodeResolverInput<Input, Resolved> {
  defaults?: DeepPartial<Resolved>|((client: SchemaOrgClient) => DeepPartial<Resolved>)
  required?: (keyof Resolved)[]
  resolve?: (node: Input, client: SchemaOrgClient) => Input|Resolved
  mergeRelations?: (node: Resolved, client: SchemaOrgClient) => void
}

export interface NodeResolverOptions {
  strategy: 'patch'|'replace'
}

export interface ResolvedNodeResolver<Input extends SchemaNodeInput<any>, ResolvedInput extends SchemaNodeInput<any> = Input> {
  resolve: () => ResolvedInput
  nodePartial: Input
  options: NodeResolverOptions
  resolveId: () => ResolvedInput['@id']
  definition: NodeResolverInput<Input, ResolvedInput>
}

export function defineNodeResolver<Input extends SchemaNodeInput<SchemaNode>, ResolvedInput extends SchemaNode>(
  nodePartial: Input,
  definition: NodeResolverInput<Input, ResolvedInput>,
  options?: NodeResolverOptions,
): ResolvedNodeResolver<Input, ResolvedInput> {
  // avoid duplicate resolves
  options = defu(options || {}, {
    strategy: 'replace',
  }) as NodeResolverOptions
  let _resolved: ResolvedInput|null = null
  const nodeResolver = {
    nodePartial,
    options,
    definition,
    resolve() {
      if (_resolved)
        return _resolved
      const client = useSchemaOrg()
      // resolve defaults
      let defaults = definition?.defaults || {}
      if (typeof defaults === 'function')
        defaults = defaults(client)
      // defu user input with defaults
      const unresolvedNode = defu(nodePartial, defaults) as unknown as Input
      if (unresolvedNode.image) {
        unresolvedNode.image = resolveImages(unresolvedNode.image, {
          resolvePrimaryImage: true,
          asRootNodes: true,
        })
      }
      let resolvedNode: ResolvedInput|null = null
      // allow the node to resolve itself
      if (definition.resolve)
        resolvedNode = definition.resolve(unresolvedNode, client) as ResolvedInput
      return _resolved = cleanAttributes(resolvedNode ?? unresolvedNode)
    },
    resolveId() {
      return nodeResolver.resolve()['@id']
    },
  }
  return nodeResolver
}