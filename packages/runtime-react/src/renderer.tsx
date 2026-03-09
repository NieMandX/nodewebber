import React from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { normalizeThemeValue } from '@procedural-web-composer/shared-utils'
import type { UiNode } from '@procedural-web-composer/ui-tree'
import type {
  GraphEventRuntime,
  PresentationRuntime,
  ThemeValue,
} from '@procedural-web-composer/shared-types'
import { GraphEventProvider, useGraphEventController } from './graph-events'
import {
  isUiNodeVisibleForPresentationStep,
  PresentationControls,
  PresentationProvider,
  usePresentationController,
} from './presentation'
import { ViewerBlockRenderer, ViewerOverlayRenderer } from './viewer-renderer'

export interface PreviewRendererProps {
  root: UiNode | null
  emptyMessage?: string
  eventRuntime: GraphEventRuntime | undefined
  presentationRuntime: PresentationRuntime | undefined
  embedded?: boolean
}

export function PreviewRenderer(props: PreviewRendererProps): ReactNode {
  if (!props.root) {
    return (
      <div style={emptyStateStyle}>
        <strong>No renderable page</strong>
        <span>{props.emptyMessage ?? 'Connect a page node to content to see a preview.'}</span>
      </div>
    )
  }

  return (
    <GraphEventProvider eventRuntime={props.eventRuntime}>
      <PresentationProvider presentationRuntime={props.presentationRuntime}>
        <div style={{ display: 'grid', gap: '16px' }}>
          {renderUiTree(props.root, { embedded: props.embedded })}
          <PresentationControls />
        </div>
      </PresentationProvider>
    </GraphEventProvider>
  )
}

export function renderUiTree(
  node: UiNode,
  options?: {
    embedded: boolean | undefined
  },
): ReactNode {
  return <UiNodeRenderer node={node} embedded={options?.embedded} />
}

function UiNodeRenderer(props: {
  node: UiNode
  embedded: boolean | undefined
}): ReactNode {
  const presentation = usePresentationController()
  const node = props.node

  if (!isUiNodeVisibleForPresentationStep(node, presentation?.activeStep)) {
    return null
  }

  if (node.kind === 'Fragment') {
    return <>{renderChildren(node.children, props.embedded)}</>
  }

  if (node.kind === 'Page') {
    const theme = normalizeThemeValue(node.props.theme as ThemeValue | undefined)
    const pageStyles = toCssProperties(node.styles)

    if (props.embedded) {
      delete pageStyles.minHeight
    }

    const outerStyle = {
      ...pageStyles,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
      boxSizing: 'border-box',
      width: '100%',
    } as CSSProperties & Record<string, string>

    outerStyle['--pwc-bg'] = theme.colors.background
    outerStyle['--pwc-surface'] = theme.colors.surface
    outerStyle['--pwc-text'] = theme.colors.text
    outerStyle['--pwc-accent'] = theme.colors.accent
    outerStyle['--pwc-font'] = theme.typography.fontFamily

    return (
      <div key={node.id} className="pwc-page-root" style={outerStyle}>
        <div
          style={{
            maxWidth: formatMaxWidth(node.props.maxWidth),
            margin: '0 auto',
            width: '100%',
            display: 'grid',
            gap: '24px',
          }}
        >
          {renderChildren(node.children, props.embedded)}
        </div>
      </div>
    )
  }

  if (node.kind === 'Section') {
    return (
      <section key={node.id} style={sectionStyle(node)}>
        {renderChildren(node.children, props.embedded)}
      </section>
    )
  }

  if (node.kind === 'Stack') {
    return (
      <div key={node.id} style={stackStyle(node)}>
        {renderChildren(node.children, props.embedded)}
      </div>
    )
  }

  if (node.kind === 'Shell') {
    const headerChildren = node.slots?.header ?? []
    const bodyChildren = [...(node.slots?.body ?? []), ...node.children]
    const footerChildren = node.slots?.footer ?? []

    return (
      <div
        key={node.id}
        style={{
          ...toCssProperties(node.styles),
          display: 'grid',
          gap: '20px',
        }}
      >
        {headerChildren.length > 0 ? (
          <header>{renderChildren(headerChildren, props.embedded)}</header>
        ) : null}
        <main>{renderChildren(bodyChildren, props.embedded)}</main>
        {footerChildren.length > 0 ? (
          <footer>{renderChildren(footerChildren, props.embedded)}</footer>
        ) : null}
      </div>
    )
  }

  if (node.kind === 'ViewerBlock') {
    return <ViewerBlockRenderer node={node} renderChildren={(children) => renderChildren(children, props.embedded)} />
  }

  if (node.kind === 'ViewerOverlay') {
    return <ViewerOverlayRenderer node={node} renderChildren={(children) => renderChildren(children, props.embedded)} />
  }

  if (node.kind === 'Heading') {
    const level = clampHeadingLevel(node.props.level)
    const Tag = `h${level}` as keyof JSX.IntrinsicElements
    const fontSize = `${Math.max(1.25, 2.2 - (level - 1) * 0.25)}rem`

    return (
      <Tag
        key={node.id}
        style={{
          ...toCssProperties(node.styles),
          fontSize,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
        }}
      >
        {String(node.props.text ?? '')}
      </Tag>
    )
  }

  if (node.kind === 'Text') {
    return (
      <p
        key={node.id}
        style={{
          ...toCssProperties(node.styles),
          fontSize: '1rem',
          opacity: 0.88,
        }}
      >
        {String(node.props.text ?? '')}
      </p>
    )
  }

  if (node.kind === 'Button') {
    const variant = node.props.variant === 'ghost' ? 'ghost' : 'solid'

    return (
      <ButtonNodeRenderer
        key={node.id}
        node={node}
        style={{
          ...buttonBaseStyle,
          ...toCssProperties(node.styles),
          backgroundColor: variant === 'solid' ? 'var(--pwc-accent)' : 'transparent',
          color: variant === 'solid' ? 'white' : 'var(--pwc-text)',
          borderColor: variant === 'solid' ? 'transparent' : 'rgba(31, 27, 23, 0.2)',
        }}
      />
    )
  }

  if (node.kind === 'Image') {
    return (
      <img
        key={node.id}
        src={String(node.props.src ?? '')}
        alt={String(node.props.alt ?? '')}
        style={{
          ...imageBaseStyle,
          ...toCssProperties(node.styles),
          objectFit: node.props.fit === 'contain' ? 'contain' : 'cover',
        }}
      />
    )
  }

  return (
      <div key={node.id} style={toCssProperties(node.styles)}>
        {renderChildren(node.children, props.embedded)}
      </div>
  )
}

