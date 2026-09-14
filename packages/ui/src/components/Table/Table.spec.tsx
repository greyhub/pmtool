import { render, screen } from '@testing-library/react';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from './Table';

describe('Table', () => {
  it('renders header and row cells', () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Tên dự án</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>PMTool</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Tên dự án' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'PMTool' })).toBeInTheDocument();
  });
});
