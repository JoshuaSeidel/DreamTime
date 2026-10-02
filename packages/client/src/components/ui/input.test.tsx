import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './input';

describe('Input', () => {
  const original = HTMLInputElement.prototype.showPicker;
  let showPicker: ReturnType<typeof vi.fn>;

  const stubShowPicker = (impl?: () => void) => {
    showPicker = vi.fn(impl);
    HTMLInputElement.prototype.showPicker = showPicker as unknown as () => void;
  };

  afterEach(() => {
    HTMLInputElement.prototype.showPicker = original;
  });

  it.each(['date', 'time', 'datetime-local'])('opens the native picker on click for type=%s', (type) => {
    stubShowPicker();
    render(<Input aria-label="field" type={type} />);
    fireEvent.click(screen.getByLabelText('field'));
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it('does not open a picker for text inputs', () => {
    stubShowPicker();
    render(<Input aria-label="field" type="text" />);
    fireEvent.click(screen.getByLabelText('field'));
    expect(showPicker).not.toHaveBeenCalled();
  });

  it('does not open a picker when disabled or read-only', () => {
    stubShowPicker();
    render(
      <>
        <Input aria-label="ro" type="time" readOnly />
        <Input aria-label="dis" type="time" disabled />
      </>
    );
    fireEvent.click(screen.getByLabelText('ro'));
    fireEvent.click(screen.getByLabelText('dis'));
    expect(showPicker).not.toHaveBeenCalled();
  });

  it('still calls the consumer onClick and respects preventDefault', () => {
    stubShowPicker();
    const onClick = vi.fn((e: React.MouseEvent) => e.preventDefault());
    render(<Input aria-label="field" type="date" onClick={onClick} />);
    fireEvent.click(screen.getByLabelText('field'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(showPicker).not.toHaveBeenCalled();
  });

  it('swallows errors thrown by showPicker', () => {
    stubShowPicker(() => {
      throw new DOMException('already open', 'InvalidStateError');
    });
    render(<Input aria-label="field" type="time" />);
    expect(() => fireEvent.click(screen.getByLabelText('field'))).not.toThrow();
  });
});
