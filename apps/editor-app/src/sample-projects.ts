import exampleProject from '../../../examples/example-project.json'
import dataCardList from '../../../examples/data-card-list.json'
import landingBasic from '../../../examples/landing-basic.json'
import landingHero from '../../../examples/landing-hero.json'
import slotShellLayout from '../../../examples/slot-shell-layout.json'
import subgraphCardGrid from '../../../examples/subgraph-card-grid.json'
import subgraphHeroComponent from '../../../examples/subgraph-hero-component.json'
import subgraphSlotActions from '../../../examples/subgraph-slot-actions.json'
import viewerBasic from '../../../examples/viewer-basic.json'
import viewerHotspotActions from '../../../examples/viewer-hotspot-actions.json'
import viewerHotspots from '../../../examples/viewer-hotspots.json'
import viewerInSubgraph from '../../../examples/viewer-in-subgraph.json'
import viewerSceneStates from '../../../examples/viewer-scene-states.json'
import viewerStateSubgraph from '../../../examples/viewer-state-subgraph.json'
import viewerVariants from '../../../examples/viewer-variants.json'

export const sampleProjects = [
  {
    key: 'viewer-scene-states',
    label: 'Viewer Scene States',
    document: viewerSceneStates,
  },
  {
    key: 'viewer-hotspot-actions',
    label: 'Viewer Hotspot Actions',
    document: viewerHotspotActions,
  },
  {
    key: 'viewer-variants',
    label: 'Viewer Variants',
    document: viewerVariants,
  },
  {
    key: 'viewer-state-subgraph',
    label: 'Viewer State Subgraph',
    document: viewerStateSubgraph,
  },
  {
    key: 'viewer-basic',
    label: 'Viewer Basic',
    document: viewerBasic,
  },
  {
    key: 'viewer-hotspots',
    label: 'Viewer Hotspots',
    document: viewerHotspots,
  },
  {
    key: 'viewer-in-subgraph',
    label: 'Viewer In Subgraph',
    document: viewerInSubgraph,
  },
  {
    key: 'data-card-list',
    label: 'Data Card List',
    document: dataCardList,
  },
  {
    key: 'slot-shell-layout',
    label: 'Slot Shell Layout',
    document: slotShellLayout,
  },
  {
    key: 'subgraph-slot-actions',
    label: 'Subgraph Slot Actions',
    document: subgraphSlotActions,
  },
  {
    key: 'subgraph-card-grid',
    label: 'Subgraph Card Grid',
    document: subgraphCardGrid,
  },
  {
    key: 'subgraph-hero-component',
    label: 'Subgraph Hero Component',
    document: subgraphHeroComponent,
  },
  {
    key: 'landing-basic',
    label: 'Landing Basic',
    document: landingBasic,
  },
  {
    key: 'landing-hero',
    label: 'Landing Hero',
    document: landingHero,
  },
  {
    key: 'original-example',
    label: 'Original Example',
    document: exampleProject,
  },
] as const
