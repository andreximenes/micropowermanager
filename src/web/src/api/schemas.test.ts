import { z } from 'zod';

import {
  contractSchema,
  dataOf,
  deviceSchema,
  pageOf,
  paymentSchema,
  personSchema,
  type Payment,
} from './schemas';

import { contractFixture, paymentFixture, personFixture } from '@/test/fixtures';

describe('response schemas', () => {
  it('accept the fixtures the screens are tested with', () => {
    expect(personSchema.parse(personFixture())).toEqual(personFixture());
    expect(contractSchema.parse(contractFixture())).toEqual(contractFixture());
    expect(paymentSchema.parse(paymentFixture())).toEqual(paymentFixture());
  });

  it('accept a device without geo, with null geo and with an empty geo_json', () => {
    const device = { id: 1, device_type: 'meter', device_serial: 'SN-1' };

    expect(deviceSchema.safeParse(device).success).toBe(true);
    expect(deviceSchema.safeParse({ ...device, geo: null }).success).toBe(true);
    expect(deviceSchema.safeParse({ ...device, geo: { geo_json: null } }).success).toBe(true);
  });

  it('keep extra GeoJSON properties', () => {
    const geo = { geo_json: { type: 'Feature', geometry: { coordinates: [39.2, -6.8] } } };

    const device = deviceSchema.parse({ id: 1, device_type: 'meter', device_serial: 'SN-1', geo });

    expect(device.geo?.geo_json).toEqual(geo.geo_json);
  });

  it('reject coordinates that are not a pair of numbers', () => {
    const geo = { geo_json: { geometry: { coordinates: ['39.2', '-6.8'] } } };

    expect(
      deviceSchema.safeParse({ id: 1, device_type: 'meter', device_serial: 'SN-1', geo }).success,
    ).toBe(false);
  });

  it('reject an unknown contract payment type', () => {
    expect(
      contractSchema.safeParse(contractFixture({ payment_type: 'lease' as never })).success,
    ).toBe(false);
  });

  it('accept a payment without a transaction', () => {
    const payment: Partial<Payment> = paymentFixture();
    delete payment.transaction;

    expect(paymentSchema.safeParse(payment).success).toBe(true);
    expect(paymentSchema.safeParse({ ...payment, transaction: null }).success).toBe(true);
  });
});

describe('envelopes', () => {
  it('dataOf unwraps a data envelope', () => {
    expect(dataOf(z.number()).parse({ data: 5 })).toEqual({ data: 5 });
    expect(dataOf(z.number()).safeParse({ data: '5' }).success).toBe(false);
  });

  it('pageOf requires the Laravel pagination fields', () => {
    const schema = pageOf(z.number());

    expect(schema.parse({ data: [1, 2], current_page: 1, last_page: 3, total: 30 })).toEqual({
      data: [1, 2],
      current_page: 1,
      last_page: 3,
      total: 30,
    });
    expect(schema.safeParse({ data: [1, 2] }).success).toBe(false);
  });
});
