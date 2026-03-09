import exampleProject from '../../../examples/example-project.json'
import dataCardList from '../../../examples/data-card-list.json'
import landingBasic from '../../../examples/landing-basic.json'
import landingHero from '../../../examples/landing-hero.json'
import slotShellLayout from '../../../examples/slot-shell-layout.json'
import subgraphCardGrid from '../../../examples/subgraph-card-grid.json'
import subgraphHeroComponent from '../../../examples/subgraph-hero-component.json'
import subgraphSlotActions from '../../../examples/subgraph-slot-actions.json'

export const sampleProjects = [
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
