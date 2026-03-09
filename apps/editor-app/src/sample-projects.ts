import exampleProject from '../../../examples/example-project.json'
import landingBasic from '../../../examples/landing-basic.json'
import landingHero from '../../../examples/landing-hero.json'

export const sampleProjects = [
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
