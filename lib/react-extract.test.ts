import { describe, expect, it } from 'vitest'
import { patchReactCodeText, readReactCodeText } from './react-extract'

describe('patchReactCodeText', () => {
  it('rewrites the first heading', () => {
    const code = '<div><h1>Old</h1><p>body text goes here</p></div>'
    expect(patchReactCodeText(code, 'heading', 0, 'New')).toBe('<div><h1>New</h1><p>body text goes here</p></div>')
  })

  it('rewrites the Nth unique heading when there are duplicates', () => {
    const code = '<h1>Welcome</h1><h1>Welcome</h1><h1>Second</h1>'
    // Index 0 targets the first unique (Welcome), index 1 targets "Second".
    expect(patchReactCodeText(code, 'heading', 0, 'Hi')).toBe('<h1>Hi</h1><h1>Welcome</h1><h1>Second</h1>')
    expect(patchReactCodeText(code, 'heading', 1, 'Two')).toBe('<h1>Welcome</h1><h1>Welcome</h1><h1>Two</h1>')
  })

  it('preserves heading attributes', () => {
    const code = '<h2 className="title" id="a">Hello</h2>'
    expect(patchReactCodeText(code, 'heading', 0, 'Howdy')).toBe('<h2 className="title" id="a">Howdy</h2>')
  })

  it('rewrites paragraphs longer than the 8-char floor', () => {
    const code = '<p>paragraph body</p>'
    expect(patchReactCodeText(code, 'paragraph', 0, 'New body text')).toBe('<p>New body text</p>')
  })

  it('rewrites image alt text and injects alt when missing', () => {
    const withAlt = '<img src="/a.png" alt="cat"/>'
    expect(patchReactCodeText(withAlt, 'image', 0, 'dog')).toBe('<img src="/a.png" alt="dog"/>')

    const noAlt = '<img src="/a.png"/>'
    expect(patchReactCodeText(noAlt, 'image', 0, 'dog')).toBe('<img src="/a.png" alt="dog"/>')
  })

  it('escapes JSX-hostile characters in replacement text', () => {
    const code = '<h1>Old</h1>'
    const out = patchReactCodeText(code, 'heading', 0, 'a <b> {c} & d')
    expect(out).toBe('<h1>a &lt;b&gt; &#123;c&#125; &amp; d</h1>')
  })

  it('returns null when the index exceeds available unique matches', () => {
    const code = '<h1>Only</h1>'
    expect(patchReactCodeText(code, 'heading', 5, 'x')).toBeNull()
  })

  it('returns null for empty code', () => {
    expect(patchReactCodeText('', 'heading', 0, 'x')).toBeNull()
  })

  it('skips headings with nested children (only plain-text children supported)', () => {
    // Regex's [^<]{1,80} disallows "<" inside — this heading won't match.
    const code = '<h1><span>Nested</span></h1><h1>Plain</h1>'
    expect(patchReactCodeText(code, 'heading', 0, 'New')).toBe('<h1><span>Nested</span></h1><h1>New</h1>')
  })
})

describe('readReactCodeText', () => {
  it('returns the text of the Nth unique heading, paragraph, or image alt', () => {
    const code = '<h1>Alpha</h1><p>paragraph body</p><img alt="photo"/><h1>Beta</h1><h1>Alpha</h1>'
    expect(readReactCodeText(code, 'heading', 0)).toBe('Alpha')
    expect(readReactCodeText(code, 'heading', 1)).toBe('Beta')
    expect(readReactCodeText(code, 'paragraph', 0)).toBe('paragraph body')
    expect(readReactCodeText(code, 'image', 0)).toBe('photo')
  })

  it('returns null when index exceeds unique matches', () => {
    expect(readReactCodeText('<h1>One</h1>', 'heading', 3)).toBeNull()
  })
})
