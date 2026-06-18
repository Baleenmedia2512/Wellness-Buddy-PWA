/**
 * EmailAutocomplete.test.js
 *
 * Unit tests for EmailAutocomplete component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailAutocomplete from '../EmailAutocomplete.jsx';

describe('EmailAutocomplete', () => {
  const mockOnChange = jest.fn();
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders email input with placeholder', () => {
    render(
      <EmailAutocomplete 
        value="" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
        placeholder="Enter email"
      />
    );
    
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  it('shows domain suggestions when typing username', async () => {
    const { rerender } = render(
      <EmailAutocomplete 
        value="" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
      />
    );

    // Type username
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    
    rerender(
      <EmailAutocomplete 
        value="john" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
      />
    );

    // Should show suggestions like john@gmail.com, john@yahoo.com, etc.
    await waitFor(() => {
      expect(screen.getByText('john@gmail.com')).toBeInTheDocument();
    });
  });

  it('filters domains when typing after @', async () => {
    const { rerender } = render(
      <EmailAutocomplete 
        value="" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    
    rerender(
      <EmailAutocomplete 
        value="john@gm" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('john@gmail.com')).toBeInTheDocument();
    });
  });

  it('calls onChange when typing', () => {
    render(
      <EmailAutocomplete 
        value="" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test@example.com' } });

    expect(mockOnChange).toHaveBeenCalledWith('test@example.com');
  });

  it('calls onSelect when clicking a suggestion', async () => {
    const { rerender } = render(
      <EmailAutocomplete 
        value="john" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText('john@gmail.com')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText('john@gmail.com'));

    expect(mockOnSelect).toHaveBeenCalledWith('john@gmail.com');
  });

  it('shows previous emails in suggestions', async () => {
    // Store previous email
    localStorage.setItem('previousEmails', JSON.stringify(['previous@test.com']));

    const { rerender } = render(
      <EmailAutocomplete 
        value="prev" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('previous@test.com')).toBeInTheDocument();
    });
  });

  it('saves selected email to localStorage', async () => {
    const { rerender } = render(
      <EmailAutocomplete 
        value="john" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('john@gmail.com')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText('john@gmail.com'));

    const stored = JSON.parse(localStorage.getItem('previousEmails') || '[]');
    expect(stored).toContain('john@gmail.com');
  });

  it('closes suggestions on outside click', async () => {
    const { container, rerender } = render(
      <EmailAutocomplete 
        value="john" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('john@gmail.com')).toBeInTheDocument();
    });

    // Click outside
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText('john@gmail.com')).not.toBeInTheDocument();
    });
  });

  it('respects disabled state', () => {
    render(
      <EmailAutocomplete 
        value="" 
        onChange={mockOnChange} 
        onSelect={mockOnSelect}
        disabled={true}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
});
