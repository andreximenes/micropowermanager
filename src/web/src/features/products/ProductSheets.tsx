import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import {
  createProduct,
  createProductType,
  renameProductType,
  updateProduct,
  type Product,
  type ProductType,
} from '@/api/products';
import { Field, selectClass } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { showFieldErrors } from '@/lib/fieldErrors';
import { formatMoney, plural } from '@/lib/format';

// The backend stores prices as whole amounts.
const productFormSchema = z.object({
  name: z.string().trim().min(3, 'Enter at least 3 characters.'),
  typeId: z.string().min(1, 'Choose the type.'),
  price: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Enter a whole amount.')
    .refine((price) => Number(price) >= 1, 'Enter at least 1.'),
});
type ProductFormValues = z.infer<typeof productFormSchema>;

type ProductSheetProps = {
  /** The product to edit; without it the sheet adds one. */
  product?: Product;
  types: ProductType[];
  defaultTypeId?: number;
  currency: string;
  onClose: () => void;
};

export function ProductSheet({
  product,
  types,
  defaultTypeId,
  currency,
  onClose,
}: ProductSheetProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? '',
      typeId: String(product?.appliance_type_id ?? defaultTypeId ?? ''),
      price: product ? String(product.price) : '',
    },
  });

  const save = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const input = {
        name: values.name,
        price: Number(values.price),
        typeId: Number(values.typeId),
      };
      return product ? updateProduct(product.id, input) : createProduct(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appliances'] });
      onClose();
    },
    onError: (error) =>
      showFieldErrors(error, setError, {
        name: 'name',
        price: 'price',
        appliance_type_id: 'typeId',
      }),
  });

  const newPrice = useWatch({ control, name: 'price' });
  const priceChanged = product !== undefined && newPrice !== String(product.price);

  return (
    <Sheet
      title={product ? 'Edit product' : 'New product'}
      description={product?.name}
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save product'}
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
            The product was not saved: {save.error.message}
          </Banner>
        ) : null}
        <Field label="Name *" error={errors.name?.message}>
          <Input autoComplete="off" aria-invalid={Boolean(errors.name)} {...register('name')} />
        </Field>
        <Field label="Type *" error={errors.typeId?.message}>
          <select
            className={selectClass}
            aria-invalid={Boolean(errors.typeId)}
            {...register('typeId')}
          >
            <option value="">Choose a type</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Price (${currency}) *`} error={errors.price?.message}>
          <Input inputMode="numeric" aria-invalid={Boolean(errors.price)} {...register('price')} />
        </Field>
        {product && product.sold_count > 0 && priceChanged ? (
          <p className="m-0 text-sm text-muted-foreground">
            {plural(product.sold_count, 'contract')} sold before keep{' '}
            {formatMoney(product.price, currency)}. The new price applies to new sales only.
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

const typeFormSchema = z.object({ name: z.string().trim().min(3, 'Enter at least 3 characters.') });
type TypeFormValues = z.infer<typeof typeFormSchema>;

/** Adds a product type, or renames `type`. */
export function ProductTypeSheet({ type, onClose }: { type?: ProductType; onClose: () => void }) {
  const formId = useId();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TypeFormValues>({
    resolver: zodResolver(typeFormSchema),
    defaultValues: { name: type?.name ?? '' },
  });

  const save = useMutation({
    mutationFn: ({ name }: TypeFormValues) =>
      type ? renameProductType(type.id, name) : createProductType(name),
    onSuccess: async () => {
      // Products show their type's name.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appliance-types'] }),
        queryClient.invalidateQueries({ queryKey: ['appliances'] }),
      ]);
      onClose();
    },
    onError: (error) => showFieldErrors(error, setError, { name: 'name' }),
  });

  return (
    <Sheet
      title={type ? 'Rename type' : 'New product type'}
      description={
        type ? type.name : 'Group products by what they are, such as solar home system or TV.'
      }
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save type'}
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
            The type was not saved: {save.error.message}
          </Banner>
        ) : null}
        <Field label="Name *" error={errors.name?.message}>
          <Input autoComplete="off" aria-invalid={Boolean(errors.name)} {...register('name')} />
        </Field>
      </form>
    </Sheet>
  );
}
