import React from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type {
  ViewerBlockProps,
  ViewerCameraConfig,
  ViewerEnvironmentConfig,
  ViewerHotspotConfig,
  ViewerOverlayProps,
} from '@procedural-web-composer/shared-types'
import type { UiNode } from '@procedural-web-composer/ui-tree'

export function ViewerBlockRenderer(props: {
  node: UiNode
  renderChildren: (children: UiNode[]) => ReactNode[]
}): JSX.Element {
  const viewerProps = props.node.props as ViewerBlockProps
  const modelSrc = viewerProps.model?.src ?? viewerProps.modelSrc ?? ''
  const environment = viewerProps.environment
  const cameraPreset = viewerProps.cameraPreset
  const hotspots = viewerProps.hotspots ?? []
  const overlayChildren = props.node.slots?.overlay ?? []

  return (
    <section
      key={props.node.id}
      style={{
        display: 'grid',
        gap: '14px',
        padding: '18px',
        borderRadius: '24px',
        background: 'rgba(12, 18, 31, 0.9)',
        color: '#f5f7fb',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 44px rgba(5, 10, 18, 0.24)',
        ...toCssProperties(props.node.styles),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: '4px' }}>
          {viewerProps.title ? (
            <strong style={{ fontSize: '1rem', letterSpacing: '-0.02em' }}>{viewerProps.title}</strong>
          ) : null}
          <span style={{ fontSize: '0.82rem', color: 'rgba(240, 245, 255, 0.72)' }}>
            {modelSrc || 'No model source configured'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Badge label={viewerProps.loadingMode === 'eager' ? 'Eager load' : 'Lazy load'} />
          {viewerProps.allowOrbit ? <Badge label="Orbit" /> : <Badge label="Fixed view" />}
          {viewerProps.showToolbar ? <Badge label="Toolbar" /> : null}
          {hotspots.length > 0 ? <Badge label={`${hotspots.length} hotspots`} /> : null}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          minHeight: '320px',
          borderRadius: '20px',
          overflow: 'hidden',
          background:
            viewerProps.background ??
            'linear-gradient(180deg, rgba(24, 34, 56, 0.96), rgba(12, 18, 31, 0.96))',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {viewerProps.posterImage ? (
          <img
            src={viewerProps.posterImage}
            alt={viewerProps.title ?? viewerProps.model?.alt ?? 'Viewer poster'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.62,
            }}
          />
        ) : null}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 20% 20%, rgba(126, 173, 255, 0.18), transparent 24rem), linear-gradient(180deg, rgba(255,255,255,0.04), transparent 40%)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: '22px',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'grid', gap: '8px', maxWidth: '320px' }}>
            <strong style={{ fontSize: '1.05rem' }}>Viewer placeholder</strong>
            <span style={{ color: 'rgba(240, 245, 255, 0.76)', fontSize: '0.88rem' }}>
              This block already carries serializable viewer config and can be swapped for a real 3D viewer integration later.
            </span>
          </div>
        </div>

        {overlayChildren.length > 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              padding: '18px',
              pointerEvents: 'none',
            }}
          >
            {props.renderChildren(overlayChildren)}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        <ViewerMetaRow label="Model" value={modelSrc || 'Unset'} />
        <ViewerMetaRow label="Environment" value={formatEnvironment(environment)} />
        <ViewerMetaRow label="Camera" value={formatCamera(cameraPreset)} />
        <ViewerMetaRow
          label="Exposure"
          value={typeof viewerProps.exposure === 'number' ? String(viewerProps.exposure) : '1'}
        />
      </div>

      {hotspots.length > 0 ? (
        <div style={{ display: 'grid', gap: '8px' }}>
          <strong style={{ fontSize: '0.86rem' }}>Hotspots</strong>
          <div style={{ display: 'grid', gap: '8px' }}>
            {hotspots.map((hotspot) => (
              <HotspotCard key={hotspot.id ?? hotspot.label ?? JSON.stringify(hotspot)} hotspot={hotspot} />
            ))}
          </div>
        </div>
      ) : null}

      {props.node.children.length > 0 ? (
        <div style={{ display: 'grid', gap: '10px' }}>{props.renderChildren(props.node.children)}</div>
      ) : null}
    </section>
  )
}

