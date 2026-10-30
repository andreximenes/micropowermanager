import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { fetchAppliances, SOLAR_HOME_SYSTEM_TYPE_ID } from '@/api/products';
import {
  fetchShsManufacturers,
  updateSolarHomeSystem,
  type SolarHomeSystem,
} from '@/api/solarHomeSystems';
import { Field, selectClass } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { showFieldErrors } from '@/lib/fieldErrors';

const formSchema = z.object({
  serialNumber: z.string().trim().min(1, 'Enter the serial number.'),
  manufacturerId: z.string().min(1, 'Choose the manufacturer.'),
  productId: z.string().min(1, 'Choose the product.'),
});
type FormValues = z.infer<typeof formSchema>;

type EditSolarHomeSystemSheetProps = {
  solarHomeSystem: SolarHomeSystem;
  onClose: () => void;
};

export function EditSolarHomeSystemSheet({
  solarHomeSystem,
  onClose,
}: EditSolarHomeSystemSheetProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const manufacturers = useQuery({
    queryKey: ['manufacturers', 'shs'],
    queryFn: fetchShsManufacturers,
  });
  const products = useQuery({ queryKey: ['appliances'], queryFn: fetchAppliances });
  const solarProducts = (products.data ?? []).filter(
    (product) => product.appliance_type_id === SOLAR_HOME_SYSTEM_TYPE_ID,
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      serialNumber: solarHomeSystem.serial_number,
      manufacturerId: manufacturers.data ? String(solarHomeSystem.manufacturer_id) : '',
      productId: products.data ? String(solarHomeSystem.appliance_id ?? '') : '',
    },
    resetOptions: { keepDirtyValues: true },
  });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      updateSolarHomeSystem(solarHomeSystem.id, {
        serialNumber:
          values.serialNumber === solarHomeSystem.serial_number ? undefined : values.serialNumber,
        manufacturerId: Number(values.manufacturerId),
        productId: Number(values.productId),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['solar-home-system', solarHomeSystem.id] });
      await queryClient.invalidateQueries({ queryKey: ['solar-home-systems'] });
      onClose();
    },
    onError: (error) =>
      showFieldErrors(error, setError, {
        serial_number: 'serialNumber',
        manufacturer_id: 'manufacturerId',
        appliance_id: 'productId',
      }),
  });

  return (
    <Sheet
      title="Edit solar home system"
      description={solarHomeSystem.serial_number}
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            A serial can only change before the device has payments, tokens or a sale.
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void handleSubmit((values) => save.mutate(values))(event)}
        className="flex flex-col gap-4"
      >
        {save.isError ? (
          <Banner tone="error" role="alert">
            The changes were not saved: {save.error.message}
          </Banner>
        ) : null}
        {manufacturers.isError || products.isError ? (
          <Banner tone="error" role="alert">
            Could not load the manufacturers or products:{' '}
            {(manufacturers.error ?? products.error)?.message}
          </Banner>
        ) : null}
        <Field label="Serial number *" error={errors.serialNumber?.message}>
          <Input
            autoComplete="off"
            className="tabular-nums"
            aria-invalid={Boolean(errors.serialNumber)}
            {...register('serialNumber')}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Manufacturer *" error={errors.manufacturerId?.message}>
            <select className={selectClass} {...register('manufacturerId')}>
              <option value="">Choose a manufacturer</option>
              {(manufacturers.data ?? []).map((manufacturer) => (
                <option key={manufacturer.id} value={manufacturer.id}>
                  {manufacturer.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product *" error={errors.productId?.message}>
            <select className={selectClass} {...register('productId')}>
              <option value="">Choose a product</option>
              {solarProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </form>
    </Sheet>
  );
}
