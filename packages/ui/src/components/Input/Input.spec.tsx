import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';
import { FormField } from './FormField';

describe('Input', () => {
  it('accepts typed input', async () => {
    render(<Input aria-label="email" />);
    const input = screen.getByLabelText('email');
    await userEvent.type(input, 'a@b.com');
    expect(input).toHaveValue('a@b.com');
  });

  it('marks itself aria-invalid when invalid', () => {
    render(<Input aria-label="email" invalid />);
    expect(screen.getByLabelText('email')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('FormField', () => {
  it('associates the label with the control via htmlFor/id', () => {
    render(
      <FormField label="Email" htmlFor="email">
        <Input id="email" />
      </FormField>,
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders an error message with role=alert instead of the hint', () => {
    render(
      <FormField label="Email" htmlFor="email" hint="hint text" error="Email không hợp lệ">
        <Input id="email" />
      </FormField>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Email không hợp lệ');
    expect(screen.queryByText('hint text')).not.toBeInTheDocument();
  });
});