function renderChildren(children: UiNode[], embedded?: boolean): ReactNode[] {
  return children.map((child) => (
    <React.Fragment key={child.id}>
      <UiNodeRenderer node={child} embedded={embedded} />
    </React.Fragment>
  ))
}

function ButtonNodeRenderer(props: {
  node: UiNode
  style: CSSProperties
}): JSX.Element {
  const controller = useGraphEventController()
  const href = String(props.node.props.href ?? '#')
  const label = String(props.node.props.label ?? '')
  const hasBinding = controller?.hasUiClickBinding(props.node.id) ?? false

  return (
    <a
      href={href}
      style={props.style}
      onClick={(event) => {
        if (hasBinding || href === '#') {
          event.preventDefault()
        }

        controller?.emitUiClick({
          targetNodeId: props.node.id,
          data: {
            href,
            label,
          },
        })
      }}
    >
      {label}
    </a>
  )
}

function sectionStyle(node: UiNode): CSSProperties {
  return {
    ...toCssProperties(node.styles),
    display: 'grid',
    gap: '20px',
  }
}

function stackStyle(node: UiNode): CSSProperties {
  return {
    ...toCssProperties(node.styles),
    display: 'flex',
  }
}

function toCssProperties(styles: UiNode['styles']): CSSProperties {
  if (!styles) {
    return {}
  }

  const entries = Object.entries(styles).filter(
    ([, value]) => typeof value === 'string' || typeof value === 'number',
  )

  return Object.fromEntries(entries) as CSSProperties
}

function formatMaxWidth(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}px`
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  return undefined
}

function clampHeadingLevel(level: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  if (typeof level !== 'number') {
    return 1
  }

  return Math.min(6, Math.max(1, Math.round(level))) as 1 | 2 | 3 | 4 | 5 | 6
}

const emptyStateStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  gap: '8px',
  minHeight: '240px',
  border: '1px dashed rgba(31, 27, 23, 0.2)',
  borderRadius: '20px',
  padding: '24px',
  color: '#5d5249',
  background: 'rgba(255, 250, 241, 0.8)',
  textAlign: 'center',
}

const buttonBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content',
  minHeight: '44px',
  padding: '0 18px',
  borderRadius: '999px',
  border: '1px solid transparent',
  textDecoration: 'none',
  fontWeight: 600,
  transition: 'transform 140ms ease, box-shadow 140ms ease',
  boxShadow: '0 14px 28px rgba(31, 27, 23, 0.08)',
}

const imageBaseStyle: CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  borderRadius: '24px',
  background: 'var(--pwc-surface)',
}
