import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import {
  addressFixture,
  customerHandlers,
  geoAt,
  paginator,
  personFixture,
  signIn,
} from '@/test/fixtures';
import { pickOption } from '@/test/combobox';
import { createGate } from '@/test/gate';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const cityHandlers = [
  http.get('/api/cities', () =>
    HttpResponse.json(
      paginator([{ id: 3, name: 'Kafanchan', mini_grid: { name: "Jema'a", cluster: null } }]),
    ),
  ),
];

type Locate = (success: PositionCallback, failure: PositionErrorCallback) => void;

function stubGeolocation(locate: Locate) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: locate },
  });
}

const located: Locate = (success) =>
  success({ coords: { latitude: 9.57621, longitude: 8.2985 } } as GeolocationPosition);
const denied: Locate = (_, failure) =>
  failure({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
const timedOut: Locate = (_, failure) =>
  failure({ code: 3, PERMISSION_DENIED: 1 } as GeolocationPositionError);

const panel = () => screen.getByRole('dialog');
const textbox = (name: string) => within(panel()).getByRole('textbox', { name });

async function openNewCustomer() {
  const view = renderApp('/customers');
  await view.user.click(await screen.findByRole('button', { name: '+ New customer' }));
  await screen.findByRole('dialog', { name: 'New customer' });
  return view;
}

async function chooseVillage(user: ReturnType<typeof renderApp>['user']) {
  await user.type(within(panel()).getByRole('combobox', { name: 'Village *' }), 'Kaf');
  await user.click(await screen.findByRole('option', { name: "Kafanchan · Jema'a" }));
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('CustomerForm — new customer', () => {
  beforeEach(() => {
    signIn();
    server.use(...cityHandlers);
  });

  it('registers the customer with the pin from the device location and opens the profile', async () => {
    const created: unknown[] = [];
    server.use(
      http.post('/api/people', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json({ data: { id: 7 } }, { status: 201 });
      }),
      ...customerHandlers(),
    );
    stubGeolocation(located);
    const { user, router } = await openNewCustomer();

    await user.type(textbox('First name *'), 'Blessing');
    await user.type(textbox('Last name *'), 'Danjuma');
    await pickOption(
      user,
      within(panel()).getByRole('combobox', { name: 'Country code' }),
      'Nigeria',
      'NG +234',
    );
    await user.type(textbox('Phone number'), '0803 555 0199');
    await user.selectOptions(within(panel()).getByRole('combobox', { name: 'Gender' }), 'Female');
    await user.type(within(panel()).getByLabelText('Date of birth'), '1990-04-02');
    await user.click(within(panel()).getByText('More details (title, education)'));
    await user.type(textbox('Title'), 'Mrs.');
    await chooseVillage(user);
    await user.type(textbox('Street or landmark'), '12 Market Road');
    await user.click(within(panel()).getByRole('button', { name: 'Use my location' }));
    expect(
      within(panel()).getByText('Drag the pin to the house · 9.57621, 8.29850'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save customer' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/customers/7'));
    expect(created).toEqual([
      {
        name: 'Blessing',
        surname: 'Danjuma',
        title: 'Mrs.',
        birth_date: '1990-04-02',
        gender: 'female',
        phone: '+2348035550199',
        street: '12 Market Road',
        city_id: 3,
        points: '9.576210,8.298500',
        country_code: 'NG',
        is_primary: true,
        is_customer: true,
      },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('checks the required fields before sending anything', async () => {
    const created = vi.fn();
    server.use(http.post('/api/people', created));
    const { user } = await openNewCustomer();

    await user.type(textbox('First name *'), 'B');
    await user.type(textbox('E-mail'), 'not-an-address');
    await user.type(textbox('Street or landmark'), 'Road');
    await user.type(textbox('Phone number'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save customer' }));

    expect(await within(panel()).findAllByText('Enter at least 2 characters.')).toHaveLength(2);
    expect(within(panel()).getByText('Enter a valid e-mail address.')).toBeInTheDocument();
    expect(within(panel()).getByText('Enter at least 5 characters.')).toBeInTheDocument();
    expect(within(panel()).getByText('Use digits only.')).toBeInTheDocument();
    expect(within(panel()).getByText('Choose the village.')).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });

  it('shows the server validation errors next to their fields', async () => {
    const gate = createGate();
    server.use(
      http.post('/api/people', async () => {
        await gate.promise;
        return HttpResponse.json(
          {
            message: 'The phone field must be at least 11 characters. (and 1 more error)',
            errors: {
              phone: ['The phone field must be at least 11 characters.'],
              city_id: ['The selected city id is invalid.'],
              points: ['The points field format is invalid.'],
            },
          },
          { status: 422 },
        );
      }),
    );
    const { user } = await openNewCustomer();

    await user.type(textbox('First name *'), 'Blessing');
    await user.type(textbox('Last name *'), 'Danjuma');
    await user.type(textbox('Phone number'), '80');
    await chooseVillage(user);
    await user.click(screen.getByRole('button', { name: 'Save customer' }));
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    gate.open();

    expect(await within(panel()).findByRole('alert')).toHaveTextContent(
      'The customer was not saved: The phone field must be at least 11 characters. (and 1 more error)',
    );
    expect(
      within(panel()).getByText('The phone field must be at least 11 characters.'),
    ).toBeInTheDocument();
    expect(within(panel()).getByText('The selected city id is invalid.')).toBeInTheDocument();
  });

  it('shows a failure that is not a validation error in the banner', async () => {
    server.use(
      http.post('/api/people', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    );
    const { user } = await openNewCustomer();

    await user.type(textbox('First name *'), 'Blessing');
    await user.type(textbox('Last name *'), 'Danjuma');
    await chooseVillage(user);
    await user.click(screen.getByRole('button', { name: 'Save customer' }));

    expect(await within(panel()).findByRole('alert')).toHaveTextContent(
      'The customer was not saved: Server error',
    );
  });

  it('defaults the phone country to the company country', async () => {
    server.use(
      http.get('/api/settings/main', () =>
        HttpResponse.json({ data: { company_name: 'Spark', currency: 'TZS', country: 'Kenya' } }),
      ),
    );
    await openNewCustomer();

    await waitFor(() =>
      expect(within(panel()).getByRole('combobox', { name: 'Country code' })).toHaveValue(
        'KE +254',
      ),
    );
  });

  it('centres the map on the company map settings until a pin is placed', async () => {
    await openNewCustomer();

    expect(
      await within(panel()).findByRole('img', {
        name: "Map with a draggable pin on the customer's house",
      }),
    ).toBeInTheDocument();
    expect(
      within(panel()).getByText(
        'Drag the pin to the house, or use your location. Without a pin, no location is saved.',
      ),
    ).toBeInTheDocument();
  });

  it('asks for the device location when the company has no map centre', async () => {
    const gate = createGate();
    server.use(
      http.get('/api/map-settings', async () => {
        await gate.promise;
        return HttpResponse.json({ data: [] });
      }),
    );
    await openNewCustomer();

    expect(within(panel()).getByText('Loading map…')).toBeInTheDocument();
    gate.open();
    expect(
      await within(panel()).findByText(
        'No map centre is set for this company. Use your location to place the pin.',
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ['access is denied', denied, 'Location access was denied. Drag the pin instead.'],
    [
      'the position is unavailable',
      timedOut,
      'Could not find your location. Drag the pin instead.',
    ],
  ])('explains when %s', async (_, locate, message) => {
    stubGeolocation(locate);
    const { user } = await openNewCustomer();

    await user.click(within(panel()).getByRole('button', { name: 'Use my location' }));

    expect(await within(panel()).findByRole('alert')).toHaveTextContent(message);
  });

  it('shows the search while the device looks for its location', async () => {
    let finish: (() => void) | undefined;
    stubGeolocation((success) => {
      finish = () => success({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition);
    });
    const { user } = await openNewCustomer();

    await user.click(within(panel()).getByRole('button', { name: 'Use my location' }));
    expect(within(panel()).getByRole('button', { name: 'Finding you…' })).toBeDisabled();
    finish?.();
    expect(await within(panel()).findByRole('button', { name: 'Use my location' })).toBeEnabled();
  });

  it('explains when the browser cannot share its location', async () => {
    const { user } = await openNewCustomer();

    await user.click(within(panel()).getByRole('button', { name: 'Use my location' }));

    expect(within(panel()).getByRole('alert')).toHaveTextContent(
      'This browser cannot share its location.',
    );
  });

  it('closes without saving on cancel', async () => {
    const { user } = await openNewCustomer();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lets the village be chosen with the keyboard', async () => {
    server.use(
      http.get('/api/cities', () =>
        HttpResponse.json(
          paginator([
            { id: 3, name: 'Kafanchan' },
            { id: 4, name: 'Kagoro' },
          ]),
        ),
      ),
    );
    const { user } = await openNewCustomer();
    const village = within(panel()).getByRole('combobox', { name: 'Village *' });

    await user.type(village, 'Ka');
    await screen.findByRole('option', { name: 'Kagoro' });
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{ArrowDown}{Enter}');
    expect(village).toHaveValue('Kagoro');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('says when no village matches, or the villages cannot be loaded', async () => {
    server.use(http.get('/api/cities', () => HttpResponse.json(paginator([]))));
    const { user } = await openNewCustomer();

    await user.type(within(panel()).getByRole('combobox', { name: 'Village *' }), 'Zz');
    expect(await screen.findByText('No matching village.')).toBeInTheDocument();

    server.use(
      http.get('/api/cities', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })),
    );
    await user.type(within(panel()).getByRole('combobox', { name: 'Village *' }), 'q');
    expect(await screen.findByText('Could not load villages: Boom')).toBeInTheDocument();
  });
});

describe('CustomerForm — edit and delete', () => {
  const person = personFixture({
    title: 'Mrs.',
    education: 'Secondary',
    birth_date: '1990-04-02',
    gender: 'Female',
    addresses: [
      addressFixture({
        id: 11,
        phone: '+2348035550142',
        email: 'amina@example.com',
        street: 'Kariakoo Street',
        city: { id: 2, name: 'Dar es Salaam' },
        geo: geoAt(-6.8, 39.28),
      }),
    ],
  });

  beforeEach(() => {
    signIn();
    server.use(...cityHandlers, ...customerHandlers({ person }));
  });

  async function openEdit() {
    const view = renderApp('/customers/7');
    await view.user.click(await screen.findByRole('button', { name: 'Edit customer' }));
    await screen.findByRole('dialog', { name: 'Edit customer' });
    return view;
  }

  it('starts from the customer as they are', async () => {
    await openEdit();

    expect(textbox('First name *')).toHaveValue('Amina');
    expect(textbox('Last name *')).toHaveValue('Okafor');
    expect(within(panel()).getByRole('combobox', { name: 'Country code' })).toHaveValue('NG +234');
    expect(textbox('Phone number')).toHaveValue('8035550142');
    expect(textbox('E-mail')).toHaveValue('amina@example.com');
    expect(within(panel()).getByRole('combobox', { name: 'Gender' })).toHaveValue('female');
    expect(within(panel()).getByLabelText('Date of birth')).toHaveValue('1990-04-02');
    expect(textbox('Title')).toHaveValue('Mrs.');
    expect(textbox('Education')).toHaveValue('Secondary');
    expect(within(panel()).getByRole('combobox', { name: 'Village *' })).toHaveValue(
      'Dar es Salaam',
    );
    expect(textbox('Street or landmark')).toHaveValue('Kariakoo Street');
    expect(
      within(panel()).getByText('Drag the pin to the house · -6.80000, 39.28000'),
    ).toBeInTheDocument();
  });

  it('saves the person and the primary address, then refreshes the profile', async () => {
    const requests: { method: string; body: unknown }[] = [];
    let profileLoads = 0;
    server.use(
      http.put('/api/people/7', async ({ request }) => {
        requests.push({ method: 'PUT person', body: await request.json() });
        return HttpResponse.json({ data: { id: 7 } });
      }),
      http.put('/api/people/7/addresses', async ({ request }) => {
        requests.push({ method: 'PUT address', body: await request.json() });
        return HttpResponse.json({ data: addressFixture() });
      }),
      http.get('/api/people/7', () => {
        profileLoads += 1;
        return HttpResponse.json({ data: person });
      }),
    );
    const { user } = await openEdit();
    const loadsBefore = profileLoads;

    await user.clear(textbox('First name *'));
    await user.type(textbox('First name *'), 'Aminat');
    await user.clear(textbox('Title'));
    await user.clear(textbox('E-mail'));
    await user.click(screen.getByRole('button', { name: 'Save customer' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requests).toEqual([
      {
        method: 'PUT person',
        body: {
          name: 'Aminat',
          surname: 'Okafor',
          title: null,
          education: 'Secondary',
          birth_date: '1990-04-02',
          gender: 'female',
        },
      },
      {
        method: 'PUT address',
        body: {
          id: 11,
          phone: '+2348035550142',
          street: 'Kariakoo Street',
          city_id: 2,
          points: '-6.800000,39.280000',
          is_primary: 1,
        },
      },
    ]);
    await waitFor(() => expect(profileLoads).toBeGreaterThan(loadsBefore));
  });

  it('adds a primary address when the customer has none', async () => {
    const added: unknown[] = [];
    server.use(
      ...customerHandlers({ person: personFixture({ addresses: [] }) }),
      http.put('/api/people/7', () => HttpResponse.json({ data: { id: 7 } })),
      http.post('/api/people/7/addresses', async ({ request }) => {
        added.push(await request.json());
        return HttpResponse.json({ data: addressFixture() });
      }),
    );
    const { user } = await openEdit();

    expect(within(panel()).getByRole('combobox', { name: 'Gender' })).toHaveValue('female');
    await chooseVillage(user);
    await user.click(screen.getByRole('button', { name: 'Save customer' }));

    await waitFor(() => expect(added).toEqual([{ city_id: 3, is_primary: 1 }]));
  });

  it('deletes the customer after a confirmation and returns to the list', async () => {
    const deleted = vi.fn();
    server.use(
      http.delete('/api/people/7', () => {
        deleted();
        return HttpResponse.json({ message: 'Person deleted successfully' });
      }),
    );
    const { user, router } = await openEdit();

    await user.click(within(panel()).getByRole('button', { name: 'Delete customer' }));
    expect(
      within(panel()).getByText('Delete Amina Okafor? They will disappear from the customer list.'),
    ).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: 'Keep customer' }));
    expect(deleted).not.toHaveBeenCalled();

    await user.click(within(panel()).getByRole('button', { name: 'Delete customer' }));
    await user.click(within(panel()).getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/customers'));
    expect(deleted).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains why an agent cannot be deleted', async () => {
    server.use(
      http.delete('/api/people/7', () =>
        HttpResponse.json(
          {
            message: 'This person is an agent. Delete the agent instead.',
            errors: { person: ['This person is an agent. Delete the agent instead.'] },
          },
          { status: 422 },
        ),
      ),
    );
    const { user, router } = await openEdit();

    await user.click(within(panel()).getByRole('button', { name: 'Delete customer' }));
    await user.click(within(panel()).getByRole('button', { name: 'Yes, delete' }));

    expect(await within(panel()).findByRole('alert')).toHaveTextContent(
      'The customer was not deleted: This person is an agent. Delete the agent instead.',
    );
    expect(router.state.location.pathname).toBe('/customers/7');
  });
});
