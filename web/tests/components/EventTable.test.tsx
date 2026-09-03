import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Event } from '@event-logger/shared';
import EventTable from '../../src/components/EventTable';

const sampleEvents: Event[] = [
  {
    id: '1',
    level: 'error',
    message: 'Connection to payment gateway timed out',
    source: 'checkout-service',
    timestamp: '2026-09-02T14:23:11.000Z',
    received_at: '2026-09-02T14:23:12.114Z',
    metadata: { userId: 'u_1234', retries: 3 },
  },
  {
    id: '2',
    level: 'info',
    message: 'User logged in successfully',
    source: 'auth-service',
    timestamp: '2026-09-02T14:20:00.000Z',
    received_at: '2026-09-02T14:20:01.000Z',
    metadata: {},
  },
];

describe('EventTable', () => {
  it('shows the empty state when there are no events', () => {
    render(<EventTable events={[]} loading={false} error={null} />);

    expect(screen.getByText(/no hay eventos que coincidan con los filtros/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders a row per event with its level, message and source', () => {
    render(<EventTable events={sampleEvents} loading={false} error={null} />);

    expect(screen.getByText('Connection to payment gateway timed out')).toBeInTheDocument();
    expect(screen.getByText('checkout-service')).toBeInTheDocument();
    expect(screen.getByText('User logged in successfully')).toBeInTheDocument();
    expect(screen.getByText('auth-service')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(sampleEvents.length + 1); // +1 for the header row
  });

  it('shows the error state instead of the table when a request fails', () => {
    render(<EventTable events={[]} loading={false} error="Error de red: 500" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Error de red: 500');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
