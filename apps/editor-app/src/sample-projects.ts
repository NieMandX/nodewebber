import exampleProject from '../../../examples/example-project.json'
import landingBasic from '../../../examples/landing-basic.json'
import landingHero from '../../../examples/landing-hero.json'
import subgraphCardGrid from '../../../examples/subgraph-card-grid.json'
import subgraphHeroComponent from '../../../examples/subgraph-hero-component.json'

export const sampleProjects = [
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
