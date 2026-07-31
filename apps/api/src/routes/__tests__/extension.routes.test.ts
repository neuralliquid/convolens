import { describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/admin';

function responseDouble() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

describe('extension admin authorization', () => {
  it('rejects non-admin selector evidence reads', () => {
    const request = { user: { id: 'user-1', email: 'user@example.test', role: 'user' } } as Request;
    const response = responseDouble();
    const next = jest.fn() as NextFunction;

    requireAdmin(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows an authenticated admin to continue', () => {
    const request = {
      user: { id: 'admin-1', email: 'admin@example.test', role: 'admin' },
    } as Request;
    const response = responseDouble();
    const next = jest.fn() as NextFunction;

    requireAdmin(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });
});
