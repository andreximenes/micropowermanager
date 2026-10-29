import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { StatusPill } from '@spark/ui/status-pill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Pencil, Trash2, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { fetchMainSettings } from '@/api/customers';
import {
  deleteProduct,
  deleteProductType,
  fetchAppliances,
  fetchProductTypes,
  type Product,
  type ProductType,
} from '@/api/products';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SearchBox } from '@/components/SearchBox';
import { formatMoney, plural } from '@/lib/format';

import { ProductSheet, ProductTypeSheet } from './ProductSheets';
import type { AppliancesSearch } from './search';

type Panel =
  | { kind: 'product'; product?: Product }
  | { kind: 'type'; type?: ProductType }
  | { kind: 'delete-product'; product: Product }
  | { kind: 'delete-type'; type: ProductType };

function IconButton({
  label,
  onClick,
  danger,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`size-8 ${danger ? 'text-red' : ''}`}
    >
      {children}
    </Button>
  );
}

export function AppliancesPage({ search }: { search: AppliancesSearch }) {
  const navigate = useNavigate({ from: '/appliances' });
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel | null>(null);
  const types = useQuery({ queryKey: ['appliance-types'], queryFn: fetchProductTypes });
  const products = useQuery({ queryKey: ['appliances'], queryFn: fetchAppliances });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const currency = settings.data?.currency ?? '';

  const allProducts = products.data ?? [];
  const selectedType = types.data?.find((type) => type.id === search.type);
  const term = search.term?.trim().toLowerCase() ?? '';
  const rows = allProducts.filter(
    (product) =>
      (selectedType === undefined || product.appliance_type_id === selectedType.id) &&
      product.name.toLowerCase().includes(term),
  );
  const productCount = (type: ProductType) =>
    allProducts.filter((product) => product.appliance_type_id === type.id).length;
  const typeName = (product: Product) =>
    product.appliance_type?.name ??
    types.data?.find((type) => type.id === product.appliance_type_id)?.name ??
    '—';

  function update(changes: Partial<AppliancesSearch>, replace = false) {
    void navigate({ search: (previous) => ({ ...previous, ...changes }), replace });
  }

  const productActions = (product: Product) => (
    <span className="flex justify-end gap-1.5">
      <IconButton
        label={`Edit ${product.name}`}
        onClick={() => setPanel({ kind: 'product', product })}
      >
        <Pencil />
      </IconButton>
      <IconButton
        label={
          product.sold_count > 0
            ? `${product.name} was sold and can't be deleted`
            : `Delete ${product.name}`
        }
        danger
        disabled={product.sold_count > 0}
        onClick={() => setPanel({ kind: 'delete-product', product })}
      >
        <Trash2 />
      </IconButton>
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold">Appliances</h1>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            What you sell: product types and the products in each
          </p>
        </div>
        <Button
          className="h-10"
          disabled={!types.data}
          onClick={() => setPanel({ kind: 'product' })}
        >
          + New product
        </Button>
      </div>

      <Card className="bg-panel">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <h2 className="m-0 text-base font-semibold">Product types</h2>
          <Button variant="outline" onClick={() => setPanel({ kind: 'type' })}>
            + Add type
          </Button>
        </div>
        {types.isPending ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">Loading types…</p>
        ) : null}
        {types.isError ? (
          <div className="p-4">
            <Banner tone="error" role="alert">
              Could not load the product types: {types.error.message}
            </Banner>
          </div>
        ) : null}
        {types.data?.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No product types yet. Add one to start selling.
          </p>
        ) : null}
        {types.data && types.data.length > 0 ? (
          <ul
            aria-label="Product types"
            className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5 px-4 py-4 sm:px-5"
          >
            {types.data.map((type) => {
              const selected = type.id === selectedType?.id;
              const count = productCount(type);
              return (
                <li
                  key={type.id}
                  className={`flex items-center gap-2.5 rounded-xl border py-2.5 pr-2.5 pl-3.5 ${selected ? 'border-primary bg-panel-2' : 'border-border'}`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update({ type: selected ? undefined : type.id })}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <strong className="block truncate">{type.name}</strong>
                    <span className="text-xs text-muted-foreground">
                      {plural(count, 'product')} ·{' '}
                    </span>
                    <StatusPill status={type.paygo_enabled ? 'info' : 'neutral'} className="py-0">
                      {type.paygo_enabled ? 'PAYG' : 'Cash only'}
                    </StatusPill>
                  </button>
                  <IconButton
                    label={`Rename ${type.name}`}
                    onClick={() => setPanel({ kind: 'type', type })}
                  >
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label={
                      count > 0
                        ? `${type.name} has products and can't be deleted`
                        : `Delete ${type.name}`
                    }
                    danger
                    disabled={count > 0}
                    onClick={() => setPanel({ kind: 'delete-type', type })}
                  >
                    <Trash2 />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>

      <Card className="bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <h2 className="m-0 flex flex-wrap items-center gap-2 text-base font-semibold">
            Products
            {selectedType ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-panel-2 py-0.5 pr-1 pl-3 text-sm font-normal">
                {selectedType.name}
                <button
                  type="button"
                  aria-label="Show all types"
                  onClick={() => update({ type: undefined })}
                  className="grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-border"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            ) : null}
          </h2>
          <SearchBox
            label="Search products"
            placeholder="Search products"
            term={search.term ?? ''}
            onSearch={(next) => update({ term: next.trim() || undefined }, true)}
            className="w-full sm:w-64"
          />
        </div>

        {products.isPending ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading products…</p>
        ) : null}
        {products.isError ? (
          <div className="p-4">
            <Banner tone="error" role="alert">
              Could not load the products: {products.error.message}
            </Banner>
          </div>
        ) : null}
        {products.data && rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            {term || selectedType ? 'No products match.' : 'No products yet.'}
          </p>
        ) : null}

        {rows.length > 0 ? (
          <>
            <Table aria-label="Products" className="hidden sm:table">
              <TableHeader>
                <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
                  <TableHead className="pl-5 font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="text-right font-semibold">Price</TableHead>
                  <TableHead className="text-right font-semibold">Sold</TableHead>
                  <TableHead className="pr-5">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="pl-5 font-semibold">{product.name}</TableCell>
                    <TableCell>{typeName(product)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatMoney(product.price, currency)}
                    </TableCell>
                    <TableCell className="text-right">{product.sold_count}</TableCell>
                    <TableCell className="py-1.5 pr-5">{productActions(product)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ul aria-label="Products" className="m-0 flex list-none flex-col gap-2 p-3 sm:hidden">
              {rows.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate">{product.name}</strong>
                    <span className="block text-xs text-muted-foreground">
                      {typeName(product)} · {formatMoney(product.price, currency)} ·{' '}
                      {product.sold_count} sold
                    </span>
                  </span>
                  {productActions(product)}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="m-0 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
          Products already sold can&apos;t be deleted. Change their price instead; existing
          contracts keep the old price.
        </p>
      </Card>

      {panel?.kind === 'product' && types.data ? (
        <ProductSheet
          product={panel.product}
          types={types.data}
          defaultTypeId={selectedType?.id}
          currency={currency}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel?.kind === 'type' ? (
        <ProductTypeSheet type={panel.type} onClose={() => setPanel(null)} />
      ) : null}
      {panel?.kind === 'delete-product' ? (
        <ConfirmDialog
          title={`Delete ${panel.product.name}?`}
          description="It disappears from the product list and can no longer be sold."
          confirmLabel="Delete product"
          pendingLabel="Deleting…"
          failureLabel="The product was not deleted"
          onConfirm={() => deleteProduct(panel.product.id)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['appliances'] })}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel?.kind === 'delete-type' ? (
        <ConfirmDialog
          title={`Delete ${panel.type.name}?`}
          description="The type disappears from the list. It has no products."
          confirmLabel="Delete type"
          pendingLabel="Deleting…"
          failureLabel="The type was not deleted"
          onConfirm={() => deleteProductType(panel.type.id)}
          onDone={async () => {
            if (search.type === panel.type.id) {
              update({ type: undefined });
            }
            await queryClient.invalidateQueries({ queryKey: ['appliance-types'] });
          }}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </div>
  );
}
