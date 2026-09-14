import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders initials from a full name when no image is given', () => {
    render(<Avatar name="Nguyễn Văn A" />);
    expect(screen.getByText('NA')).toBeInTheDocument();
  });

  it('renders a single initial for a one-word name', () => {
    render(<Avatar name="Admin" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders an image with accessible alt text when src is given', () => {
    render(<Avatar name="Nguyễn Văn A" src="https://example.com/a.png" />);
    expect(screen.getByRole('img', { name: 'Nguyễn Văn A' })).toBeInTheDocument();
  });
});
