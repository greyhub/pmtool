import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './Card';

describe('Card', () => {
  it('renders composed sections', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Dự án PMTool</CardTitle>
          <CardDescription>Mô tả ngắn</CardDescription>
        </CardHeader>
        <CardContent>Nội dung</CardContent>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Dự án PMTool' })).toBeInTheDocument();
    expect(screen.getByText('Mô tả ngắn')).toBeInTheDocument();
    expect(screen.getByText('Nội dung')).toBeInTheDocument();
  });
});
