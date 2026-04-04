import { describe, it, expect } from 'vitest'
import { apiSuccess, apiError, apiValidationError, apiNotFound } from './response'

describe('API response helpers', () => {
  it('apiSuccess wraps data and returns 200 by default', async () => {
    const res = apiSuccess({ id: 1, name: 'test' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ id: 1, name: 'test' })
  })

  it('apiSuccess accepts custom status', async () => {
    const res = apiSuccess({ created: true }, 201)
    expect(res.status).toBe(201)
  })

  it('apiError returns error message with status', async () => {
    const res = apiError('Something went wrong', 500)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Something went wrong')
  })

  it('apiError includes details when provided', async () => {
    const res = apiError('Bad request', 400, { field: 'name' })
    const body = await res.json()
    expect(body.error).toBe('Bad request')
    expect(body.details).toEqual({ field: 'name' })
  })

  it('apiValidationError returns 400', async () => {
    const res = apiValidationError('Invalid input')
    expect(res.status).toBe(400)
  })

  it('apiNotFound returns 404', async () => {
    const res = apiNotFound()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })
})
