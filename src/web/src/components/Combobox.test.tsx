import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { SelectSearch } from './Combobox';

const countries = [
  { value: 'CI', label: "Côte d'Ivoire", detail: '+225' },
  { value: 'NG', label: 'Nigeria', detail: '+234' },
  { value: 'TZ', label: 'Tanzania', detail: '+255' },
];

function Harness({ initial = '', emptyLabel }: { initial?: string; emptyLabel?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SelectSearch
        label="Country"
        noun="countries"
        emptyText="No matching country."
        emptyLabel={emptyLabel}
        value={value}
        onChange={setValue}
        options={countries}
      />
      <output aria-label="Chosen">{value}</output>
    </>
  );
}

const box = () => screen.getByRole('combobox', { name: 'Country' });
const optionNames = () => screen.getAllByRole('option').map((option) => option.textContent);

describe('SelectSearch', () => {
  it('filters by name or detail, ignoring case and accents, and picks with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Harness initial="NG" />);

    expect(box()).toHaveValue('Nigeria');
    await user.click(box());
    expect(optionNames()).toHaveLength(3);

    await user.clear(box());
    await user.type(box(), 'cote');
    expect(optionNames()).toEqual(["Côte d'Ivoire · +225"]);

    await user.clear(box());
    await user.type(box(), '+25');
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    expect(screen.getByRole('status', { name: 'Chosen' })).toHaveTextContent('TZ');
    expect(box()).toHaveValue('Tanzania');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('puts the chosen option back when the user leaves or presses Escape without choosing', async () => {
    const user = userEvent.setup();
    render(<Harness initial="NG" />);

    await user.click(box());
    await user.clear(box());
    await user.type(box(), 'tan');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(box()).toHaveValue('Nigeria');

    await user.click(box());
    await user.clear(box());
    await user.type(box(), 'zzz');
    expect(screen.getByText('No matching country.')).toBeInTheDocument();
    await user.tab();
    expect(box()).toHaveValue('Nigeria');
    expect(screen.getByRole('status', { name: 'Chosen' })).toHaveTextContent('NG');
  });

  it('offers the empty choice first and picks with the pointer', async () => {
    const user = userEvent.setup();
    render(<Harness emptyLabel="Not set" />);

    expect(box()).toHaveValue('Not set');
    await user.click(box());
    expect(optionNames()[0]).toBe('Not set');

    await user.click(screen.getByRole('option', { name: /^Nigeria/ }));
    expect(box()).toHaveValue('Nigeria');

    await user.click(box());
    await user.click(screen.getByRole('option', { name: 'Not set' }));
    expect(screen.getByRole('status', { name: 'Chosen' })).toBeEmptyDOMElement();
  });

  it('shows a value missing from the options as it is', () => {
    render(<Harness initial="Atlantis" />);

    expect(box()).toHaveValue('Atlantis');
  });
});
