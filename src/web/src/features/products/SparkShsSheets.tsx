import { zodResolver } from '@hookform/resolvers/zod';
import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Input } from '@spark/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { fetchAppliances, SOLAR_HOME_SYSTEM_TYPE_ID } from '@/api/products';
import {
  audienceLabels,
  audiences,
  checkSparkShsCredentials,
  saveKitTypeRule,
  saveSparkShsCredentials,
  type CredentialsInput,
  type KitTypeRule,
  type SparkShsCredentials,
} from '@/api/sparkShs';
import { Field, selectClass } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { showFieldErrors } from '@/lib/fieldErrors';

import { ConnectionResult } from './ConnectionResult';

const credentialsFormSchema = z.object({
  client_id: z.string().trim().min(1, 'Enter the client ID.'),
  client_secret: z.string(),
  audience: z.enum(audiences),
  auth_url: z.url('Enter a full address, such as https://…'),
  api_url: z.url('Enter a full address, such as https://…'),
});

type CredentialsSheetProps = { credentials: SparkShsCredentials; onClose: () => void };

export function CredentialsSheet({ credentials, onClose }: CredentialsSheetProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    trigger,
    control,
    formState: { errors },
  } = useForm<CredentialsInput>({
    resolver: zodResolver(credentialsFormSchema),
    defaultValues: {
      client_id: credentials.client_id ?? '',
      client_secret: '',
      audience: credentials.audience,
      auth_url: credentials.auth_url,
      api_url: credentials.api_url,
    },
  });
  const fieldOf = {
    client_id: 'client_id',
    client_secret: 'client_secret',
    audience: 'audience',
    auth_url: 'auth_url',
    api_url: 'api_url',
  } as const;
  const check = useMutation({
    mutationFn: checkSparkShsCredentials,
    onError: (error) => showFieldErrors(error, setError, fieldOf),
  });

  const save = useMutation({
    mutationFn: saveSparkShsCredentials,
    onSuccess: (saved) => {
      queryClient.setQueryData(['spark-shs', 'credentials'], saved);
      onClose();
    },
    onError: (error) => showFieldErrors(error, setError, fieldOf),
  });

  // The stored secret is only reused for the address it was saved with.
  const authUrl = useWatch({ control, name: 'auth_url' });
  const secretKept = credentials.has_client_secret && authUrl === credentials.auth_url;

  return (
    <Sheet
      title="Spark cloud credentials"
      description="Spark issues these for your company. They let Spark CRM fetch tokens and kits."
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={check.isPending}
            onClick={() =>
              void trigger().then((valid) => (valid ? check.mutate(getValues()) : undefined))
            }
          >
            {check.isPending ? 'Testing…' : 'Test connection'}
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
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
            The credentials were not saved: {save.error.message}
          </Banner>
        ) : null}
        <ConnectionResult valid={check.data} error={check.error} />
        <Field label="Client ID *" error={errors.client_id?.message}>
          <Input
            autoComplete="off"
            aria-invalid={Boolean(errors.client_id)}
            {...register('client_id')}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <Field
            label={secretKept ? 'Client secret' : 'Client secret *'}
            error={errors.client_secret?.message}
          >
            <Input
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.client_secret)}
              {...register('client_secret')}
            />
          </Field>
          <p className="m-0 text-xs text-muted-foreground">
            {secretKept
              ? 'A secret is stored — leave blank to keep it.'
              : credentials.has_client_secret
                ? 'The auth URL changed, so enter the secret again.'
                : 'No secret is stored yet.'}
          </p>
        </div>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1.5 text-sm font-medium text-label">Environment</legend>
          <div className="flex flex-wrap gap-4">
            {audiences.map((audience) => (
              <label key={audience} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  value={audience}
                  className="size-4 accent-primary"
                  {...register('audience')}
                />
                {audienceLabels[audience]}
              </label>
            ))}
          </div>
        </fieldset>
        <details open={Boolean(errors.auth_url || errors.api_url)} className="text-sm">
          <summary className="cursor-pointer font-medium">Advanced: API addresses</summary>
          <div className="mt-3 flex flex-col gap-3">
            <Field label="Auth URL *" error={errors.auth_url?.message}>
              <Input aria-invalid={Boolean(errors.auth_url)} {...register('auth_url')} />
            </Field>
            <Field label="API URL *" error={errors.api_url?.message}>
              <Input aria-invalid={Boolean(errors.api_url)} {...register('api_url')} />
            </Field>
          </div>
        </details>
      </form>
    </Sheet>
  );
}

const ruleFormSchema = z.object({
  pattern: z.string().trim().min(1, 'Enter part of the kit type, such as spark_steady.'),
  productId: z.string(),
});
type RuleFormValues = z.infer<typeof ruleFormSchema>;

type KitTypeRuleSheetProps = { rule?: KitTypeRule; onClose: () => void };

export function KitTypeRuleSheet({ rule, onClose }: KitTypeRuleSheetProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ['appliances'], queryFn: fetchAppliances });
  const solarProducts = (products.data ?? []).filter(
    (product) => product.appliance_type_id === SOLAR_HOME_SYSTEM_TYPE_ID,
  );
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    values: {
      pattern: rule?.pattern ?? '',
      productId: products.data ? String(rule?.appliance_id ?? '') : '',
    },
    resetOptions: { keepDirtyValues: true },
  });

  const save = useMutation({
    mutationFn: (values: RuleFormValues) =>
      saveKitTypeRule(rule?.id ?? null, {
        pattern: values.pattern,
        appliance_id: values.productId ? Number(values.productId) : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['spark-shs', 'rules'] });
      onClose();
    },
    onError: (error) =>
      showFieldErrors(error, setError, { pattern: 'pattern', appliance_id: 'productId' }),
  });

  return (
    <Sheet
      title={rule ? 'Edit kit type rule' : 'New kit type rule'}
      description="Kits whose type contains the pattern become solar home systems of this product."
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save rule'}
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
            The rule was not saved: {save.error.message}
          </Banner>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Field label="Kit type pattern *" error={errors.pattern?.message}>
            <Input
              autoComplete="off"
              className="font-mono"
              aria-invalid={Boolean(errors.pattern)}
              {...register('pattern')}
            />
          </Field>
          <p className="m-0 text-xs text-muted-foreground">
            Matched anywhere in the kit type, ignoring case; regular expressions work too. When
            several rules match, the longest pattern wins.
          </p>
        </div>
        <Field label="Becomes product" error={errors.productId?.message}>
          <select className={selectClass} {...register('productId')}>
            <option value="">No product yet</option>
            {solarProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>
        {products.isError ? (
          <Banner tone="error" role="alert">
            Could not load the products: {products.error.message}
          </Banner>
        ) : null}
      </form>
    </Sheet>
  );
}
