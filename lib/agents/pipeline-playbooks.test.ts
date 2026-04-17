import { describe, it, expect, beforeEach } from 'vitest'
import { __resetPlaybookCache, loadPlaybooks, getPlaybook, matchPlaybook, rankPlaybooks } from './pipeline-playbooks'

beforeEach(() => __resetPlaybookCache())

describe('pipeline-playbooks loader', () => {
  it('loads every playbook markdown file in the pipelines dir', () => {
    const playbooks = loadPlaybooks({ fresh: true })
    const ids = playbooks.map((p) => p.id).sort()
    expect(ids).toEqual(['animated-explainer', 'podcast-repurpose', 'talking-head'])
  })

  it('parses YAML front-matter with ranges and lists', () => {
    const th = getPlaybook('talking-head')
    expect(th).not.toBe(null)
    expect(th?.label).toBe('Talking Head Explainer')
    expect(th?.recommendedDurationSeconds).toEqual([45, 90])
    expect(th?.sceneCount).toEqual([3, 5])
    expect(th?.requires).toContain('tts')
    expect(th?.requires).toContain('avatar')
  })

  it('exposes the markdown body', () => {
    const th = getPlaybook('talking-head')
    expect(th?.body).toContain('Open on the presenter')
  })
})

describe('rankPlaybooks', () => {
  it('matches direct hint phrases with a high score', () => {
    const ranking = rankPlaybooks('Make me a talking head explainer about SaaS onboarding')
    expect(ranking.length).toBeGreaterThan(0)
    expect(['talking-head', 'animated-explainer']).toContain(ranking[0].playbook.id)
    expect(ranking[0].score).toBeGreaterThanOrEqual(0)
  })

  it('falls back to token overlap when no full hint matches', () => {
    const ranking = rankPlaybooks('I want a short video explaining my podcast episode')
    expect(ranking[0].playbook.id).toBe('podcast-repurpose')
  })

  it('returns zero score when nothing matches', () => {
    const ranking = rankPlaybooks('unrelated topic xyzzy')
    expect(ranking[0].score).toBe(0)
  })
})

describe('matchPlaybook', () => {
  it('returns null when no hint matches', () => {
    expect(matchPlaybook('xyzzy foo bar baz')).toBe(null)
  })

  it('returns the top playbook when a hint matches', () => {
    const p = matchPlaybook('Turn this podcast into a reel')
    expect(p?.id).toBe('podcast-repurpose')
  })
})
