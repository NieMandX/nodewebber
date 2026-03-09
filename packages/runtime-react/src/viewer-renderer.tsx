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
import {
  applyViewerAction,
  getHotspotAction,
  getInitialViewerInteractionState,
  resolveViewerConfig,
} from './viewer-state'

export function ViewerBlockRenderer(props: {
  node: UiNode
  renderChildren: (children: UiNode[]) => ReactNode[]
}): JSX.Element {
  const viewerProps = props.node.props as ViewerBlockProps
  const overlayChildren = props.node.slots?.overlay ?? []
  const stateSignature = JSON.stringify(viewerProps.states ?? [])
  const variantSignature = JSON.stringify(viewerProps.variants ?? [])
  const [interactionState, setInteractionState] = React.useState(() =>
    getInitialViewerInteractionState(viewerProps),
  )

  React.useEffect(() => {
    setInteractionState(getInitialViewerInteractionState(viewerProps))
  }, [
    props.node.id,
    viewerProps.activeStateId,
    viewerProps.activeVariantId,
    viewerProps.initialStateId,
    stateSignature,
    variantSignature,
  ])

  const resolved = resolveViewerConfig(viewerProps, interactionState)
  const statePickerLocked = isNonEmptyString(viewerProps.activeStateId)
  const variantPickerLocked = isNonEmptyString(viewerProps.activeVariantId)

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
          {resolved.title ? (
            <strong style={{ fontSize: '1rem', letterSpacing: '-0.02em' }}>{resolved.title}</strong>
          ) : null}
          <span style={{ fontSize: '0.82rem', color: 'rgba(240, 245, 255, 0.72)' }}>
            {resolved.modelSrc || 'No model source configured'}
          </span>
          {resolved.description ? (
            <span style={{ fontSize: '0.84rem', color: 'rgba(240, 245, 255, 0.66)' }}>
              {resolved.description}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Badge label={viewerProps.loadingMode === 'eager' ? 'Eager load' : 'Lazy load'} />
          {viewerProps.allowOrbit ? <Badge label="Orbit" /> : <Badge label="Fixed view" />}
          {viewerProps.showToolbar ? <Badge label="Toolbar" /> : null}
          <Badge label={resolved.interactionsEnabled ? 'Interactive' : 'Interactions off'} />
          <Badge label={resolved.stateTransitionMode === 'instant' ? 'Instant state' : 'Soft state'} />
          {resolved.activeStateId ? <Badge label={`State ${resolved.activeStateId}`} /> : null}
          {resolved.activeVariantId ? <Badge label={`Variant ${resolved.activeVariantId}`} /> : null}
          {resolved.hotspots.length > 0 ? <Badge label={`${resolved.hotspots.length} hotspots`} /> : null}
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
            alt={resolved.title ?? resolved.model?.alt ?? 'Viewer poster'}
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
          <div style={{ display: 'grid', gap: '8px', maxWidth: '360px' }}>
            <strong style={{ fontSize: '1.05rem' }}>Interactive viewer placeholder</strong>
            <span style={{ color: 'rgba(240, 245, 255, 0.76)', fontSize: '0.88rem' }}>
              Scene states, variants, and hotspot actions are already serialized through the graph and resolved locally in the renderer.
            </span>
            {resolved.activeState?.label ? (
              <span style={{ color: 'rgba(240, 245, 255, 0.6)', fontSize: '0.8rem' }}>
                {`Current scene: ${resolved.activeState.label}`}
              </span>
            ) : null}
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

      {(resolved.states.length > 0 || resolved.variants.length > 0) ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          {resolved.states.length > 0 ? (
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '0.76rem', color: 'rgba(240, 245, 255, 0.66)', textTransform: 'uppercase' }}>
                Scene state
              </span>
              <select
                value={resolved.activeStateId ?? ''}
                disabled={!resolved.interactionsEnabled || statePickerLocked}
                style={selectStyle}
                onChange={(event) => {
                  const nextValue = event.target.value.trim()
                  setInteractionState({
                    activeStateId: nextValue.length > 0 ? nextValue : undefined,
                    activeVariantId: undefined,
                    activeHotspotId: undefined,
                    focusedCamera: undefined,
                  })
                }}
              >
                <option value="">Base viewer</option>
                {resolved.states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.label ?? state.id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {resolved.variants.length > 0 ? (
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '0.76rem', color: 'rgba(240, 245, 255, 0.66)', textTransform: 'uppercase' }}>
                Variant
              </span>
              <select
                value={resolved.activeVariantId ?? ''}
                disabled={!resolved.interactionsEnabled || variantPickerLocked}
                style={selectStyle}
                onChange={(event) => {
                  const nextValue = event.target.value.trim()
                  setInteractionState((currentState) => ({
                    ...currentState,
                    activeVariantId: nextValue.length > 0 ? nextValue : undefined,
                  }))
                }}
              >
                <option value="">Base variant</option>
                {resolved.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label ?? variant.id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: '10px' }}>
        <ViewerMetaRow label="Model" value={resolved.modelSrc || 'Unset'} />
        <ViewerMetaRow label="Environment" value={formatEnvironment(resolved.environment)} />
        <ViewerMetaRow label="Camera" value={formatCamera(resolved.camera)} />
        <ViewerMetaRow label="Active state" value={resolved.activeState?.label ?? resolved.activeStateId ?? 'Base'} />
        <ViewerMetaRow label="Active variant" value={resolved.activeVariant?.label ?? resolved.activeVariantId ?? 'Base'} />
        <ViewerMetaRow label="Active hotspot" value={resolved.activeHotspot?.label ?? resolved.activeHotspotId ?? 'None'} />
        <ViewerMetaRow
          label="Exposure"
          value={typeof viewerProps.exposure === 'number' ? String(viewerProps.exposure) : '1'}
        />
      </div>

      {resolved.hotspots.length > 0 ? (
        <div style={{ display: 'grid', gap: '8px' }}>
          <strong style={{ fontSize: '0.86rem' }}>Hotspots</strong>
          <div style={{ display: 'grid', gap: '8px' }}>
            {resolved.hotspots.map((hotspot) => (
              <HotspotButton
                key={hotspot.id ?? hotspot.label ?? JSON.stringify(hotspot)}
                hotspot={hotspot}
                active={resolved.activeHotspotId === hotspot.id}
                disabled={!resolved.interactionsEnabled}
                onClick={() => {
                  const action = getHotspotAction(hotspot)

                  if (action) {
                    setInteractionState((currentState) => ({
                      ...applyViewerAction(action, currentState),
                      ...(hotspot.id ? { activeHotspotId: hotspot.id } : {}),
                    }))
                    return
                  }

                  setInteractionState((currentState) => ({
                    ...currentState,
                    activeHotspotId: hotspot.id,
                  }))
                }}
              />
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

function HotspotButton(props: {
  hotspot: ViewerHotspotConfig
  active: boolean
  disabled: boolean
  onClick: () => void
}): JSX.Element {
  const position = props.hotspot.position
  const action = getHotspotAction(props.hotspot)

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        display: 'grid',
        gap: '4px',
        padding: '10px 12px',
        borderRadius: '14px',
        background: props.active ? 'rgba(116, 176, 255, 0.18)' : 'rgba(255,255,255,0.06)',
        border: props.active
          ? '1px solid rgba(116, 176, 255, 0.34)'
          : '1px solid rgba(255,255,255,0.08)',
        color: '#f5f7fb',
        textAlign: 'left',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
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
      {action ? (
        <span style={{ color: 'rgba(155, 207, 255, 0.88)', fontSize: '0.76rem' }}>
          {formatAction(action)}
        </span>
      ) : null}
    </button>
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

function formatAction(action: ReturnType<typeof getHotspotAction>): string {
  if (!action) {
    return 'No interaction'
  }

  if (action.type === 'setState') {
    return `On click: state ${action.stateId || 'unset'}`
  }

  if (action.type === 'setVariant') {
    return `On click: variant ${action.variantId || 'unset'}`
  }

  if (action.type === 'showHotspot') {
    return `On click: hotspot ${action.hotspotId || 'unset'}`
  }

  return action.stateId ? `On click: focus + state ${action.stateId}` : 'On click: focus camera'
}

function overlayPositionStyle(position: ViewerOverlayProps['position']): CSSProperties {
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const selectStyle: CSSProperties = {
  width: '100%',
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f5f7fb',
}