export function ViewerOverlayRenderer(props: {
  node: UiNode
  renderChildren: (children: UiNode[]) => ReactNode[]
}): JSX.Element {
  const overlayProps = props.node.props as unknown as ViewerOverlayProps

  return (
    <div
      key={props.node.id}
      style={{
        ...overlayPositionStyle(overlayProps.position),
        position: 'absolute',
        maxWidth: '260px',
        padding: '12px 14px',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(8, 14, 24, 0.72)',
        color: '#f5f7fb',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'auto',
      }}
    >
      {overlayProps.title ? (
        <strong style={{ display: 'block', marginBottom: overlayProps.description ? '6px' : '0' }}>
          {overlayProps.title}
        </strong>
      ) : null}
      {overlayProps.description ? (
        <span style={{ display: 'block', color: 'rgba(240, 245, 255, 0.78)', fontSize: '0.84rem' }}>
          {overlayProps.description}
        </span>
      ) : null}
      {props.node.children.length > 0 ? props.renderChildren(props.node.children) : null}
    </div>
  )
}

function HotspotCard(props: {
  hotspot: ViewerHotspotConfig
}): JSX.Element {
  const position = props.hotspot.position

  return (
    <article
      style={{
        display: 'grid',
        gap: '4px',
        padding: '10px 12px',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <strong style={{ fontSize: '0.86rem' }}>{props.hotspot.label ?? props.hotspot.id ?? 'Hotspot'}</strong>
      {props.hotspot.description ? (
        <span style={{ color: 'rgba(240, 245, 255, 0.74)', fontSize: '0.82rem' }}>
          {props.hotspot.description}
        </span>
      ) : null}
      {position ? (
        <span style={{ color: 'rgba(240, 245, 255, 0.58)', fontSize: '0.76rem' }}>
          {`x:${position.x} y:${position.y} z:${position.z}`}
        </span>
      ) : null}
    </article>
  )
}

function ViewerMetaRow(props: {
  label: string
  value: string
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '0.82rem',
        color: 'rgba(240, 245, 255, 0.8)',
      }}
    >
      <strong style={{ fontWeight: 600 }}>{props.label}</strong>
      <span style={{ textAlign: 'right' }}>{props.value}</span>
    </div>
  )
}

function Badge(props: {
  label: string
}): JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '28px',
        padding: '0 10px',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: '0.76rem',
      }}
    >
      {props.label}
    </span>
  )
}

function formatEnvironment(environment: ViewerEnvironmentConfig | undefined): string {
  if (!environment) {
    return 'Default'
  }

  if (environment.type === 'hdri') {
    return environment.hdriSrc ? `HDRI ${environment.hdriSrc}` : 'HDRI'
  }

  return environment.color ? `Color ${environment.color}` : 'Color'
}

function formatCamera(cameraPreset: ViewerCameraConfig | undefined): string {
  if (!cameraPreset) {
    return 'Default'
  }

  const mode = cameraPreset.mode ?? 'orbit'
  const fov = typeof cameraPreset.fov === 'number' ? `, fov ${cameraPreset.fov}` : ''
  return `${mode}${fov}`
}

function overlayPositionStyle(
  position: ViewerOverlayProps['position'],
): CSSProperties {
  if (position === 'top-left') {
    return {
      top: '18px',
      left: '18px',
    }
  }

  if (position === 'bottom-left') {
    return {
      left: '18px',
      bottom: '18px',
    }
  }

  if (position === 'bottom-right') {
    return {
      right: '18px',
      bottom: '18px',
    }
  }

  return {
    top: '18px',
    right: '18px',
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
