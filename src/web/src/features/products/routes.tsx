import { createRoute } from '@tanstack/react-router';

import { positiveId, authenticatedRoute } from '@/routes/base';

import { AppliancesPage } from './AppliancesPage';
import { appliancesSearchSchema, solarHomeSystemListSearchSchema } from './search';
import { SolarHomeSystemDetail } from './SolarHomeSystemDetail';
import { SolarHomeSystemList } from './SolarHomeSystemList';
import { SparkShsPage } from './SparkShsPage';

const appliancesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/appliances',
  validateSearch: appliancesSearchSchema,
  component: function AppliancesRoute() {
    return <AppliancesPage search={appliancesRoute.useSearch()} />;
  },
});

const solarHomeSystemsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/solar-home-systems',
  validateSearch: solarHomeSystemListSearchSchema,
  component: function SolarHomeSystemsRoute() {
    return <SolarHomeSystemList search={solarHomeSystemsRoute.useSearch()} />;
  },
});

const solarHomeSystemRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/solar-home-systems/$shsId',
  params: {
    parse: ({ shsId }) => ({ shsId: positiveId.parse(shsId) }),
    stringify: ({ shsId }) => ({ shsId: String(shsId) }),
  },
  component: function SolarHomeSystemRoute() {
    const { shsId } = solarHomeSystemRoute.useParams();
    return <SolarHomeSystemDetail solarHomeSystemId={shsId} />;
  },
});

const sparkShsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/spark-shs',
  component: function SparkShsRoute() {
    return <SparkShsPage />;
  },
});

export const productRoutes = [
  appliancesRoute,
  solarHomeSystemsRoute,
  solarHomeSystemRoute,
  sparkShsRoute,
];
