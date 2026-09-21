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

  it('shows the mascot character instead of the photo or initials when one is given', () => {
    render(<Avatar name="Nguyễn Văn A" src="https://example.com/a.png" character="fox" />);
    const img = screen.getByRole('img', { name: 'Nguyễn Văn A' });
    expect(img).toHaveStyle({ backgroundImage: 'url(/mascots/fox-directions.webp)' });
    expect(screen.queryByText('NA')).not.toBeInTheDocument();
    expect(img.querySelector('img')).toBeNull();
  });
});
